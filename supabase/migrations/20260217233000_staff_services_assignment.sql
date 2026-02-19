-- staff <-> services assignment + demo-friendly RLS
-- مهم: هذي السياسات للتجربة فقط، لازم تتقيد بالإنتاج.

create extension if not exists pgcrypto;

-- 1) Staff/services structure updates
alter table public.staff
  add column if not exists updated_at timestamptz not null default now();

alter table public.services
  add column if not exists updated_at timestamptz not null default now();

-- 2) Junction table: staff_services
create table if not exists public.staff_services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, service_id)
);

create index if not exists staff_services_salon_idx
  on public.staff_services (salon_id);

create index if not exists staff_services_staff_idx
  on public.staff_services (staff_id);

create index if not exists staff_services_service_idx
  on public.staff_services (service_id);

create unique index if not exists staff_services_staff_service_unique_idx
  on public.staff_services (staff_id, service_id);

-- 3) Keep bookings references present
alter table public.bookings
  add column if not exists staff_id uuid,
  add column if not exists service_id uuid;

-- 4) updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_staff_set_updated_at on public.staff;
create trigger trg_staff_set_updated_at
before update on public.staff
for each row
execute function public.set_updated_at();

drop trigger if exists trg_services_set_updated_at on public.services;
create trigger trg_services_set_updated_at
before update on public.services
for each row
execute function public.set_updated_at();

-- 5) Enforce that booking staff/service pair must exist in staff_services
create or replace function public.enforce_booking_staff_service_match()
returns trigger
language plpgsql
as $$
begin
  if new.staff_id is null or new.service_id is null or new.salon_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.staff_services ss
    where ss.salon_id = new.salon_id
      and ss.staff_id = new.staff_id
      and ss.service_id = new.service_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'invalid_staff_service_assignment';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bookings_staff_service_match on public.bookings;
create trigger trg_bookings_staff_service_match
before insert or update of staff_id, service_id, salon_id
on public.bookings
for each row
execute function public.enforce_booking_staff_service_match();

-- 6) Demo RLS policies
alter table public.salons enable row level security;
alter table public.salon_hours enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.bookings enable row level security;

-- Optional salon scope via DB setting:
-- alter database postgres set app.settings.demo_salon_slug = 'صالون الملكة - بغداد';

-- salons
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

-- salon_hours
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

-- staff
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

-- services
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

-- staff_services
drop policy if exists demo_staff_services_select on public.staff_services;
create policy demo_staff_services_select
on public.staff_services
for select
to anon, authenticated
using (
  coalesce(current_setting('app.settings.demo_salon_slug', true), '') = ''
  or exists (
    select 1
    from public.salons s
    where s.id = staff_services.salon_id
      and s.slug = current_setting('app.settings.demo_salon_slug', true)
  )
);

drop policy if exists demo_staff_services_insert on public.staff_services;
create policy demo_staff_services_insert
on public.staff_services
for insert
to anon, authenticated
with check (true);

drop policy if exists demo_staff_services_update on public.staff_services;
create policy demo_staff_services_update
on public.staff_services
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists demo_staff_services_delete on public.staff_services;
create policy demo_staff_services_delete
on public.staff_services
for delete
to anon, authenticated
using (true);

-- bookings
drop policy if exists demo_bookings_select on public.bookings;
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

drop policy if exists demo_bookings_insert on public.bookings;
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

drop policy if exists demo_bookings_update on public.bookings;
create policy demo_bookings_update
on public.bookings
for update
to anon, authenticated
using (true)
with check (status in ('pending', 'confirmed', 'cancelled'));
