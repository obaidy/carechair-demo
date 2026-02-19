-- Hybrid monetization controls for salons (additive, safe)

alter table public.salons
  add column if not exists setup_paid boolean not null default false,
  add column if not exists setup_required boolean not null default true,
  add column if not exists billing_status text not null default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists trial_enabled boolean not null default false,
  add column if not exists manual_override_active boolean not null default false,
  add column if not exists manual_override_reason text,
  add column if not exists suspended_reason text;

alter table public.salons alter column is_listed set default true;
alter table public.salons alter column is_active set default false;

-- Backfill to avoid breaking existing active salons after migration
update public.salons
set setup_paid = true
where coalesce(is_active, false) = true
  and coalesce(setup_paid, false) = false;

update public.salons
set billing_status = 'active'
where coalesce(is_active, false) = true
  and coalesce(billing_status, 'inactive') = 'inactive';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_billing_status_chk'
      and conrelid = 'public.salons'::regclass
  ) then
    alter table public.salons
      add constraint salons_billing_status_chk
      check (billing_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'suspended'));
  end if;
end $$;

create index if not exists idx_salons_stripe_customer_id on public.salons(stripe_customer_id);
create index if not exists idx_salons_stripe_subscription_id on public.salons(stripe_subscription_id);
create index if not exists idx_salons_billing_status on public.salons(billing_status);
create index if not exists idx_salons_is_active on public.salons(is_active);

