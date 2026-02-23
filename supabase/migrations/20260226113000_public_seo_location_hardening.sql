-- Public SEO/location hardening for Next public pages.
create extension if not exists pgcrypto;

-- Ensure normalized location table exists (no-op if already present).
create table if not exists public.salon_locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  country_code text,
  city text,
  city_slug text,
  address_text text,
  lat double precision,
  lng double precision,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend existing location model with SEO-friendly fields.
alter table public.salon_locations
  add column if not exists city_slug text,
  add column if not exists address_text text;

update public.salon_locations
set city_slug = lower(regexp_replace(trim(city), '\\s+', '-', 'g'))
where city_slug is null
  and nullif(trim(coalesce(city, '')), '') is not null;

update public.salon_locations
set address_text = nullif(trim(coalesce(address_text, formatted_address, address_line, '')), '')
where address_text is null;

create index if not exists idx_salon_locations_country_city_slug
  on public.salon_locations(country_code, city_slug);

create index if not exists idx_salon_locations_salon_primary
  on public.salon_locations(salon_id, is_primary);

-- Public read policy: only locations of public + active salons.
alter table public.salon_locations enable row level security;

drop policy if exists salon_locations_public_select on public.salon_locations;
create policy salon_locations_public_select
on public.salon_locations
for select
to anon
using (
  exists (
    select 1
    from public.salons s
    where s.id = salon_locations.salon_id
      and coalesce(s.is_public, false) = true
      and coalesce(s.is_active, true) = true
  )
);
