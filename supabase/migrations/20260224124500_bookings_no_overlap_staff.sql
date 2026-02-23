-- Prevent double-booking for the same staff member (race-condition safe).
-- Parallel bookings for different staff members at the same time remain allowed.

create extension if not exists btree_gist;

-- Ensure time columns are timestamptz (safe conversion for legacy schemas).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'appointment_start'
      and data_type <> 'timestamp with time zone'
  ) then
    execute '
      alter table public.bookings
      alter column appointment_start
      type timestamptz
      using appointment_start::timestamptz
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'appointment_end'
      and data_type <> 'timestamp with time zone'
  ) then
    execute '
      alter table public.bookings
      alter column appointment_end
      type timestamptz
      using appointment_end::timestamptz
    ';
  end if;
end $$;

alter table public.bookings
drop constraint if exists bookings_no_overlap_employee;

alter table public.bookings
add constraint bookings_no_overlap_employee
exclude using gist (
  staff_id with =,
  tstzrange(appointment_start, appointment_end, '[)') with &&
)
where (
  staff_id is not null
  and appointment_start is not null
  and appointment_end is not null
  and status in ('pending', 'confirmed')
);
