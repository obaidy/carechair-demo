-- CareChair Professionals multi-tenant onboarding + membership foundation.
-- Compatibility-first migration:
-- - Adds secure membership/invite model without deleting legacy onboarding/public flows.
-- - Keeps existing tables/columns used by /web; only additive/compatible changes.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) Core profile + tenant membership tables
-- ------------------------------------------------------------

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  full_name text null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz null
);

create table if not exists public.salon_members (
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'ACTIVE',
  joined_at timestamptz not null default now(),
  removed_at timestamptz null,
  primary key (salon_id, user_id)
);

alter table public.salon_members
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists removed_at timestamptz null;

update public.salon_members
set role = case
  when upper(coalesce(role, '')) in ('OWNER', 'MANAGER', 'STAFF') then upper(role)
  when upper(coalesce(role, '')) in ('ADMIN', 'SALON_ADMIN') then 'MANAGER'
  when upper(coalesce(role, '')) = 'EMPLOYEE' then 'STAFF'
  else 'STAFF'
end;

update public.salon_members
set status = case
  when upper(coalesce(status, '')) = 'REMOVED' then 'REMOVED'
  else 'ACTIVE'
end;

alter table public.salon_members
  alter column role set not null,
  alter column status set default 'ACTIVE';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_members_role_check'
      and conrelid = 'public.salon_members'::regclass
  ) then
    alter table public.salon_members
      add constraint salon_members_role_check
      check (role in ('OWNER', 'MANAGER', 'STAFF'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_members_status_check'
      and conrelid = 'public.salon_members'::regclass
  ) then
    alter table public.salon_members
      add constraint salon_members_status_check
      check (status in ('ACTIVE', 'REMOVED'));
  end if;
end $$;

create index if not exists idx_salon_members_user_active
  on public.salon_members(user_id, status);
create index if not exists idx_salon_members_salon_active
  on public.salon_members(salon_id, status);

-- ------------------------------------------------------------
-- 2) Extend salons table with onboarding metadata (non-breaking)
-- ------------------------------------------------------------

alter table public.salons
  add column if not exists city text null,
  add column if not exists address text null,
  add column if not exists category text null,
  add column if not exists created_by uuid null,
  add column if not exists is_public boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.salons
  alter column timezone set default 'Asia/Baghdad',
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_created_by_auth_users_fkey'
      and conrelid = 'public.salons'::regclass
  ) then
    begin
      alter table public.salons
        add constraint salons_created_by_auth_users_fkey
        foreign key (created_by) references auth.users(id) on delete set null not valid;
    exception when others then
      -- Keep migration non-breaking if legacy data cannot validate FK immediately.
      null;
    end;
  end if;
end $$;

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_salons_set_updated_at_membership_v1 on public.salons;
create trigger trg_salons_set_updated_at_membership_v1
before update on public.salons
for each row
execute function public.tg_set_updated_at();

-- ------------------------------------------------------------
-- 3) Invite table hardening/normalization (compatible with legacy table)
-- ------------------------------------------------------------

create table if not exists public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid null references public.salons(id) on delete cascade,
  created_by uuid null,
  role text not null default 'STAFF',
  code text,
  token_hash text,
  token text,
  country_code text,
  expires_at timestamptz null,
  max_uses int not null default 1,
  used_count int not null default 0,
  uses int,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null
);

alter table public.salon_invites
  add column if not exists salon_id uuid null,
  add column if not exists role text,
  add column if not exists code text,
  add column if not exists token_hash text,
  add column if not exists used_count int not null default 0,
  add column if not exists revoked_at timestamptz null,
  add column if not exists last_used_at timestamptz null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salon_invites'
      and column_name = 'token'
      and is_nullable = 'NO'
  ) then
    alter table public.salon_invites
      alter column token drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'salon_invites'
      and column_name = 'country_code'
      and is_nullable = 'NO'
  ) then
    alter table public.salon_invites
      alter column country_code drop not null;
  end if;
end $$;

alter table public.salon_invites
  alter column role set not null,
  alter column role set default 'STAFF',
  alter column max_uses set default 1,
  alter column used_count set default 0;

update public.salon_invites
set role = case
  when upper(coalesce(role, '')) in ('MANAGER', 'STAFF') then upper(role)
  when upper(coalesce(role, '')) in ('ADMIN', 'SALON_ADMIN') then 'MANAGER'
  when upper(coalesce(role, '')) = 'OWNER' then 'MANAGER'
  else 'STAFF'
end;

update public.salon_invites
set used_count = coalesce(used_count, uses, 0)
where used_count is null;

update public.salon_invites
set uses = coalesce(uses, used_count, 0)
where uses is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_invites_role_check'
      and conrelid = 'public.salon_invites'::regclass
  ) then
    alter table public.salon_invites
      add constraint salon_invites_role_check
      check (role in ('MANAGER', 'STAFF'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_invites_max_uses_check'
      and conrelid = 'public.salon_invites'::regclass
  ) then
    alter table public.salon_invites
      add constraint salon_invites_max_uses_check
      check (max_uses > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_invites_salon_id_fkey'
      and conrelid = 'public.salon_invites'::regclass
  ) then
    alter table public.salon_invites
      add constraint salon_invites_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salon_invites_created_by_auth_users_fkey'
      and conrelid = 'public.salon_invites'::regclass
  ) then
    begin
      alter table public.salon_invites
        add constraint salon_invites_created_by_auth_users_fkey
        foreign key (created_by) references auth.users(id) on delete set null not valid;
    exception when others then
      null;
    end;
  end if;
end $$;

create unique index if not exists uq_salon_invites_code
  on public.salon_invites(code)
  where code is not null;

create unique index if not exists uq_salon_invites_token_hash
  on public.salon_invites(token_hash)
  where token_hash is not null;

create index if not exists idx_salon_invites_salon_id
  on public.salon_invites(salon_id);
create index if not exists idx_salon_invites_expires_at_v2
  on public.salon_invites(expires_at);
create index if not exists idx_salon_invites_role
  on public.salon_invites(role);

create or replace function public.tg_sync_salon_invites_usage()
returns trigger
language plpgsql
as $$
begin
  new.used_count := coalesce(new.used_count, new.uses, 0);
  new.uses := coalesce(new.uses, new.used_count, 0);

  if new.used_count <> new.uses then
    new.uses := new.used_count;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_salon_invites_usage on public.salon_invites;
create trigger trg_sync_salon_invites_usage
before insert or update on public.salon_invites
for each row
execute function public.tg_sync_salon_invites_usage();

-- ------------------------------------------------------------
-- 4) Audit log
-- ------------------------------------------------------------

create table if not exists public.audit_log (
  id bigserial primary key,
  salon_id uuid null references public.salons(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_salon_created
  on public.audit_log(salon_id, created_at desc);
create index if not exists idx_audit_log_actor_created
  on public.audit_log(actor_user_id, created_at desc);

-- ------------------------------------------------------------
-- 4.1) Rate limits for edge-function abuse controls
-- ------------------------------------------------------------

create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

create index if not exists idx_rate_limits_reset_at
  on public.rate_limits(reset_at);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limits;
  v_limit int := greatest(coalesce(p_limit, 1), 1);
  v_window int := greatest(coalesce(p_window_seconds, 60), 1);
begin
  if coalesce(trim(p_key), '') = '' then
    raise exception using errcode = '22023', message = 'rate_limit_key_required';
  end if;

  insert into public.rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => v_window))
  on conflict (key)
  do update
    set count = case
      when public.rate_limits.reset_at <= v_now then 1
      else public.rate_limits.count + 1
    end,
    reset_at = case
      when public.rate_limits.reset_at <= v_now then v_now + make_interval(secs => v_window)
      else public.rate_limits.reset_at
    end
  returning * into v_row;

  return jsonb_build_object(
    'ok', (v_row.count <= v_limit),
    'count', v_row.count,
    'limit', v_limit,
    'reset_at', v_row.reset_at
  );
end;
$$;

revoke all on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;

-- ------------------------------------------------------------
-- 5) Membership helper functions
-- ------------------------------------------------------------

create or replace function public.normalize_member_role(p_role text)
returns text
language plpgsql
immutable
as $$
declare
  v text := upper(trim(coalesce(p_role, '')));
begin
  if v in ('OWNER', 'MANAGER', 'STAFF') then
    return v;
  end if;
  if v in ('ADMIN', 'SALON_ADMIN') then
    return 'MANAGER';
  end if;
  if v = 'EMPLOYEE' then
    return 'STAFF';
  end if;
  return null;
end;
$$;

create or replace function public.member_role(p_salon_id uuid, p_uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
begin
  if p_salon_id is null or p_uid is null then
    return null;
  end if;

  select sm.role, sm.status
  into v_role, v_status
  from public.salon_members sm
  where sm.salon_id = p_salon_id
    and sm.user_id = p_uid
  limit 1;

  v_role := public.normalize_member_role(v_role);
  v_status := upper(coalesce(v_status, ''));

  if v_role is not null and v_status = 'ACTIVE' then
    return v_role;
  end if;

  begin
    execute
      'select role, status from public.salon_memberships where salon_id = $1 and user_id = $2 limit 1'
      into v_role, v_status
      using p_salon_id, p_uid;

    v_role := public.normalize_member_role(v_role);
    v_status := upper(coalesce(v_status, ''));

    if v_role is not null and (v_status = '' or v_status = 'ACTIVE') then
      return v_role;
    end if;
  exception
    when undefined_table then
      null;
  end;

  return null;
end;
$$;

create or replace function public.is_salon_member(p_salon_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role(p_salon_id, p_uid) is not null;
$$;

-- ------------------------------------------------------------
-- 6) Compatibility sync triggers (new membership -> legacy mapping)
-- ------------------------------------------------------------

create or replace function public.tg_sync_salon_members_legacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
begin
  v_role := case new.role
    when 'OWNER' then 'owner'
    when 'MANAGER' then 'admin'
    else 'staff'
  end;

  v_status := case new.status
    when 'ACTIVE' then 'active'
    else 'removed'
  end;

  begin
    execute
      'update public.salon_memberships
          set role = $1, status = $2
        where salon_id = $3 and user_id = $4'
      using v_role, v_status, new.salon_id, new.user_id;

    if not found then
      execute
        'insert into public.salon_memberships (salon_id, user_id, role, status)
         values ($1, $2, $3, $4)'
        using new.salon_id, new.user_id, v_role, v_status;
    end if;
  exception
    when undefined_table or undefined_column then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_salon_members_legacy on public.salon_members;
create trigger trg_sync_salon_members_legacy
after insert or update on public.salon_members
for each row
execute function public.tg_sync_salon_members_legacy();

create or replace function public.tg_seed_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.salon_members (salon_id, user_id, role, status)
    values (new.id, new.created_by, 'OWNER', 'ACTIVE')
    on conflict (salon_id, user_id)
    do update
      set role = excluded.role,
          status = 'ACTIVE',
          removed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seed_owner_membership on public.salons;
create trigger trg_seed_owner_membership
after insert on public.salons
for each row
execute function public.tg_seed_owner_membership();

-- ------------------------------------------------------------
-- 8) RLS + policies
-- ------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.salons enable row level security;
alter table public.salon_members enable row level security;
alter table public.salon_invites enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

-- user_profiles: user owns their row.
drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- salons:
-- Compatibility-safe: keep existing legacy policies untouched.
-- Add secure member policies for authenticated app flows, plus public listed read.
drop policy if exists salons_member_select_v1 on public.salons;
create policy salons_member_select_v1
on public.salons
for select
to authenticated
using (public.is_salon_member(id, auth.uid()));

drop policy if exists salons_public_select_v1 on public.salons;
create policy salons_public_select_v1
on public.salons
for select
to anon
using (
  coalesce(is_public, false) = true
  and coalesce(is_active, true) = true
);

drop policy if exists salons_member_insert_v1 on public.salons;
create policy salons_member_insert_v1
on public.salons
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists salons_member_update_v1 on public.salons;
create policy salons_member_update_v1
on public.salons
for update
to authenticated
using (public.member_role(id, auth.uid()) in ('OWNER', 'MANAGER'))
with check (public.member_role(id, auth.uid()) in ('OWNER', 'MANAGER'));

-- salon_members:
-- select only within active salon membership scope.
drop policy if exists salon_members_select_same_salon on public.salon_members;
create policy salon_members_select_same_salon
on public.salon_members
for select
to authenticated
using (public.is_salon_member(salon_id, auth.uid()));

-- No direct insert policy for authenticated clients (edge function/service role only).

drop policy if exists salon_members_update_owner_manager on public.salon_members;
create policy salon_members_update_owner_manager
on public.salon_members
for update
to authenticated
using (
  public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
  and auth.uid() <> user_id
  and (
    public.member_role(salon_id, auth.uid()) = 'OWNER'
    or public.member_role(salon_id, user_id) <> 'OWNER'
  )
)
with check (
  role in ('OWNER', 'MANAGER', 'STAFF')
  and status in ('ACTIVE', 'REMOVED')
  and (
    public.member_role(salon_id, auth.uid()) = 'OWNER'
    or role <> 'OWNER'
  )
);

-- salon_invites:
-- invites are private; only owner/manager can view/manage.
drop policy if exists salon_invites_select_owner_manager on public.salon_invites;
create policy salon_invites_select_owner_manager
on public.salon_invites
for select
to authenticated
using (
  salon_id is not null
  and public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

drop policy if exists salon_invites_insert_owner_manager on public.salon_invites;
create policy salon_invites_insert_owner_manager
on public.salon_invites
for insert
to authenticated
with check (
  salon_id is not null
  and role in ('MANAGER', 'STAFF')
  and public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

drop policy if exists salon_invites_update_owner_manager on public.salon_invites;
create policy salon_invites_update_owner_manager
on public.salon_invites
for update
to authenticated
using (
  salon_id is not null
  and public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
)
with check (
  salon_id is not null
  and role in ('MANAGER', 'STAFF')
  and public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

-- audit_log:
drop policy if exists audit_log_select_owner_manager on public.audit_log;
create policy audit_log_select_owner_manager
on public.audit_log
for select
to authenticated
using (
  salon_id is not null
  and public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

-- No direct insert policy on audit_log; service role / security definer functions write logs.

-- rate_limits:
-- no client policies; only service role should consume through public.consume_rate_limit().
