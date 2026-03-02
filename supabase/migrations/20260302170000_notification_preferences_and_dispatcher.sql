create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('push')),
  type text not null check (type in ('booking_created', 'booking_updated', 'booking_status_changed', 'daily_summary')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, user_id, channel, type)
);

create index if not exists notification_preferences_salon_user_idx
  on public.notification_preferences (salon_id, user_id);

drop trigger if exists trg_notification_preferences_set_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.tg_set_updated_at();

create table if not exists public.notification_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  dispatch_key text not null unique,
  salon_id uuid not null references public.salons(id) on delete cascade,
  booking_id uuid null references public.bookings(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('push', 'whatsapp', 'sms')),
  type text not null check (type in ('booking_created', 'booking_updated', 'booking_status_changed', 'daily_summary', 'booking_reminder_24h', 'booking_reminder_2h')),
  scheduled_for timestamptz not null,
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  error text null,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz null
);

create index if not exists notification_dispatch_log_salon_idx
  on public.notification_dispatch_log (salon_id, created_at desc);

create index if not exists notification_dispatch_log_booking_idx
  on public.notification_dispatch_log (booking_id, type, scheduled_for desc);

alter table public.notification_preferences enable row level security;
alter table public.notification_dispatch_log enable row level security;

drop policy if exists notification_preferences_select_self on public.notification_preferences;
create policy notification_preferences_select_self
on public.notification_preferences
for select
using (
  auth.uid() = user_id
  and public.is_salon_member(salon_id, auth.uid())
);

drop policy if exists notification_preferences_insert_self on public.notification_preferences;
create policy notification_preferences_insert_self
on public.notification_preferences
for insert
with check (
  auth.uid() = user_id
  and public.is_salon_member(salon_id, auth.uid())
);

drop policy if exists notification_preferences_update_self on public.notification_preferences;
create policy notification_preferences_update_self
on public.notification_preferences
for update
using (
  auth.uid() = user_id
  and public.is_salon_member(salon_id, auth.uid())
)
with check (
  auth.uid() = user_id
  and public.is_salon_member(salon_id, auth.uid())
);

drop policy if exists notification_dispatch_log_select_member on public.notification_dispatch_log;
create policy notification_dispatch_log_select_member
on public.notification_dispatch_log
for select
using (public.is_salon_member(salon_id, auth.uid()));

create extension if not exists pg_net;

create or replace function public.invoke_dispatch_scheduled_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_url text := current_setting('app.settings.supabase_url', true);
begin
  if coalesce(v_project_url, '') = '' then
    raise warning 'Missing app.settings.supabase_url for dispatch-scheduled-reminders';
    return;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/dispatch-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
end;
$$;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable, schedule dispatch-scheduled-reminders in Supabase dashboard instead.';
    return;
  end;

  if exists (select 1 from cron.job where jobname = 'carechair-dispatch-scheduled-reminders') then
    perform cron.unschedule('carechair-dispatch-scheduled-reminders');
  end if;

  perform cron.schedule(
    'carechair-dispatch-scheduled-reminders',
    '*/10 * * * *',
    $cron$select public.invoke_dispatch_scheduled_reminders();$cron$
  );
exception
  when undefined_table then
    raise notice 'cron.job unavailable, schedule dispatch-scheduled-reminders manually.';
  when others then
    raise notice 'Could not schedule dispatch-scheduled-reminders automatically: %', sqlerrm;
end;
$$;
