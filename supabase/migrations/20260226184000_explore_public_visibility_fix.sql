-- Keep explore visibility aligned for public-country salons.
-- Problem fixed: legacy/onboarding inserts with is_listed=true were defaulting is_public=false,
-- which hid all salons from anon explore queries.

create or replace function public.tg_salons_sync_public_visibility_on_insert()
returns trigger
language plpgsql
as $$
declare
  v_country_public boolean := true;
begin
  if coalesce(new.is_listed, false) = true and coalesce(new.is_public, false) = false then
    begin
      select coalesce(c.is_public, true)
      into v_country_public
      from public.countries c
      where c.code = coalesce(new.country_code, 'IQ')
      limit 1;
    exception
      when undefined_table or undefined_column then
        v_country_public := true;
    end;

    if coalesce(v_country_public, true) = true then
      new.is_public := true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_salons_sync_public_visibility_on_insert on public.salons;
create trigger trg_salons_sync_public_visibility_on_insert
before insert on public.salons
for each row
execute function public.tg_salons_sync_public_visibility_on_insert();

do $$
begin
  begin
    update public.salons s
    set is_public = true
    from public.countries c
    where coalesce(s.is_public, false) = false
      and coalesce(s.is_listed, false) = true
      and c.code = coalesce(s.country_code, 'IQ')
      and coalesce(c.is_public, true) = true;
  exception
    when undefined_table or undefined_column then
      update public.salons s
      set is_public = true
      where coalesce(s.is_public, false) = false
        and coalesce(s.is_listed, false) = true;
  end;
end;
$$;
