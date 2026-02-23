-- Invite-only country override with hidden countries (e.g. SY)

create extension if not exists pgcrypto;

-- 1) Countries visibility / billing flags
alter table public.countries
  add column if not exists is_public boolean not null default true,
  add column if not exists requires_manual_billing boolean not null default false;

-- 2) Optional salon billing mode for manual markets
alter table public.salons
  add column if not exists billing_mode text not null default 'stripe';

alter table public.salons
  drop constraint if exists salons_billing_mode_check;

alter table public.salons
  add constraint salons_billing_mode_check
  check (billing_mode in ('stripe', 'manual'));

-- 3) Ensure Syria exists and is hidden/public-invite-only
insert into public.countries (
  code,
  name_en,
  name_ar,
  name_cs,
  name_ru,
  default_currency,
  timezone_default,
  trial_days_default,
  vat_percent,
  is_enabled,
  is_public,
  requires_manual_billing
)
values (
  'SY',
  'Syria',
  'سوريا',
  'Sýrie',
  'Сирия',
  'SYP',
  'Asia/Damascus',
  7,
  0,
  true,
  false,
  true
)
on conflict (code)
do update set
  default_currency = excluded.default_currency,
  timezone_default = excluded.timezone_default,
  is_enabled = true,
  is_public = false,
  requires_manual_billing = true,
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  name_cs = excluded.name_cs,
  name_ru = excluded.name_ru;

-- 4) Invite tokens
create table if not exists public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  country_code text not null references public.countries(code),
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  max_uses int not null default 1,
  uses int not null default 0,
  created_by uuid null
);

create index if not exists idx_salon_invites_token on public.salon_invites(token);
create index if not exists idx_salon_invites_country_code on public.salon_invites(country_code);
create index if not exists idx_salon_invites_expires_at on public.salon_invites(expires_at);

alter table public.salon_invites enable row level security;

-- Lock direct public access (use RPC only)
drop policy if exists salon_invites_no_public_select on public.salon_invites;
drop policy if exists salon_invites_no_public_write on public.salon_invites;

-- 5) Superadmin verifier (idempotent)
create or replace function public._verify_superadmin_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  expected := coalesce(nullif(current_setting('app.settings.superadmin_code', true), ''), '1989');
  return coalesce(p_code, '') = expected;
end;
$$;

-- 6) Invite RPCs
create or replace function public.superadmin_create_invite(
  p_admin_code text,
  p_country_code text,
  p_expires_at timestamptz default null,
  p_max_uses int default 1,
  p_created_by uuid default null
)
returns public.salon_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_row public.salon_invites;
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  if not exists (
    select 1 from public.countries c
    where c.code = upper(coalesce(p_country_code, ''))
      and c.is_enabled = true
  ) then
    raise exception using errcode = '23514', message = 'country_not_enabled';
  end if;

  v_token := encode(gen_random_bytes(18), 'hex');

  insert into public.salon_invites (
    token,
    country_code,
    expires_at,
    max_uses,
    uses,
    created_by
  )
  values (
    v_token,
    upper(p_country_code),
    p_expires_at,
    greatest(1, coalesce(p_max_uses, 1)),
    0,
    p_created_by
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.superadmin_list_invites(
  p_admin_code text,
  p_limit int default 200
)
returns setof public.salon_invites
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  return query
  select *
  from public.salon_invites
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

create or replace function public.superadmin_revoke_invite(
  p_admin_code text,
  p_invite_id uuid
)
returns public.salon_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.salon_invites;
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  update public.salon_invites
  set expires_at = now()
  where id = p_invite_id
  returning * into v_row;

  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'invite_not_found';
  end if;

  return v_row;
end;
$$;

create or replace function public.validate_salon_invite(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.salon_invites;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'invite_missing');
  end if;

  select *
  into v_row
  from public.salon_invites si
  where si.token = trim(p_token)
    and (si.expires_at is null or si.expires_at > now())
    and coalesce(si.uses, 0) < coalesce(si.max_uses, 1)
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invite_invalid');
  end if;

  return jsonb_build_object(
    'ok', true,
    'invite_id', v_row.id,
    'country_code', v_row.country_code
  );
end;
$$;

grant execute on function public.superadmin_create_invite(text, text, timestamptz, int, uuid) to anon, authenticated;
grant execute on function public.superadmin_list_invites(text, int) to anon, authenticated;
grant execute on function public.superadmin_revoke_invite(text, uuid) to anon, authenticated;
grant execute on function public.validate_salon_invite(text) to anon, authenticated;

-- 7) Update onboarding wrapper to support invite token override and usage increment
create or replace function public.create_salon_onboarding(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
  v_salon_id uuid;
  v_slug text;
  v_invite_token text;
  v_invite public.salon_invites;
  v_country_code text;
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_salon_onboarding_legacy'
      and oidvectortypes(p.proargtypes) = 'jsonb'
  ) then
    raise exception using errcode = '42883', message = 'create_salon_onboarding_legacy_missing';
  end if;

  v_invite_token := nullif(trim(coalesce(v_payload ->> 'invite_token', '')), '');

  if v_invite_token is not null then
    select *
    into v_invite
    from public.salon_invites si
    where si.token = v_invite_token
      and (si.expires_at is null or si.expires_at > now())
      and coalesce(si.uses, 0) < coalesce(si.max_uses, 1)
    for update;

    if v_invite.id is null then
      raise exception using errcode = '23514', message = 'invite_invalid';
    end if;

    v_country_code := v_invite.country_code;
  else
    v_country_code := upper(coalesce(v_payload #>> '{salon,country_code}', ''));
    if not exists (
      select 1
      from public.countries c
      where c.code = v_country_code
        and c.is_enabled = true
        and coalesce(c.is_public, true) = true
    ) then
      raise exception using errcode = '23514', message = 'country_not_public';
    end if;
  end if;

  if v_country_code is null or btrim(v_country_code) = '' then
    raise exception using errcode = '23514', message = 'country_required';
  end if;

  v_payload := jsonb_set(v_payload, '{salon,country_code}', to_jsonb(v_country_code), true);

  v_slug := public.normalize_salon_slug(
    coalesce(v_payload #>> '{salon,slug}', v_payload #>> '{salon,name}', '')
  );

  if v_slug <> '' then
    v_payload := jsonb_set(v_payload, '{salon,slug}', to_jsonb(v_slug), true);
  end if;

  v_result := public.create_salon_onboarding_legacy(v_payload);

  v_salon_id := nullif(v_result ->> 'salon_id', '')::uuid;
  if v_salon_id is null then
    v_salon_id := nullif(v_payload #>> '{salon,id}', '')::uuid;
  end if;

  if v_salon_id is not null then
    update public.salons
    set status = 'pending_approval',
        subscription_status = 'inactive',
        billing_status = 'inactive',
        trial_end_at = null,
        trial_end = null,
        billing_mode = case when exists (
          select 1 from public.countries c where c.code = v_country_code and coalesce(c.requires_manual_billing, false) = true
        ) then 'manual' else 'stripe' end,
        is_active = true
    where id = v_salon_id;

    if v_invite.id is not null then
      update public.salon_invites
      set uses = coalesce(uses, 0) + 1
      where id = v_invite.id;
    end if;

    v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
      'status', 'pending_approval',
      'subscription_status', 'inactive',
      'billing_status', 'inactive',
      'trial_end_at', null,
      'slug', v_slug,
      'invite_applied', (v_invite.id is not null)
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.create_salon_onboarding(jsonb) to anon, authenticated;
