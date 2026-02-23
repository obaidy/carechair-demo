-- Salon Calendar V1 foundation (additive, safe)

create table if not exists public.salon_working_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (salon_id, day_of_week)
);

create table if not exists public.employee_working_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  employee_id uuid not null references public.staff(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  is_closed boolean not null default false,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  unique (employee_id, day_of_week)
);

create index if not exists idx_salon_working_hours_salon_id on public.salon_working_hours(salon_id);
create index if not exists idx_employee_working_hours_salon_id on public.employee_working_hours(salon_id);
create index if not exists idx_employee_working_hours_employee_id on public.employee_working_hours(employee_id);

create index if not exists idx_bookings_salon_start on public.bookings(salon_id, appointment_start);
create index if not exists idx_bookings_staff_start on public.bookings(staff_id, appointment_start);

-- Backfill from existing tables if present and target empty.
insert into public.salon_working_hours (salon_id, day_of_week, start_time, end_time, is_closed)
select sh.salon_id, sh.day_of_week, sh.open_time, sh.close_time, coalesce(sh.is_closed, false)
from public.salon_hours sh
where not exists (
  select 1
  from public.salon_working_hours swh
  where swh.salon_id = sh.salon_id
    and swh.day_of_week = sh.day_of_week
);

insert into public.employee_working_hours (salon_id, employee_id, day_of_week, start_time, end_time, is_closed, break_start, break_end)
select eh.salon_id, eh.staff_id, eh.day_of_week, eh.start_time, eh.end_time, coalesce(eh.is_off, false), eh.break_start, eh.break_end
from public.employee_hours eh
where not exists (
  select 1
  from public.employee_working_hours ewh
  where ewh.employee_id = eh.staff_id
    and ewh.day_of_week = eh.day_of_week
);

-- Ensure calendar status workflow supports no_show
alter table public.bookings alter column status set default 'pending';

-- Drop any existing status check constraints and re-create safely.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.bookings drop constraint if exists %I', c.conname);
  end loop;

  alter table public.bookings
    add constraint bookings_status_check
    check (status in ('pending','confirmed','cancelled','no_show'));
exception
  when duplicate_object then
    null;
end
$$;
