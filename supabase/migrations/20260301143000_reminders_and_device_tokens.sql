create table if not exists public.salon_reminders (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'push')),
  type text not null check (type in ('booking_confirmed', 'booking_reminder_24h', 'booking_reminder_2h', 'follow_up')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists salon_reminders_unique_rule_idx
  on public.salon_reminders (salon_id, channel, type);

create index if not exists salon_reminders_salon_idx
  on public.salon_reminders (salon_id);

drop trigger if exists trg_salon_reminders_set_updated_at on public.salon_reminders;
create trigger trg_salon_reminders_set_updated_at
before update on public.salon_reminders
for each row
execute function public.tg_set_updated_at();

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'unknown',
  disabled_at timestamptz null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_salon_idx
  on public.device_tokens (salon_id);

create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id);

drop trigger if exists trg_device_tokens_set_updated_at on public.device_tokens;
create trigger trg_device_tokens_set_updated_at
before update on public.device_tokens
for each row
execute function public.tg_set_updated_at();

alter table public.salon_reminders enable row level security;
alter table public.device_tokens enable row level security;

drop policy if exists salon_reminders_select_member on public.salon_reminders;
create policy salon_reminders_select_member
on public.salon_reminders
for select
using (public.is_salon_member(salon_id, auth.uid()));

drop policy if exists salon_reminders_insert_owner_manager on public.salon_reminders;
create policy salon_reminders_insert_owner_manager
on public.salon_reminders
for insert
with check (
  public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

drop policy if exists salon_reminders_update_owner_manager on public.salon_reminders;
create policy salon_reminders_update_owner_manager
on public.salon_reminders
for update
using (
  public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
)
with check (
  public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

drop policy if exists device_tokens_select_self_or_manager on public.device_tokens;
create policy device_tokens_select_self_or_manager
on public.device_tokens
for select
using (
  auth.uid() = user_id
  or public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

drop policy if exists device_tokens_insert_self_member on public.device_tokens;
create policy device_tokens_insert_self_member
on public.device_tokens
for insert
with check (
  auth.uid() = user_id
  and public.is_salon_member(salon_id, auth.uid())
);

drop policy if exists device_tokens_update_self_or_manager on public.device_tokens;
create policy device_tokens_update_self_or_manager
on public.device_tokens
for update
using (
  auth.uid() = user_id
  or public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
)
with check (
  auth.uid() = user_id
  or public.member_role(salon_id, auth.uid()) in ('OWNER', 'MANAGER')
);

insert into public.salon_reminders (salon_id, channel, type, enabled)
select s.id, seed.channel, seed.type, false
from public.salons s
cross join (
  values
    ('sms', 'booking_confirmed'),
    ('whatsapp', 'booking_reminder_24h'),
    ('whatsapp', 'booking_reminder_2h'),
    ('push', 'booking_confirmed')
) as seed(channel, type)
on conflict (salon_id, channel, type) do nothing;
