-- Superadmin overview metrics: salon health + global stats
-- Lightweight SQL views + secure RPC access via superadmin code check.

create extension if not exists pgcrypto;

create or replace view public.superadmin_salon_health as
with booking_base as (
  select
    b.id,
    b.salon_id,
    coalesce(b.appointment_start, b.created_at) as booking_at,
    nullif(regexp_replace(coalesce(b.customer_phone, ''), '\\D', '', 'g'), '') as customer_phone
  from public.bookings b
),
customers_30 as (
  select
    bb.salon_id,
    bb.customer_phone,
    count(*) as bookings_count
  from booking_base bb
  where bb.customer_phone is not null
    and bb.booking_at >= now() - interval '30 days'
  group by bb.salon_id, bb.customer_phone
),
customer_first_by_salon as (
  select
    bb.salon_id,
    bb.customer_phone,
    min(bb.booking_at) as first_booking_at
  from booking_base bb
  where bb.customer_phone is not null
  group by bb.salon_id, bb.customer_phone
),
bookings_agg as (
  select
    bb.salon_id,
    count(*)::bigint as total_bookings,
    count(*) filter (where bb.booking_at >= now() - interval '7 days')::bigint as bookings_last_7_days,
    count(*) filter (where bb.booking_at >= now() - interval '30 days')::bigint as bookings_last_30_days,
    max(bb.booking_at) as last_booking_at,
    count(distinct bb.customer_phone) filter (where bb.customer_phone is not null)::bigint as total_customers,
    count(distinct bb.customer_phone) filter (
      where bb.customer_phone is not null
        and bb.booking_at >= now() - interval '30 days'
    )::bigint as customers_last_30_days
  from booking_base bb
  group by bb.salon_id
),
repeat_30 as (
  select
    c.salon_id,
    count(*)::bigint as repeat_customers_last_30_days
  from customers_30 c
  where c.bookings_count > 1
  group by c.salon_id
),
new_30 as (
  select
    c.salon_id,
    count(*)::bigint as new_customers_last_30_days
  from customer_first_by_salon c
  where c.first_booking_at >= now() - interval '30 days'
  group by c.salon_id
)
select
  s.id as salon_id,
  s.name as salon_name,
  s.country_code,
  s.status,
  s.is_active,
  s.is_listed,
  s.trial_end_at,
  coalesce(s.subscription_status, s.billing_status, 'inactive') as subscription_status,
  coalesce(st.cnt, 0)::bigint as staff_count,
  coalesce(sv.cnt, 0)::bigint as services_count,
  coalesce(ba.total_bookings, 0)::bigint as total_bookings,
  coalesce(ba.bookings_last_7_days, 0)::bigint as bookings_last_7_days,
  coalesce(ba.bookings_last_30_days, 0)::bigint as bookings_last_30_days,
  ba.last_booking_at,
  coalesce(ba.total_customers, 0)::bigint as total_customers,
  coalesce(ba.customers_last_30_days, 0)::bigint as customers_last_30_days,
  coalesce(n30.new_customers_last_30_days, 0)::bigint as new_customers_last_30_days,
  coalesce(r30.repeat_customers_last_30_days, 0)::bigint as repeat_customers_last_30_days
from public.salons s
left join (
  select salon_id, count(*) as cnt
  from public.staff
  group by salon_id
) st on st.salon_id = s.id
left join (
  select salon_id, count(*) as cnt
  from public.services
  group by salon_id
) sv on sv.salon_id = s.id
left join bookings_agg ba on ba.salon_id = s.id
left join new_30 n30 on n30.salon_id = s.id
left join repeat_30 r30 on r30.salon_id = s.id;

create or replace view public.superadmin_global_stats as
with booking_base as (
  select
    b.id,
    b.salon_id,
    coalesce(b.appointment_start, b.created_at) as booking_at,
    nullif(regexp_replace(coalesce(b.customer_phone, ''), '\\D', '', 'g'), '') as customer_phone
  from public.bookings b
),
customer_first as (
  select
    bb.customer_phone,
    min(bb.booking_at) as first_booking_at
  from booking_base bb
  where bb.customer_phone is not null
  group by bb.customer_phone
),
customer_30 as (
  select
    bb.customer_phone,
    count(*) as bookings_count
  from booking_base bb
  where bb.customer_phone is not null
    and bb.booking_at >= now() - interval '30 days'
  group by bb.customer_phone
)
select
  (select count(*)::bigint from public.salons) as total_salons,
  (select count(*)::bigint from public.salons where status = 'pending_approval') as pending_approval_count,
  (select count(*)::bigint from public.salons where status = 'trialing') as trialing_count,
  (select count(*)::bigint from public.salons where status = 'active') as active_count,
  (select count(*)::bigint from public.salons where status = 'past_due') as past_due_count,
  (select count(*)::bigint from public.salons where status = 'suspended') as suspended_count,

  (select count(*)::bigint from booking_base) as total_bookings,
  (select count(*)::bigint from booking_base where booking_at >= date_trunc('day', now())) as bookings_today,
  (select count(*)::bigint from booking_base where booking_at >= now() - interval '7 days') as bookings_last_7_days,
  (select count(*)::bigint from booking_base where booking_at >= now() - interval '30 days') as bookings_last_30_days,

  (select count(distinct customer_phone)::bigint from booking_base where customer_phone is not null) as total_unique_customers,
  (select count(*)::bigint from customer_first where first_booking_at >= now() - interval '30 days') as new_customers_last_30_days,
  (select count(*)::bigint from customer_30 where bookings_count > 1) as repeat_customers_last_30_days,
  (select count(distinct customer_phone)::bigint from booking_base where customer_phone is not null and booking_at >= now() - interval '30 days') as customers_last_30_days;

-- Restrict direct reads. Use secure RPC wrappers below.
revoke all on public.superadmin_salon_health from public;
revoke all on public.superadmin_global_stats from public;
grant select on public.superadmin_salon_health to service_role;
grant select on public.superadmin_global_stats to service_role;

-- Ensure verifier exists (created in earlier migration).
create or replace function public._verify_superadmin_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
begin
  expected := coalesce(nullif(current_setting('app.settings.superadmin_code', true), ''), '1989');
  return coalesce(p_code, '') = expected;
end;
$$;

create or replace function public.superadmin_overview_stats(
  p_admin_code text
)
returns public.superadmin_global_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.superadmin_global_stats;
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  select *
  into v_row
  from public.superadmin_global_stats
  limit 1;

  return v_row;
end;
$$;

create or replace function public.superadmin_overview_salons(
  p_admin_code text
)
returns setof public.superadmin_salon_health
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  return query
  select *
  from public.superadmin_salon_health
  order by salon_name asc;
end;
$$;

create or replace function public.superadmin_overview_salon(
  p_admin_code text,
  p_salon_id uuid
)
returns public.superadmin_salon_health
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.superadmin_salon_health;
begin
  if not public._verify_superadmin_code(p_admin_code) then
    raise exception using errcode = '42501', message = 'superadmin_forbidden';
  end if;

  select *
  into v_row
  from public.superadmin_salon_health
  where salon_id = p_salon_id
  limit 1;

  return v_row;
end;
$$;

grant execute on function public.superadmin_overview_stats(text) to anon, authenticated;
grant execute on function public.superadmin_overview_salons(text) to anon, authenticated;
grant execute on function public.superadmin_overview_salon(text, uuid) to anon, authenticated;
