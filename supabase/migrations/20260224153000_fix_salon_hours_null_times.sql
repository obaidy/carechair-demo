-- Fix onboarding inserts where closed days were sending NULL times.
-- Some earlier schemas define salon_hours.open_time/close_time as NOT NULL.
-- This trigger normalizes values before insert/update.

create or replace function public.normalize_salon_hours_times()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_closed, false) then
    -- Keep valid non-null placeholders for closed days.
    new.open_time := coalesce(new.open_time, '00:00'::time);
    new.close_time := coalesce(new.close_time, '00:00'::time);
  else
    -- Open days must have sensible defaults.
    new.open_time := coalesce(new.open_time, '10:00'::time);
    new.close_time := coalesce(new.close_time, '20:00'::time);

    -- Guarantee positive range for open days.
    if new.close_time <= new.open_time then
      new.close_time := (new.open_time + interval '1 minute')::time;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_salon_hours_times on public.salon_hours;
create trigger trg_normalize_salon_hours_times
before insert or update on public.salon_hours
for each row
execute function public.normalize_salon_hours_times();
