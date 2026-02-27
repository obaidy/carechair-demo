-- Normalize salon lifecycle statuses to canonical uppercase values used by web + professionals.
-- Keep billing-specific legacy states (`trialing`, `past_due`, `pending_billing`) for backward compatibility.

alter table public.salons
  drop constraint if exists salons_status_check;

update public.salons
set status = 'DRAFT'
where lower(coalesce(status, '')) in ('draft', 'rejected', 'canceled', 'inactive');

update public.salons
set status = 'PENDING_REVIEW'
where lower(coalesce(status, '')) in ('pending_approval', 'pending_review');

update public.salons
set status = 'ACTIVE'
where lower(coalesce(status, '')) = 'active';

update public.salons
set status = 'SUSPENDED'
where lower(coalesce(status, '')) = 'suspended';

alter table public.salons
  alter column status set default 'DRAFT';

alter table public.salons
  drop constraint if exists salons_status_check;

alter table public.salons
  add constraint salons_status_check
  check (
    status in (
      'DRAFT',
      'PENDING_REVIEW',
      'ACTIVE',
      'SUSPENDED',
      'trialing',
      'past_due',
      'pending_billing'
    )
  );

create or replace function public.tg_salons_normalize_lifecycle_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or btrim(new.status) = '' then
    new.status := 'DRAFT';
    return new;
  end if;

  case lower(btrim(new.status))
    when 'draft' then new.status := 'DRAFT';
    when 'rejected' then new.status := 'DRAFT';
    when 'canceled' then new.status := 'DRAFT';
    when 'inactive' then new.status := 'DRAFT';
    when 'pending_approval' then new.status := 'PENDING_REVIEW';
    when 'pending_review' then new.status := 'PENDING_REVIEW';
    when 'active' then new.status := 'ACTIVE';
    when 'suspended' then new.status := 'SUSPENDED';
    else
      new.status := btrim(new.status);
  end case;

  return new;
end;
$$;

drop trigger if exists trg_salons_normalize_lifecycle_status on public.salons;
create trigger trg_salons_normalize_lifecycle_status
before insert or update on public.salons
for each row
execute function public.tg_salons_normalize_lifecycle_status();
