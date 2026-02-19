-- Salon OS foundation (additive, demo-friendly)
create extension if not exists pgcrypto;

-- 1) Employee scheduling
create table if not exists public.employee_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time,
  end_time time,
  is_off boolean not null default false,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, day_of_week),
  constraint employee_hours_break_order_chk check (
    break_start is null
    or break_end is null
    or break_end > break_start
  )
);

create table if not exists public.employee_time_off (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint employee_time_off_range_chk check (end_at > start_at)
);

-- 2) Clients CRM
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  name text,
  phone text not null,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (salon_id, phone)
);

-- 3) Bookings additive fields for CRM + reporting
alter table public.bookings
  add column if not exists client_id uuid,
  add column if not exists price_amount int,
  add column if not exists currency text default 'USD';

-- Ensure salon_id exists (multi-salon). If missing, add nullable first to avoid breaking old rows.
alter table public.bookings
  add column if not exists salon_id uuid references public.salons(id) on delete cascade;

-- Add FK only if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_client_id_fkey'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Commissions (phase-ready)
create table if not exists public.commissions_rules (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  type text not null check (type in ('percent', 'fixed')),
  value numeric not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.commissions_ledger (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- 5) Expenses (phase-ready)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  category text,
  amount numeric not null,
  occurred_on date,
  note text,
  created_at timestamptz not null default now()
);

-- 6) Salon booking mode toggle
alter table public.salons
  add column if not exists booking_mode text not null default 'choose_employee';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'salons_booking_mode_chk'
      AND conrelid = 'public.salons'::regclass
  ) THEN
    ALTER TABLE public.salons
      ADD CONSTRAINT salons_booking_mode_chk
      CHECK (booking_mode in ('choose_employee', 'auto_assign'));
  END IF;
END $$;

-- Indexes for scale
create index if not exists idx_employee_hours_salon on public.employee_hours(salon_id);
create index if not exists idx_employee_hours_staff on public.employee_hours(staff_id);
create index if not exists idx_employee_time_off_salon on public.employee_time_off(salon_id);
create index if not exists idx_employee_time_off_staff on public.employee_time_off(staff_id);
create index if not exists idx_employee_time_off_range on public.employee_time_off(start_at, end_at);
create index if not exists idx_clients_salon on public.clients(salon_id);
create index if not exists idx_clients_phone on public.clients(phone);
create index if not exists idx_bookings_salon_start on public.bookings(salon_id, appointment_start);
create index if not exists idx_bookings_client on public.bookings(client_id);
create index if not exists idx_bookings_price_amount on public.bookings(price_amount);
create index if not exists idx_comm_rules_salon on public.commissions_rules(salon_id);
create index if not exists idx_comm_ledger_salon on public.commissions_ledger(salon_id);
create index if not exists idx_comm_ledger_booking on public.commissions_ledger(booking_id);
create index if not exists idx_expenses_salon on public.expenses(salon_id);
create index if not exists idx_expenses_date on public.expenses(occurred_on);

-- DEMO RLS (open). IMPORTANT: lock this down with auth + salon scoping in production.
alter table public.employee_hours enable row level security;
alter table public.employee_time_off enable row level security;
alter table public.clients enable row level security;
alter table public.commissions_rules enable row level security;
alter table public.commissions_ledger enable row level security;
alter table public.expenses enable row level security;

drop policy if exists demo_employee_hours_select on public.employee_hours;
drop policy if exists demo_employee_hours_insert on public.employee_hours;
drop policy if exists demo_employee_hours_update on public.employee_hours;
drop policy if exists demo_employee_hours_delete on public.employee_hours;
create policy demo_employee_hours_select on public.employee_hours for select using (true);
create policy demo_employee_hours_insert on public.employee_hours for insert with check (true);
create policy demo_employee_hours_update on public.employee_hours for update using (true) with check (true);
create policy demo_employee_hours_delete on public.employee_hours for delete using (true);

drop policy if exists demo_employee_time_off_select on public.employee_time_off;
drop policy if exists demo_employee_time_off_insert on public.employee_time_off;
drop policy if exists demo_employee_time_off_update on public.employee_time_off;
drop policy if exists demo_employee_time_off_delete on public.employee_time_off;
create policy demo_employee_time_off_select on public.employee_time_off for select using (true);
create policy demo_employee_time_off_insert on public.employee_time_off for insert with check (true);
create policy demo_employee_time_off_update on public.employee_time_off for update using (true) with check (true);
create policy demo_employee_time_off_delete on public.employee_time_off for delete using (true);

drop policy if exists demo_clients_select on public.clients;
drop policy if exists demo_clients_insert on public.clients;
drop policy if exists demo_clients_update on public.clients;
drop policy if exists demo_clients_delete on public.clients;
create policy demo_clients_select on public.clients for select using (true);
create policy demo_clients_insert on public.clients for insert with check (true);
create policy demo_clients_update on public.clients for update using (true) with check (true);
create policy demo_clients_delete on public.clients for delete using (true);

drop policy if exists demo_comm_rules_select on public.commissions_rules;
drop policy if exists demo_comm_rules_insert on public.commissions_rules;
drop policy if exists demo_comm_rules_update on public.commissions_rules;
drop policy if exists demo_comm_rules_delete on public.commissions_rules;
create policy demo_comm_rules_select on public.commissions_rules for select using (true);
create policy demo_comm_rules_insert on public.commissions_rules for insert with check (true);
create policy demo_comm_rules_update on public.commissions_rules for update using (true) with check (true);
create policy demo_comm_rules_delete on public.commissions_rules for delete using (true);

drop policy if exists demo_comm_ledger_select on public.commissions_ledger;
drop policy if exists demo_comm_ledger_insert on public.commissions_ledger;
drop policy if exists demo_comm_ledger_update on public.commissions_ledger;
drop policy if exists demo_comm_ledger_delete on public.commissions_ledger;
create policy demo_comm_ledger_select on public.commissions_ledger for select using (true);
create policy demo_comm_ledger_insert on public.commissions_ledger for insert with check (true);
create policy demo_comm_ledger_update on public.commissions_ledger for update using (true) with check (true);
create policy demo_comm_ledger_delete on public.commissions_ledger for delete using (true);

drop policy if exists demo_expenses_select on public.expenses;
drop policy if exists demo_expenses_insert on public.expenses;
drop policy if exists demo_expenses_update on public.expenses;
drop policy if exists demo_expenses_delete on public.expenses;
create policy demo_expenses_select on public.expenses for select using (true);
create policy demo_expenses_insert on public.expenses for insert with check (true);
create policy demo_expenses_update on public.expenses for update using (true) with check (true);
create policy demo_expenses_delete on public.expenses for delete using (true);
