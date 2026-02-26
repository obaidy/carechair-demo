-- Global hub foundation: countries, multi-currency, trialing, subscriptions

create table if not exists public.countries (
  code text primary key,
  name_en text not null,
  name_ar text not null,
  name_cs text not null,
  name_ru text not null,
  default_currency text not null,
  timezone_default text not null,
  stripe_price_id_basic text,
  stripe_price_id_pro text,
  trial_days_default integer not null default 7,
  vat_percent numeric not null default 0,
  is_enabled boolean not null default true,
  created_at timestamp not null default now()
);

insert into public.countries
(code, name_en, name_ar, name_cs, name_ru, default_currency, timezone_default, trial_days_default)
values
('IQ', 'Iraq', 'العراق', 'Irák', 'Ирак', 'USD', 'Asia/Baghdad', 7),
('AE', 'United Arab Emirates', 'الإمارات', 'Spojené arabské emiráty', 'ОАЭ', 'AED', 'Asia/Dubai', 7),
('CZ', 'Czech Republic', 'التشيك', 'Česká republika', 'Чехия', 'CZK', 'Europe/Prague', 7),
('EU', 'Europe', 'أوروبا', 'Evropa', 'Европа', 'EUR', 'Europe/Berlin', 7)
on conflict (code) do update
set
  name_en = excluded.name_en,
  name_ar = excluded.name_ar,
  name_cs = excluded.name_cs,
  name_ru = excluded.name_ru,
  default_currency = excluded.default_currency,
  timezone_default = excluded.timezone_default,
  trial_days_default = excluded.trial_days_default;

alter table public.salons
  add column if not exists country_code text references public.countries(code),
  add column if not exists currency_code text,
  add column if not exists timezone text,
  add column if not exists language_default text default 'en',
  add column if not exists trial_end_at timestamp,
  add column if not exists subscription_status text default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamp,
  add column if not exists is_active boolean default true;

-- Backfill to avoid breaking existing rows
update public.salons
set country_code = coalesce(country_code, 'IQ');

update public.salons s
set
  currency_code = coalesce(s.currency_code, c.default_currency),
  timezone = coalesce(s.timezone, c.timezone_default)
from public.countries c
where c.code = coalesce(s.country_code, 'IQ');

update public.salons
set language_default = coalesce(nullif(language_default, ''), 'en');

update public.salons
set trial_end_at = coalesce(trial_end_at, trial_end, now() + interval '7 day');

update public.salons
set subscription_status = coalesce(nullif(subscription_status, ''), billing_status, 'inactive');

-- Keep old billing_status compatibility with new status
update public.salons
set billing_status = coalesce(nullif(billing_status, ''), subscription_status, 'inactive');

alter table public.salons
  alter column country_code set default 'IQ',
  alter column language_default set default 'en',
  alter column subscription_status set default 'inactive',
  alter column is_active set default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salons_subscription_status_chk'
      and conrelid = 'public.salons'::regclass
  ) then
    alter table public.salons
      add constraint salons_subscription_status_chk
      check (subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'suspended'));
  end if;
end $$;

create index if not exists idx_salons_country_code on public.salons(country_code);
create index if not exists idx_salons_currency_code on public.salons(currency_code);
create index if not exists idx_salons_language_default on public.salons(language_default);
create index if not exists idx_salons_subscription_status on public.salons(subscription_status);
create index if not exists idx_salons_current_period_end on public.salons(current_period_end);
create index if not exists idx_salons_trial_end_at on public.salons(trial_end_at);

create index if not exists idx_countries_is_enabled on public.countries(is_enabled);

alter table public.countries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'countries' and policyname = 'demo_countries_select'
  ) then
    create policy demo_countries_select on public.countries for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'countries' and policyname = 'demo_countries_write'
  ) then
    create policy demo_countries_write on public.countries for all using (true) with check (true);
  end if;
end $$;
