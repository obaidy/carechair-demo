-- Ensure bookings never have zero/negative duration.
-- Supports both schema variants:
-- 1) appointment_start / appointment_end (current)
-- 2) start_time / end_time (legacy/requested)

alter table public.bookings
drop constraint if exists bookings_valid_time_range;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'end_time'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'start_time'
  ) then
    execute '
      alter table public.bookings
      add constraint bookings_valid_time_range
      check (end_time > start_time)
    ';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'appointment_end'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'appointment_start'
  ) then
    execute '
      alter table public.bookings
      add constraint bookings_valid_time_range
      check (appointment_end > appointment_start)
    ';
  end if;
end $$;
