-- Multi-tenant safe overlap protection:
-- Prevent double-booking per (salon_id, staff_id), while allowing same staff UUID across different salons.
-- Note: keeps existing bookings_valid_time_range check constraint unchanged.

create extension if not exists btree_gist;

alter table public.bookings
drop constraint if exists bookings_no_overlap_employee;

alter table public.bookings
add constraint bookings_no_overlap_employee
exclude using gist (
  salon_id with =,
  staff_id with =,
  tstzrange(appointment_start, appointment_end, '[)') with &&
)
where (
  salon_id is not null
  and staff_id is not null
  and appointment_start is not null
  and appointment_end is not null
  and status = any (array['pending','confirmed'])
);

-- Quick verification SQL:
-- 1) Same salon + same staff + overlap => should FAIL
-- insert into public.bookings (
--   salon_id, staff_id, customer_name, customer_phone, status, appointment_start, appointment_end
-- ) values (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222',
--   'Test A',
--   '9647000000001',
--   'confirmed',
--   '2026-02-24T10:00:00+03',
--   '2026-02-24T10:45:00+03'
-- );
--
-- insert into public.bookings (
--   salon_id, staff_id, customer_name, customer_phone, status, appointment_start, appointment_end
-- ) values (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222',
--   'Test B',
--   '9647000000002',
--   'pending',
--   '2026-02-24T10:30:00+03',
--   '2026-02-24T11:00:00+03'
-- );
--
-- 2) Different salon + same staff + overlap => should SUCCEED
-- insert into public.bookings (
--   salon_id, staff_id, customer_name, customer_phone, status, appointment_start, appointment_end
-- ) values (
--   '33333333-3333-3333-3333-333333333333',
--   '22222222-2222-2222-2222-222222222222',
--   'Test C',
--   '9647000000003',
--   'confirmed',
--   '2026-02-24T10:30:00+03',
--   '2026-02-24T11:00:00+03'
-- );
