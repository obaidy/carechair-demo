-- Superadmin hybrid console foundation: statuses, audit log, and override window.

create extension if not exists pgcrypto;

-- 1) Salons status model
alter table public.salons
  add column if not exists status text,
  add column if not exists manual_override_until timestamptz;

update public.salons
set status = coalesce(
  nullif(status, ''),
  case
    when coalesce(subscription_status, billing_status, 'inactive') = 'trialing' then 'trialing'
    when coalesce(subscription_status, billing_status, 'inactive') = 'active' then 'active'
    when coalesce(subscription_status, billing_status, 'inactive') = 'past_due' then 'past_due'
    when coalesce(subscription_status, billing_status, 'inactive') = 'suspended' then 'suspended'
    when coalesce(subscription_status, billing_status, 'inactive') = 'canceled' then 'rejected'
    when coalesce(subscription_status, billing_status, 'inactive') = 'inactive' then 'draft'
    else 'draft'
  end
)
where status is null or btrim(status) = '';

alter table public.salons
  alter column status set default 'draft';

alter table public.salons
  alter column is_active set default true,
  alter column is_listed set default false;

alter table public.salons
  drop constraint if exists salons_status_check;

alter table public.salons
  add constraint salons_status_check
  check (status in (
    'draft',
    'pending_approval',
    'pending_billing',
    'trialing',
    'active',
    'past_due',
    'suspended',
    'rejected'
  ));

create index if not exists idx_salons_status on public.salons(status);
create index if not exists idx_salons_manual_override_until on public.salons(manual_override_until);
create index if not exists idx_salons_is_active on public.salons(is_active);
create index if not exists idx_salons_is_listed on public.salons(is_listed);

-- 2) Audit log table
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  salon_id uuid not null references public.salons(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_salon_id on public.admin_actions(salon_id);
create index if not exists idx_admin_actions_created_at on public.admin_actions(created_at desc);
create index if not exists idx_admin_actions_action_type on public.admin_actions(action_type);

alter table public.admin_actions enable row level security;

-- Lock direct table access (frontend must use secure RPC with superadmin code check).
drop policy if exists admin_actions_direct_select on public.admin_actions;
drop policy if exists admin_actions_direct_insert on public.admin_actions;
drop policy if exists admin_actions_direct_update on public.admin_actions;
drop policy if exists admin_actions_direct_delete on public.admin_actions;

-- 3) Secure RPC access for superadmin actions (demo-passcode based)
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

create or replace function public.admin_actions_write(
  p_admin_code text,
  p_admin_user_id uuid,
  p_salon_id uuid,
  p_action_type text,
  p_payload jsonb default '{}'::jsonb
)
returns public.admin_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.admin_actions;
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  insert into public.admin_actions (admin_user_id, salon_id, action_type, payload)
  values (
    coalesce(p_admin_user_id, gen_random_uuid()),
    p_salon_id,
    p_action_type,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into inserted;

  return inserted;
end;
$$;

create or replace function public.admin_actions_list(
  p_admin_code text,
  p_salon_id uuid,
  p_limit integer default 50
)
returns setof public.admin_actions
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
  from public.admin_actions
  where salon_id = p_salon_id
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
end;
$$;

grant execute on function public.admin_actions_write(text, uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.admin_actions_list(text, uuid, integer) to anon, authenticated;
