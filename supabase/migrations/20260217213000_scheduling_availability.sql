-- Demo scheduling schema + availability support
-- NOTE: This is intentionally demo-friendly RLS. Tighten before production.

create extension if not exists pgcrypto;

-- 1) Core salon tables
create table if not exists public.salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Asia/Baghdad',
  whatsapp text,
  created_at timestamptz not null default now()
);

create table if not exists public.salon_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (salon_id, day_of_week),
  check (is_closed or close_time > open_time)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_salon_name_unique_idx
  on public.staff (salon_id, name);

create unique index if not exists services_salon_name_unique_idx
  on public.services (salon_id, name);

create index if not exists staff_salon_active_sort_idx
  on public.staff (salon_id, is_active, sort_order);

create index if not exists services_salon_active_sort_idx
  on public.services (salon_id, is_active, sort_order);

-- 2) bookings table updates for real availability
alter table public.bookings
  add column if not exists salon_id uuid,
  add column if not exists staff_id uuid,
  add column if not exists service_id uuid,
  add column if not exists appointment_start timestamptz,
  add column if not exists appointment_end timestamptz,
  add column if not exists salon_whatsapp text,
  add column if not exists status text;

update public.bookings
set status = 'pending'
where status is null or btrim(status) = '';

alter table public.bookings
  alter column status set default 'pending';

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));

-- Backfill salon_id from slug when possible
update public.bookings b
set salon_id = s.id
from public.salons s
where b.salon_id is null
  and b.salon_slug is not null
  and b.salon_slug = s.slug;

-- Backfill appointment_start from legacy appointment_at if that column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'appointment_at'
  ) then
    execute $sql$
      update public.bookings
      set appointment_start = appointment_at::timestamptz
      where appointment_start is null
        and appointment_at is not null
    $sql$;
  end if;
end $$;

-- Backfill service_id/staff_id from legacy text columns when available
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'service'
  ) then
    execute $sql$
      update public.bookings b
      set service_id = sv.id
      from public.services sv
      where b.service_id is null
        and b.salon_id = sv.salon_id
        and b.service is not null
        and sv.name = b.service
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'staff'
  ) then
    execute $sql$
      update public.bookings b
      set staff_id = st.id
      from public.staff st
      where b.staff_id is null
        and b.salon_id = st.salon_id
        and b.staff is not null
        and st.name = b.staff
    $sql$;
  end if;
end $$;

-- Backfill appointment_end from service duration, then fallback to 45 minutes
update public.bookings b
set appointment_end = b.appointment_start + make_interval(mins => greatest(5, coalesce(sv.duration_minutes, 45)))
from public.services sv
where b.appointment_start is not null
  and b.appointment_end is null
  and b.service_id = sv.id;

update public.bookings
set appointment_end = appointment_start + interval '45 minutes'
where appointment_start is not null
  and appointment_end is null;

alter table public.bookings
  drop constraint if exists bookings_end_after_start_chk;

alter table public.bookings
  add constraint bookings_end_after_start_chk
  check (
    appointment_start is null
    or appointment_end is null
    or appointment_end > appointment_start
  ) not valid;

-- Add foreign keys only if not already present
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_salon_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_staff_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_staff_id_fkey
      foreign key (staff_id) references public.staff(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_service_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_service_id_fkey
      foreign key (service_id) references public.services(id) on delete set null;
  end if;
end $$;

create index if not exists bookings_salon_staff_start_idx
  on public.bookings (salon_id, staff_id, appointment_start);

create index if not exists bookings_staff_overlap_idx
  on public.bookings (staff_id, appointment_start, appointment_end)
  where status in ('pending', 'confirmed');

create index if not exists bookings_salon_start_idx
  on public.bookings (salon_id, appointment_start);

-- 3) Demo RLS policies
-- Set this optionally if you want read policies limited to a single salon slug:
-- alter database postgres set app.settings.demo_salon_slug = 'صالون الملكة - بغداد';

alter table public.salons enable row level security;
alter table public.salon_hours enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;

drop policy if exists demo_salons_select on public.salons;
create policy demo_salons_select
on public.salons
for select
to anon, authenticated
using (
  coalesce(current_setting('app.settings.demo_salon_slug', true), '') = ''
  or slug = current_setting('app.settings.demo_salon_slug', true)
);

drop policy if exists demo_salons_insert on public.salons;
create policy demo_salons_insert
on public.salons
for insert
to anon, authenticated
with check (true);

drop policy if exists demo_salons_update on public.salons;
create policy demo_salons_update
on public.salons
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists demo_hours_select on public.salon_hours;
create policy demo_hours_select
on public.salon_hours
for select
to anon, authenticated
using (
  coalesce(current_setting('app.settings.demo_salon_slug', true), '') = ''
  or exists (
    select 1
    from public.salons s
    where s.id = salon_hours.salon_id
      and s.slug = current_setting('app.settings.demo_salon_slug', true)
  )
);

drop policy if exists demo_hours_insert on public.salon_hours;
create policy demo_hours_insert
on public.salon_hours
for insert
to anon, authenticated
with check (true);

drop policy if exists demo_hours_update on public.salon_hours;
create policy demo_hours_update
on public.salon_hours
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists demo_hours_delete on public.salon_hours;
create policy demo_hours_delete
on public.salon_hours
for delete
to anon, authenticated
using (true);

drop policy if exists demo_staff_select on public.staff;
create policy demo_staff_select
on public.staff
for select
to anon, authenticated
using (
  coalesce(current_setting('app.settings.demo_salon_slug', true), '') = ''
  or exists (
    select 1
    from public.salons s
    where s.id = staff.salon_id
      and s.slug = current_setting('app.settings.demo_salon_slug', true)
  )
);

drop policy if exists demo_staff_insert on public.staff;
create policy demo_staff_insert
on public.staff
for insert
to anon, authenticated
with check (true);

drop policy if exists demo_staff_update on public.staff;
create policy demo_staff_update
on public.staff
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists demo_staff_delete on public.staff;
create policy demo_staff_delete
on public.staff
for delete
to anon, authenticated
using (true);

drop policy if exists demo_services_select on public.services;
create policy demo_services_select
on public.services
for select
to anon, authenticated
using (
  coalesce(current_setting('app.settings.demo_salon_slug', true), '') = ''
  or exists (
    select 1
    from public.salons s
    where s.id = services.salon_id
      and s.slug = current_setting('app.settings.demo_salon_slug', true)
  )
);

drop policy if exists demo_services_insert on public.services;
create policy demo_services_insert
on public.services
for insert
to anon, authenticated
with check (true);

drop policy if exists demo_services_update on public.services;
create policy demo_services_update
on public.services
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists demo_services_delete on public.services;
create policy demo_services_delete
on public.services
for delete
to anon, authenticated
using (true);

drop policy if exists public_insert_bookings_demo on public.bookings;
drop policy if exists public_select_bookings_demo on public.bookings;
drop policy if exists public_update_status_demo on public.bookings;
drop policy if exists demo_bookings_select on public.bookings;
drop policy if exists demo_bookings_insert on public.bookings;
drop policy if exists demo_bookings_update on public.bookings;

create policy demo_bookings_select
on public.bookings
for select
to anon, authenticated
using (
  coalesce(current_setting('app.settings.demo_salon_slug', true), '') = ''
  or exists (
    select 1
    from public.salons s
    where s.id = bookings.salon_id
      and s.slug = current_setting('app.settings.demo_salon_slug', true)
  )
);

create policy demo_bookings_insert
on public.bookings
for insert
to anon, authenticated
with check (
  status = 'pending'
  and customer_name is not null
  and customer_phone is not null
  and salon_id is not null
  and staff_id is not null
  and service_id is not null
  and appointment_start is not null
  and appointment_end is not null
  and appointment_end > appointment_start
);

create policy demo_bookings_update
on public.bookings
for update
to anon, authenticated
using (true)
with check (status in ('pending', 'confirmed', 'cancelled'));
