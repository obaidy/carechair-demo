-- 1) Schema updates for bookings
alter table public.bookings
  add column if not exists salon_whatsapp text;

alter table public.bookings
  alter column status set default 'pending';

update public.bookings
set status = 'pending'
where status is null or btrim(status) = '';

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));

-- Normalize existing phones to E.164 digits-only (without +)
update public.bookings
set customer_phone = regexp_replace(customer_phone, '\\D', '', 'g')
where customer_phone is not null;

update public.bookings
set salon_whatsapp = regexp_replace(salon_whatsapp, '\\D', '', 'g')
where salon_whatsapp is not null;

-- 2) Keep RLS enabled and add demo policies
alter table public.bookings enable row level security;

drop policy if exists public_insert_bookings_demo on public.bookings;
create policy public_insert_bookings_demo
on public.bookings
for insert
to anon, authenticated
with check (
  status = 'pending'
  and customer_name is not null
  and customer_phone ~ '^[0-9]{8,15}$'
  and salon_whatsapp ~ '^[0-9]{8,15}$'
);

drop policy if exists public_select_bookings_demo on public.bookings;
create policy public_select_bookings_demo
on public.bookings
for select
to anon, authenticated
using (true);

drop policy if exists public_update_status_demo on public.bookings;
create policy public_update_status_demo
on public.bookings
for update
to anon, authenticated
using (true)
with check (status in ('pending', 'confirmed', 'cancelled'));

-- 3) Trigger -> Edge Function notifier
create extension if not exists pg_net;

create or replace function public.send_booking_whatsapp_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template text;
  v_to text;
  v_payload jsonb;
  v_project_url text := current_setting('app.settings.supabase_url', true);
  v_anon_key text := current_setting('app.settings.anon_key', true);
begin
  if tg_op = 'INSERT' then
    v_template := 'booking_created';
    v_to := new.salon_whatsapp;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'confirmed' then
      v_template := 'booking_confirmed';
      v_to := new.customer_phone;
    elsif new.status = 'cancelled' then
      v_template := 'booking_cancelled';
      v_to := new.customer_phone;
    else
      return new;
    end if;
  else
    return new;
  end if;

  if coalesce(v_to, '') = '' then
    return new;
  end if;

  if v_project_url is null or v_anon_key is null then
    raise warning 'Missing app.settings.supabase_url or app.settings.anon_key';
    return new;
  end if;

  v_payload := jsonb_build_object(
    'to', regexp_replace(v_to, '\\D', '', 'g'),
    'template', v_template,
    'data', jsonb_build_object(
      'id', new.id,
      'salon_slug', new.salon_slug,
      'salon_whatsapp', new.salon_whatsapp,
      'customer_name', new.customer_name,
      'customer_phone', new.customer_phone,
      'service', new.service,
      'staff', new.staff,
      'appointment_at', new.appointment_at,
      'status', new.status,
      'notes', new.notes
    )
  );

  perform net.http_post(
    url := v_project_url || '/functions/v1/send-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := v_payload
  );

  return new;
end;
$$;

drop trigger if exists trg_bookings_whatsapp_insert on public.bookings;
create trigger trg_bookings_whatsapp_insert
after insert on public.bookings
for each row
execute function public.send_booking_whatsapp_notification();

drop trigger if exists trg_bookings_whatsapp_status on public.bookings;
create trigger trg_bookings_whatsapp_status
after update of status on public.bookings
for each row
when (new.status is distinct from old.status)
execute function public.send_booking_whatsapp_notification();
