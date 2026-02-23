-- Complete salon onboarding foundation (wizard backend)
-- Idempotent additions only.

create extension if not exists pgcrypto;

-- Staff fields needed by onboarding
alter table public.staff
  add column if not exists role text,
  add column if not exists phone text;

-- Service metadata for onboarding step
alter table public.services
  add column if not exists category text;

-- Compatibility junction requested by onboarding spec
create table if not exists public.service_staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (service_id, staff_id)
);

create index if not exists service_staff_salon_idx on public.service_staff(salon_id);
create index if not exists service_staff_service_idx on public.service_staff(service_id);
create index if not exists service_staff_staff_idx on public.service_staff(staff_id);

-- Keep service_staff synced from the canonical staff_services table used by the app.
create or replace function public.sync_staff_services_to_service_staff()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.service_staff
    where service_id = old.service_id
      and staff_id = old.staff_id;
    return old;
  end if;

  insert into public.service_staff (salon_id, service_id, staff_id)
  values (new.salon_id, new.service_id, new.staff_id)
  on conflict (service_id, staff_id)
  do update set salon_id = excluded.salon_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_staff_services_to_service_staff on public.staff_services;
create trigger trg_sync_staff_services_to_service_staff
after insert or update or delete on public.staff_services
for each row
execute function public.sync_staff_services_to_service_staff();

-- Backfill existing mappings
insert into public.service_staff (salon_id, service_id, staff_id)
select ss.salon_id, ss.service_id, ss.staff_id
from public.staff_services ss
on conflict (service_id, staff_id) do nothing;

-- Optional compatibility view name requested by onboarding brief
create or replace view public.employees as
select * from public.staff;

-- Ensure onboarding media bucket exists
insert into storage.buckets (id, name, public)
values ('carechair-media', 'carechair-media', true)
on conflict (id) do nothing;

alter table public.service_staff enable row level security;

-- DEMO mode write policies. Restrict in production.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'service_staff'
      and policyname = 'demo_service_staff_select'
  ) then
    create policy demo_service_staff_select
    on public.service_staff
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'service_staff'
      and policyname = 'demo_service_staff_write'
  ) then
    create policy demo_service_staff_write
    on public.service_staff
    for all
    to anon, authenticated
    using (true)
    with check (true);
  end if;
end $$;

-- Transactional onboarding RPC
create or replace function public.create_salon_onboarding(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_salon_id uuid := coalesce((payload #>> '{salon,id}')::uuid, gen_random_uuid());
  v_name text := trim(coalesce(payload #>> '{salon,name}', ''));
  v_slug text := trim(coalesce(payload #>> '{salon,slug}', payload #>> '{salon,name}', ''));
  v_country_code text := upper(trim(coalesce(payload #>> '{salon,country_code}', 'IQ')));
  v_city text := trim(coalesce(payload #>> '{salon,city}', ''));
  v_whatsapp text := trim(coalesce(payload #>> '{salon,whatsapp}', ''));
  v_logo_url text := nullif(trim(coalesce(payload #>> '{salon,logo_url}', '')), '');
  v_cover_url text := nullif(trim(coalesce(payload #>> '{salon,cover_image_url}', '')), '');
  v_admin_passcode text := trim(coalesce(payload #>> '{salon,admin_passcode}', ''));
  v_language_default text := lower(trim(coalesce(payload #>> '{salon,language_default}', 'en')));
  v_trial_days integer := 7;
  v_trial_end timestamptz;
  v_country record;
  v_has_salon_working_hours boolean;
  v_has_employee_working_hours boolean;
  v_emp jsonb;
  v_srv jsonb;
  v_hour jsonb;
  v_emp_id uuid;
  v_srv_id uuid;
  v_order int := 0;
begin
  if v_name = '' then
    raise exception using errcode = '23514', message = 'salon_name_required';
  end if;

  if v_slug = '' then
    raise exception using errcode = '23514', message = 'salon_slug_required';
  end if;

  v_slug := regexp_replace(v_slug, '\\s+', '-', 'g');
  if exists (select 1 from public.salons s where s.slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(v_salon_id::text, '-', ''), 1, 6);
  end if;

  if v_admin_passcode = '' then
    v_admin_passcode := lpad(((random() * 8999)::int + 1000)::text, 4, '0');
  end if;

  select *
  into v_country
  from public.countries c
  where c.code = v_country_code
    and c.is_enabled = true
  limit 1;

  if not found then
    raise exception using errcode = '23514', message = 'country_not_enabled';
  end if;

  v_trial_days := greatest(coalesce(v_country.trial_days_default, 7), 1);
  v_trial_end := v_now + make_interval(days => v_trial_days);

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'salon_working_hours'
  ) into v_has_salon_working_hours;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employee_working_hours'
  ) into v_has_employee_working_hours;

  insert into public.salons (
    id,
    slug,
    name,
    whatsapp,
    area,
    admin_passcode,
    country_code,
    currency_code,
    timezone,
    language_default,
    trial_end_at,
    subscription_status,
    billing_status,
    is_active,
    is_listed,
    cover_image_url,
    logo_url
  )
  values (
    v_salon_id,
    v_slug,
    v_name,
    nullif(v_whatsapp, ''),
    coalesce(nullif(v_city, ''), 'غير محدد'),
    v_admin_passcode,
    v_country.code,
    v_country.default_currency,
    v_country.timezone_default,
    coalesce(nullif(v_language_default, ''), 'en'),
    v_trial_end,
    'trialing',
    'trialing',
    true,
    true,
    v_cover_url,
    v_logo_url
  );

  -- Salon weekly hours
  for v_hour in
    select jsonb_array_elements(coalesce(payload -> 'working_hours', '[]'::jsonb))
  loop
    insert into public.salon_hours (salon_id, day_of_week, open_time, close_time, is_closed)
    values (
      v_salon_id,
      coalesce((v_hour ->> 'day_of_week')::int, 0),
      case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'open_time', '')::time end,
      case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'close_time', '')::time end,
      coalesce((v_hour ->> 'is_closed')::boolean, false)
    )
    on conflict (salon_id, day_of_week)
    do update
      set open_time = excluded.open_time,
          close_time = excluded.close_time,
          is_closed = excluded.is_closed;

    if v_has_salon_working_hours then
      insert into public.salon_working_hours (salon_id, day_of_week, start_time, end_time, is_closed)
      values (
        v_salon_id,
        coalesce((v_hour ->> 'day_of_week')::int, 0),
        case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'open_time', '')::time end,
        case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'close_time', '')::time end,
        coalesce((v_hour ->> 'is_closed')::boolean, false)
      )
      on conflict (salon_id, day_of_week)
      do update
        set start_time = excluded.start_time,
            end_time = excluded.end_time,
            is_closed = excluded.is_closed;
    end if;
  end loop;

  -- If no hours were provided, seed defaults.
  if not exists (select 1 from public.salon_hours sh where sh.salon_id = v_salon_id) then
    insert into public.salon_hours (salon_id, day_of_week, open_time, close_time, is_closed)
    select v_salon_id, d, '10:00'::time, '20:00'::time, false
    from generate_series(0, 6) d
    on conflict (salon_id, day_of_week)
    do nothing;

    if v_has_salon_working_hours then
      insert into public.salon_working_hours (salon_id, day_of_week, start_time, end_time, is_closed)
      select v_salon_id, d, '10:00'::time, '20:00'::time, false
      from generate_series(0, 6) d
      on conflict (salon_id, day_of_week)
      do nothing;
    end if;
  end if;

  -- Employees
  for v_emp in
    select jsonb_array_elements(coalesce(payload -> 'employees', '[]'::jsonb))
  loop
    if trim(coalesce(v_emp ->> 'name', '')) = '' then
      continue;
    end if;

    v_order := v_order + 10;
    v_emp_id := coalesce((v_emp ->> 'id')::uuid, gen_random_uuid());

    insert into public.staff (id, salon_id, name, role, phone, photo_url, is_active, sort_order)
    values (
      v_emp_id,
      v_salon_id,
      trim(v_emp ->> 'name'),
      nullif(trim(coalesce(v_emp ->> 'role', '')), ''),
      nullif(trim(coalesce(v_emp ->> 'phone', '')), ''),
      nullif(trim(coalesce(v_emp ->> 'avatar_url', '')), ''),
      true,
      coalesce(nullif((v_emp ->> 'sort_order')::int, 0), v_order)
    )
    on conflict (id)
    do update
      set salon_id = excluded.salon_id,
          name = excluded.name,
          role = excluded.role,
          phone = excluded.phone,
          photo_url = excluded.photo_url,
          is_active = excluded.is_active,
          sort_order = excluded.sort_order;

    if coalesce((v_emp ->> 'same_hours_as_salon')::boolean, true) then
      insert into public.employee_hours (salon_id, staff_id, day_of_week, start_time, end_time, is_off, break_start, break_end)
      select
        v_salon_id,
        v_emp_id,
        sh.day_of_week,
        sh.open_time,
        sh.close_time,
        sh.is_closed,
        null,
        null
      from public.salon_hours sh
      where sh.salon_id = v_salon_id
      on conflict (staff_id, day_of_week)
      do update
        set start_time = excluded.start_time,
            end_time = excluded.end_time,
            is_off = excluded.is_off,
            break_start = excluded.break_start,
            break_end = excluded.break_end,
            salon_id = excluded.salon_id;

      if v_has_employee_working_hours then
        insert into public.employee_working_hours (salon_id, employee_id, day_of_week, start_time, end_time, is_closed)
        select
          v_salon_id,
          v_emp_id,
          sh.day_of_week,
          sh.open_time,
          sh.close_time,
          sh.is_closed
        from public.salon_hours sh
        where sh.salon_id = v_salon_id
        on conflict (employee_id, day_of_week)
        do update
          set start_time = excluded.start_time,
              end_time = excluded.end_time,
              is_closed = excluded.is_closed,
              salon_id = excluded.salon_id;
      end if;
    else
      for v_hour in
        select jsonb_array_elements(coalesce(v_emp -> 'working_hours', '[]'::jsonb))
      loop
        insert into public.employee_hours (salon_id, staff_id, day_of_week, start_time, end_time, is_off, break_start, break_end)
        values (
          v_salon_id,
          v_emp_id,
          coalesce((v_hour ->> 'day_of_week')::int, 0),
          case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'open_time', '')::time end,
          case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'close_time', '')::time end,
          coalesce((v_hour ->> 'is_closed')::boolean, false),
          null,
          null
        )
        on conflict (staff_id, day_of_week)
        do update
          set start_time = excluded.start_time,
              end_time = excluded.end_time,
              is_off = excluded.is_off,
              break_start = excluded.break_start,
              break_end = excluded.break_end,
              salon_id = excluded.salon_id;

        if v_has_employee_working_hours then
          insert into public.employee_working_hours (salon_id, employee_id, day_of_week, start_time, end_time, is_closed)
          values (
            v_salon_id,
            v_emp_id,
            coalesce((v_hour ->> 'day_of_week')::int, 0),
            case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'open_time', '')::time end,
            case when coalesce((v_hour ->> 'is_closed')::boolean, false) then null else nullif(v_hour ->> 'close_time', '')::time end,
            coalesce((v_hour ->> 'is_closed')::boolean, false)
          )
          on conflict (employee_id, day_of_week)
          do update
            set start_time = excluded.start_time,
                end_time = excluded.end_time,
                is_closed = excluded.is_closed,
                salon_id = excluded.salon_id;
        end if;
      end loop;
    end if;
  end loop;

  -- Services + assignments
  v_order := 0;
  for v_srv in
    select jsonb_array_elements(coalesce(payload -> 'services', '[]'::jsonb))
  loop
    if trim(coalesce(v_srv ->> 'name', '')) = '' then
      continue;
    end if;

    v_order := v_order + 10;
    v_srv_id := coalesce((v_srv ->> 'id')::uuid, gen_random_uuid());

    insert into public.services (
      id,
      salon_id,
      name,
      duration_minutes,
      price,
      category,
      image_url,
      is_active,
      sort_order
    )
    values (
      v_srv_id,
      v_salon_id,
      trim(v_srv ->> 'name'),
      greatest(coalesce((v_srv ->> 'duration_minutes')::int, 30), 5),
      greatest(coalesce((v_srv ->> 'price')::int, 0), 0),
      nullif(trim(coalesce(v_srv ->> 'category', '')), ''),
      nullif(trim(coalesce(v_srv ->> 'image_url', '')), ''),
      true,
      coalesce(nullif((v_srv ->> 'sort_order')::int, 0), v_order)
    )
    on conflict (id)
    do update
      set salon_id = excluded.salon_id,
          name = excluded.name,
          duration_minutes = excluded.duration_minutes,
          price = excluded.price,
          category = excluded.category,
          image_url = excluded.image_url,
          is_active = excluded.is_active,
          sort_order = excluded.sort_order;

    insert into public.staff_services (salon_id, staff_id, service_id)
    select v_salon_id, (jsonb_array_elements_text(coalesce(v_srv -> 'employee_ids', '[]'::jsonb)))::uuid, v_srv_id
    on conflict (staff_id, service_id)
    do update set salon_id = excluded.salon_id;

    insert into public.service_staff (salon_id, staff_id, service_id)
    select v_salon_id, (jsonb_array_elements_text(coalesce(v_srv -> 'employee_ids', '[]'::jsonb)))::uuid, v_srv_id
    on conflict (service_id, staff_id)
    do update set salon_id = excluded.salon_id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'salon_id', v_salon_id,
    'slug', v_slug,
    'booking_path', '/s/' || v_slug,
    'admin_path', '/s/' || v_slug || '/admin',
    'admin_passcode', v_admin_passcode,
    'trial_end_at', v_trial_end
  );
end;
$$;

grant execute on function public.create_salon_onboarding(jsonb) to anon, authenticated;
