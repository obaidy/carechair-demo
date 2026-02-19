-- Multi-salon platform schema (single Supabase project)
-- DEMO RLS ONLY: This allows broad anon access for quick demos.
-- Production must restrict by authenticated users and salon ownership.

create extension if not exists pgcrypto;

-- salons
create table if not exists public.salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  whatsapp text,
  timezone text not null default 'Asia/Baghdad',
  admin_passcode text not null,
  is_active boolean not null default true,
  is_listed boolean not null default false,
  area text not null,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);

alter table public.salons
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists whatsapp text,
  add column if not exists timezone text,
  add column if not exists admin_passcode text,
  add column if not exists is_active boolean,
  add column if not exists is_listed boolean,
  add column if not exists area text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists created_at timestamptz default now();

update public.salons set timezone = 'Asia/Baghdad' where timezone is null;
update public.salons set is_active = true where is_active is null;
update public.salons set is_listed = false where is_listed is null;
update public.salons set area = 'غير محدد' where area is null;
update public.salons set admin_passcode = '1234' where admin_passcode is null or btrim(admin_passcode) = '';

alter table public.salons alter column timezone set default 'Asia/Baghdad';
alter table public.salons alter column is_active set default true;
alter table public.salons alter column is_listed set default false;
alter table public.salons alter column created_at set default now();

alter table public.salons alter column slug set not null;
alter table public.salons alter column name set not null;
alter table public.salons alter column admin_passcode set not null;
alter table public.salons alter column area set not null;

create unique index if not exists salons_slug_unique_idx on public.salons(slug);

-- services
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  duration_minutes int not null,
  price int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.services
  add column if not exists salon_id uuid,
  add column if not exists name text,
  add column if not exists duration_minutes int,
  add column if not exists price int,
  add column if not exists is_active boolean,
  add column if not exists sort_order int,
  add column if not exists created_at timestamptz default now();

update public.services set is_active = true where is_active is null;
update public.services set sort_order = 0 where sort_order is null;

alter table public.services alter column is_active set default true;
alter table public.services alter column sort_order set default 0;
alter table public.services alter column created_at set default now();

create index if not exists services_salon_idx on public.services(salon_id);

-- staff
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.staff
  add column if not exists salon_id uuid,
  add column if not exists name text,
  add column if not exists is_active boolean,
  add column if not exists sort_order int,
  add column if not exists created_at timestamptz default now();

update public.staff set is_active = true where is_active is null;
update public.staff set sort_order = 0 where sort_order is null;

alter table public.staff alter column is_active set default true;
alter table public.staff alter column sort_order set default 0;
alter table public.staff alter column created_at set default now();

create index if not exists staff_salon_idx on public.staff(salon_id);

-- staff_services
create table if not exists public.staff_services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, service_id)
);

alter table public.staff_services
  add column if not exists salon_id uuid,
  add column if not exists staff_id uuid,
  add column if not exists service_id uuid,
  add column if not exists created_at timestamptz default now();

alter table public.staff_services alter column created_at set default now();

create unique index if not exists staff_services_staff_service_unique_idx
  on public.staff_services (staff_id, service_id);

-- salon_hours
create table if not exists public.salon_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  day_of_week int not null,
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (salon_id, day_of_week)
);

alter table public.salon_hours
  add column if not exists salon_id uuid,
  add column if not exists day_of_week int,
  add column if not exists open_time time,
  add column if not exists close_time time,
  add column if not exists is_closed boolean,
  add column if not exists created_at timestamptz default now();

update public.salon_hours set is_closed = false where is_closed is null;

alter table public.salon_hours alter column is_closed set default false;
alter table public.salon_hours alter column created_at set default now();

alter table public.salon_hours drop constraint if exists salon_hours_day_of_week_check;
alter table public.salon_hours
  add constraint salon_hours_day_of_week_check
  check (day_of_week between 0 and 6);

-- bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  service_id uuid references public.services(id),
  staff_id uuid references public.staff(id),
  customer_name text not null,
  customer_phone text not null,
  notes text,
  status text not null default 'pending',
  appointment_start timestamptz not null,
  appointment_end timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists salon_id uuid,
  add column if not exists service_id uuid,
  add column if not exists staff_id uuid,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists notes text,
  add column if not exists status text,
  add column if not exists appointment_start timestamptz,
  add column if not exists appointment_end timestamptz,
  add column if not exists created_at timestamptz default now();

update public.bookings set status = 'pending' where status is null or btrim(status) = '';

alter table public.bookings alter column status set default 'pending';
alter table public.bookings alter column created_at set default now();

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending','confirmed','cancelled'));

alter table public.bookings drop constraint if exists bookings_appointment_end_after_start;
alter table public.bookings
  add constraint bookings_appointment_end_after_start
  check (appointment_end > appointment_start);

create index if not exists bookings_salon_staff_start_idx
  on public.bookings (salon_id, staff_id, appointment_start);

-- foreign keys (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_salon_id_fkey'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_salon_id_fkey'
      and conrelid = 'public.staff'::regclass
  ) then
    alter table public.staff
      add constraint staff_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_services_salon_id_fkey'
      and conrelid = 'public.staff_services'::regclass
  ) then
    alter table public.staff_services
      add constraint staff_services_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_services_staff_id_fkey'
      and conrelid = 'public.staff_services'::regclass
  ) then
    alter table public.staff_services
      add constraint staff_services_staff_id_fkey
      foreign key (staff_id) references public.staff(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_services_service_id_fkey'
      and conrelid = 'public.staff_services'::regclass
  ) then
    alter table public.staff_services
      add constraint staff_services_service_id_fkey
      foreign key (service_id) references public.services(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'salon_hours_salon_id_fkey'
      and conrelid = 'public.salon_hours'::regclass
  ) then
    alter table public.salon_hours
      add constraint salon_hours_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_salon_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_salon_id_fkey
      foreign key (salon_id) references public.salons(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_service_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_service_id_fkey
      foreign key (service_id) references public.services(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_staff_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_staff_id_fkey
      foreign key (staff_id) references public.staff(id);
  end if;
end $$;

-- RLS DEMO mode
alter table public.salons enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.salon_hours enable row level security;
alter table public.bookings enable row level security;

-- salons
 drop policy if exists demo_salons_select_all on public.salons;
 create policy demo_salons_select_all on public.salons for select to anon, authenticated using (true);

 drop policy if exists demo_salons_insert_all on public.salons;
 create policy demo_salons_insert_all on public.salons for insert to anon, authenticated with check (true);

 drop policy if exists demo_salons_update_all on public.salons;
 create policy demo_salons_update_all on public.salons for update to anon, authenticated using (true) with check (true);

-- services
 drop policy if exists demo_services_select_all on public.services;
 create policy demo_services_select_all on public.services for select to anon, authenticated using (true);

 drop policy if exists demo_services_insert_all on public.services;
 create policy demo_services_insert_all on public.services for insert to anon, authenticated with check (true);

 drop policy if exists demo_services_update_all on public.services;
 create policy demo_services_update_all on public.services for update to anon, authenticated using (true) with check (true);

 drop policy if exists demo_services_delete_all on public.services;
 create policy demo_services_delete_all on public.services for delete to anon, authenticated using (true);

-- staff
 drop policy if exists demo_staff_select_all on public.staff;
 create policy demo_staff_select_all on public.staff for select to anon, authenticated using (true);

 drop policy if exists demo_staff_insert_all on public.staff;
 create policy demo_staff_insert_all on public.staff for insert to anon, authenticated with check (true);

 drop policy if exists demo_staff_update_all on public.staff;
 create policy demo_staff_update_all on public.staff for update to anon, authenticated using (true) with check (true);

 drop policy if exists demo_staff_delete_all on public.staff;
 create policy demo_staff_delete_all on public.staff for delete to anon, authenticated using (true);

-- staff_services
 drop policy if exists demo_staff_services_select_all on public.staff_services;
 create policy demo_staff_services_select_all on public.staff_services for select to anon, authenticated using (true);

 drop policy if exists demo_staff_services_insert_all on public.staff_services;
 create policy demo_staff_services_insert_all on public.staff_services for insert to anon, authenticated with check (true);

 drop policy if exists demo_staff_services_update_all on public.staff_services;
 create policy demo_staff_services_update_all on public.staff_services for update to anon, authenticated using (true) with check (true);

 drop policy if exists demo_staff_services_delete_all on public.staff_services;
 create policy demo_staff_services_delete_all on public.staff_services for delete to anon, authenticated using (true);

-- salon_hours
 drop policy if exists demo_salon_hours_select_all on public.salon_hours;
 create policy demo_salon_hours_select_all on public.salon_hours for select to anon, authenticated using (true);

 drop policy if exists demo_salon_hours_insert_all on public.salon_hours;
 create policy demo_salon_hours_insert_all on public.salon_hours for insert to anon, authenticated with check (true);

 drop policy if exists demo_salon_hours_update_all on public.salon_hours;
 create policy demo_salon_hours_update_all on public.salon_hours for update to anon, authenticated using (true) with check (true);

 drop policy if exists demo_salon_hours_delete_all on public.salon_hours;
 create policy demo_salon_hours_delete_all on public.salon_hours for delete to anon, authenticated using (true);

-- bookings
 drop policy if exists demo_bookings_select_all on public.bookings;
 create policy demo_bookings_select_all on public.bookings for select to anon, authenticated using (true);

 drop policy if exists demo_bookings_insert_all on public.bookings;
 create policy demo_bookings_insert_all on public.bookings
 for insert to anon, authenticated
 with check (
   customer_name is not null
   and customer_phone is not null
   and status in ('pending','confirmed','cancelled')
   and appointment_end > appointment_start
 );

 drop policy if exists demo_bookings_update_all on public.bookings;
 create policy demo_bookings_update_all on public.bookings
 for update to anon, authenticated
 using (true)
 with check (
   status in ('pending','confirmed','cancelled')
 );
