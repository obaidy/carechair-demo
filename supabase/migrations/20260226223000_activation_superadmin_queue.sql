-- Activation + Super Admin Queue (non-breaking extension)
-- Keeps existing status model (lowercase in DB) while enabling strict activation workflow.

create extension if not exists pgcrypto;

-- 1) Salon profile/location fields (manual + gps)
alter table public.salons
  add column if not exists address_text text,
  add column if not exists address_mode text not null default 'MANUAL',
  add column if not exists location_lat numeric(10,7),
  add column if not exists location_lng numeric(10,7),
  add column if not exists location_accuracy_m numeric,
  add column if not exists location_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'salons_address_mode_chk'
      and conrelid = 'public.salons'::regclass
  ) then
    alter table public.salons
      add constraint salons_address_mode_chk
      check (address_mode in ('LOCATION','MANUAL'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'salons_location_lat_chk'
      and conrelid = 'public.salons'::regclass
  ) then
    alter table public.salons
      add constraint salons_location_lat_chk
      check (location_lat is null or (location_lat >= -90 and location_lat <= 90));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'salons_location_lng_chk'
      and conrelid = 'public.salons'::regclass
  ) then
    alter table public.salons
      add constraint salons_location_lng_chk
      check (location_lng is null or (location_lng >= -180 and location_lng <= 180));
  end if;
end $$;

create index if not exists idx_salons_address_mode on public.salons(address_mode);
create index if not exists idx_salons_status_country on public.salons(status, country_code);

-- 2) Super admin membership list
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_users_created_at on public.admin_users(created_at desc);

-- 3) Activation requests queue
create table if not exists public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING',
  submitted_data jsonb not null default '{}'::jsonb,
  admin_notes text,
  reviewed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  constraint activation_requests_status_chk check (status in ('PENDING','APPROVED','REJECTED'))
);

create index if not exists idx_activation_requests_salon_created on public.activation_requests(salon_id, created_at desc);
create index if not exists idx_activation_requests_status_created on public.activation_requests(status, created_at desc);
create index if not exists idx_activation_requests_requested_by on public.activation_requests(requested_by, created_at desc);

create unique index if not exists activation_requests_one_pending_per_salon
  on public.activation_requests(salon_id)
  where status = 'PENDING';

create or replace function public.tg_activation_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_activation_requests_set_updated_at on public.activation_requests;
create trigger trg_activation_requests_set_updated_at
before update on public.activation_requests
for each row
execute function public.tg_activation_requests_set_updated_at();

-- 4) Helpers
create or replace function public.is_super_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = p_uid
  );
$$;

revoke all on function public.is_super_admin(uuid) from public;
grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.is_super_admin(uuid) to service_role;

-- Keep member helpers available (already defined in V2 migration).
create or replace function public.is_salon_member(p_salon_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.member_role(p_salon_id, p_uid) is not null;
$$;

-- 5) RLS and policies
alter table public.admin_users enable row level security;
alter table public.activation_requests enable row level security;

-- admin_users: visible/manageable only by super admins

drop policy if exists admin_users_select_super_admin on public.admin_users;
create policy admin_users_select_super_admin
on public.admin_users
for select
to authenticated
using (public.is_super_admin(auth.uid()));

drop policy if exists admin_users_insert_super_admin on public.admin_users;
create policy admin_users_insert_super_admin
on public.admin_users
for insert
to authenticated
with check (public.is_super_admin(auth.uid()));

drop policy if exists admin_users_delete_super_admin on public.admin_users;
create policy admin_users_delete_super_admin
on public.admin_users
for delete
to authenticated
using (public.is_super_admin(auth.uid()));

-- activation_requests: owner submits, owner/manager reads, superadmin reviews

drop policy if exists activation_requests_owner_insert on public.activation_requests;
create policy activation_requests_owner_insert
on public.activation_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.member_role(salon_id, auth.uid()) = 'OWNER'
  and exists (
    select 1
    from public.salons s
    where s.id = activation_requests.salon_id
      and lower(coalesce(s.status, 'draft')) in ('draft', 'rejected')
  )
);

drop policy if exists activation_requests_member_select on public.activation_requests;
create policy activation_requests_member_select
on public.activation_requests
for select
to authenticated
using (
  public.is_super_admin(auth.uid())
  or public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

drop policy if exists activation_requests_super_admin_update on public.activation_requests;
create policy activation_requests_super_admin_update
on public.activation_requests
for update
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- super admins can update salon status to active/suspended using authenticated JWT.
drop policy if exists salons_super_admin_update_status_v1 on public.salons;
create policy salons_super_admin_update_status_v1
on public.salons
for update
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

-- Owners/managers can edit profile details only while salon is pre-activation.
drop policy if exists salons_member_update_v1 on public.salons;
create policy salons_member_update_v1
on public.salons
for update
to authenticated
using (
  public.member_role(id, auth.uid()) in ('OWNER', 'MANAGER')
  and lower(coalesce(status, 'draft')) in ('draft', 'pending_review', 'pending_approval', 'rejected')
)
with check (
  public.member_role(id, auth.uid()) in ('OWNER', 'MANAGER')
  and lower(coalesce(status, 'draft')) in ('draft', 'pending_review', 'pending_approval', 'rejected')
);

-- Optional helper for queue reads from edge functions/admin UI.
create or replace view public.activation_queue_view as
select
  ar.id,
  ar.salon_id,
  s.name as salon_name,
  s.slug as salon_slug,
  s.status as salon_status,
  s.city,
  s.area,
  s.whatsapp,
  ar.status as request_status,
  ar.submitted_data,
  ar.admin_notes,
  ar.requested_by,
  ar.reviewed_by,
  ar.created_at,
  ar.reviewed_at
from public.activation_requests ar
join public.salons s on s.id = ar.salon_id;

revoke all on public.activation_queue_view from public;
grant select on public.activation_queue_view to service_role;

-- 6) Audit utility for activation actions
create or replace function public.log_activation_event(
  p_salon_id uuid,
  p_actor uuid,
  p_action text,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (salon_id, actor_user_id, action, meta)
  values (p_salon_id, p_actor, p_action, coalesce(p_meta, '{}'::jsonb));
end;
$$;

revoke all on function public.log_activation_event(uuid, uuid, text, jsonb) from public;
grant execute on function public.log_activation_event(uuid, uuid, text, jsonb) to service_role;
