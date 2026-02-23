-- Salon locations support: normalized branch-ready location model + onboarding integration.

create extension if not exists pgcrypto;

-- 1) Location table (branch-ready, one primary for now)
create table if not exists public.salon_locations (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  label text null,
  country_code text not null default 'IQ',
  city text null,
  address_line text null,
  formatted_address text null,
  lat double precision not null,
  lng double precision not null,
  provider text not null default 'manual',
  provider_place_id text null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salon_locations_lat_range_chk check (lat between -90 and 90),
  constraint salon_locations_lng_range_chk check (lng between -180 and 180),
  constraint salon_locations_provider_chk check (provider in ('mapbox', 'google', 'apple', 'manual'))
);

create index if not exists idx_salon_locations_salon_id on public.salon_locations(salon_id);
create index if not exists idx_salon_locations_country_code on public.salon_locations(country_code);
create unique index if not exists salon_locations_one_primary_per_salon
  on public.salon_locations(salon_id)
  where is_primary = true;

-- 2) updated_at trigger (reuse existing helper)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_salon_locations_set_updated_at on public.salon_locations;
create trigger trg_salon_locations_set_updated_at
before update on public.salon_locations
for each row
execute function public.set_updated_at();

-- 3) JWT helper functions for scoped RLS (compatible with claim-based production setup)
create or replace function public.current_salon_id_from_jwt()
returns uuid
language plpgsql
stable
as $$
declare
  v text;
begin
  v := coalesce(
    nullif(auth.jwt() ->> 'salon_id', ''),
    nullif(auth.jwt() ->> 'salonId', ''),
    nullif(auth.jwt() #>> '{app_metadata,salon_id}', ''),
    nullif(auth.jwt() #>> '{user_metadata,salon_id}', '')
  );

  if v is null then
    return null;
  end if;

  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v::uuid;
  end if;

  return null;
end;
$$;

create or replace function public.is_superadmin_from_jwt()
returns boolean
language plpgsql
stable
as $$
declare
  v_role text;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;

  v_role := lower(
    coalesce(
      nullif(auth.jwt() ->> 'role', ''),
      nullif(auth.jwt() ->> 'app_role', ''),
      nullif(auth.jwt() #>> '{app_metadata,role}', ''),
      nullif(auth.jwt() #>> '{user_metadata,role}', '')
    )
  );

  return v_role in ('superadmin', 'service_role');
end;
$$;

-- 4) Primary-location upsert helper (kept internal; used by onboarding RPC)
create or replace function public.upsert_primary_salon_location(
  p_salon_id uuid,
  p_label text default null,
  p_country_code text default null,
  p_city text default null,
  p_address_line text default null,
  p_formatted_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_provider text default 'manual',
  p_provider_place_id text default null
)
returns public.salon_locations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.salon_locations;
  v_provider text;
  v_country_code text;
begin
  if p_salon_id is null then
    raise exception using errcode = '23514', message = 'salon_id_required';
  end if;

  if p_lat is null or p_lat < -90 or p_lat > 90 then
    raise exception using errcode = '23514', message = 'location_lat_invalid';
  end if;

  if p_lng is null or p_lng < -180 or p_lng > 180 then
    raise exception using errcode = '23514', message = 'location_lng_invalid';
  end if;

  v_provider := lower(trim(coalesce(p_provider, 'manual')));
  if v_provider not in ('mapbox', 'google', 'apple', 'manual') then
    v_provider := 'manual';
  end if;

  v_country_code := upper(trim(coalesce(nullif(p_country_code, ''), 'IQ')));

  update public.salon_locations
  set
    label = nullif(trim(coalesce(p_label, '')), ''),
    country_code = v_country_code,
    city = nullif(trim(coalesce(p_city, '')), ''),
    address_line = nullif(trim(coalesce(p_address_line, '')), ''),
    formatted_address = nullif(trim(coalesce(p_formatted_address, '')), ''),
    lat = p_lat,
    lng = p_lng,
    provider = v_provider,
    provider_place_id = nullif(trim(coalesce(p_provider_place_id, '')), ''),
    is_primary = true,
    updated_at = now()
  where salon_id = p_salon_id
    and is_primary = true
  returning * into v_row;

  if v_row.id is null then
    insert into public.salon_locations (
      salon_id,
      label,
      country_code,
      city,
      address_line,
      formatted_address,
      lat,
      lng,
      provider,
      provider_place_id,
      is_primary
    )
    values (
      p_salon_id,
      nullif(trim(coalesce(p_label, '')), ''),
      v_country_code,
      nullif(trim(coalesce(p_city, '')), ''),
      nullif(trim(coalesce(p_address_line, '')), ''),
      nullif(trim(coalesce(p_formatted_address, '')), ''),
      p_lat,
      p_lng,
      v_provider,
      nullif(trim(coalesce(p_provider_place_id, '')), ''),
      true
    )
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.upsert_primary_salon_location(uuid, text, text, text, text, text, double precision, double precision, text, text) from public;
grant execute on function public.upsert_primary_salon_location(uuid, text, text, text, text, text, double precision, double precision, text, text) to service_role;

-- 5) RLS policies
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
      and coalesce(s.is_active, false) = true
      and coalesce(s.is_listed, false) = true
  )
);

drop policy if exists salon_locations_admin_select on public.salon_locations;
create policy salon_locations_admin_select
on public.salon_locations
for select
to authenticated
using (
  public.is_superadmin_from_jwt()
  or salon_locations.salon_id = public.current_salon_id_from_jwt()
);

drop policy if exists salon_locations_admin_insert on public.salon_locations;
create policy salon_locations_admin_insert
on public.salon_locations
for insert
to authenticated
with check (
  public.is_superadmin_from_jwt()
  or salon_locations.salon_id = public.current_salon_id_from_jwt()
);

drop policy if exists salon_locations_admin_update on public.salon_locations;
create policy salon_locations_admin_update
on public.salon_locations
for update
to authenticated
using (
  public.is_superadmin_from_jwt()
  or salon_locations.salon_id = public.current_salon_id_from_jwt()
)
with check (
  public.is_superadmin_from_jwt()
  or salon_locations.salon_id = public.current_salon_id_from_jwt()
);

drop policy if exists salon_locations_admin_delete on public.salon_locations;
create policy salon_locations_admin_delete
on public.salon_locations
for delete
to authenticated
using (
  public.is_superadmin_from_jwt()
  or salon_locations.salon_id = public.current_salon_id_from_jwt()
);

-- 6) Backfill from legacy salons.latitude/longitude when available.
insert into public.salon_locations (
  salon_id,
  label,
  country_code,
  city,
  address_line,
  formatted_address,
  lat,
  lng,
  provider,
  is_primary
)
select
  s.id,
  'Main Branch',
  coalesce(nullif(upper(trim(coalesce(to_jsonb(s) ->> 'country_code', ''))), ''), 'IQ') as country_code,
  nullif(trim(coalesce(to_jsonb(s) ->> 'area', '')), '') as city,
  nullif(trim(coalesce(to_jsonb(s) ->> 'area', '')), '') as address_line,
  nullif(trim(coalesce(to_jsonb(s) ->> 'area', '')), '') as formatted_address,
  (to_jsonb(s) ->> 'latitude')::double precision as lat,
  (to_jsonb(s) ->> 'longitude')::double precision as lng,
  'manual',
  true
from public.salons s
where nullif(trim(coalesce(to_jsonb(s) ->> 'latitude', '')), '') is not null
  and nullif(trim(coalesce(to_jsonb(s) ->> 'longitude', '')), '') is not null
  and (to_jsonb(s) ->> 'latitude')::double precision between -90 and 90
  and (to_jsonb(s) ->> 'longitude')::double precision between -180 and 180
  and not exists (
    select 1
    from public.salon_locations sl
    where sl.salon_id = s.id
      and sl.is_primary = true
  );

-- 7) Onboarding wrapper override: enforce coordinates + persist primary location.
create or replace function public.create_salon_onboarding(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
  v_salon_id uuid;
  v_slug text;
  v_invite_token text;
  v_invite public.salon_invites;
  v_country_code text;

  v_location jsonb;
  v_location_country_code text;
  v_location_city text;
  v_location_address_line text;
  v_location_formatted_address text;
  v_location_lat double precision;
  v_location_lng double precision;
  v_location_provider text;
  v_location_provider_place_id text;
  v_location_saved public.salon_locations;
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_salon_onboarding_legacy'
      and oidvectortypes(p.proargtypes) = 'jsonb'
  ) then
    raise exception using errcode = '42883', message = 'create_salon_onboarding_legacy_missing';
  end if;

  v_invite_token := nullif(trim(coalesce(v_payload ->> 'invite_token', '')), '');

  if v_invite_token is not null then
    select *
    into v_invite
    from public.salon_invites si
    where si.token = v_invite_token
      and (si.expires_at is null or si.expires_at > now())
      and coalesce(si.uses, 0) < coalesce(si.max_uses, 1)
    for update;

    if v_invite.id is null then
      raise exception using errcode = '23514', message = 'invite_invalid';
    end if;

    v_country_code := v_invite.country_code;
  else
    v_country_code := upper(coalesce(v_payload #>> '{salon,country_code}', ''));
    if not exists (
      select 1
      from public.countries c
      where c.code = v_country_code
        and c.is_enabled = true
        and coalesce(c.is_public, true) = true
    ) then
      raise exception using errcode = '23514', message = 'country_not_public';
    end if;
  end if;

  if v_country_code is null or btrim(v_country_code) = '' then
    raise exception using errcode = '23514', message = 'country_required';
  end if;

  v_payload := jsonb_set(v_payload, '{salon,country_code}', to_jsonb(v_country_code), true);

  -- Required normalized location payload
  v_location := coalesce(v_payload -> 'location', '{}'::jsonb);

  v_location_country_code := upper(coalesce(nullif(trim(v_location ->> 'country_code'), ''), v_country_code));
  v_location_city := nullif(trim(coalesce(v_location ->> 'city', '')), '');
  v_location_address_line := nullif(trim(coalesce(v_location ->> 'address_line', '')), '');
  v_location_formatted_address := nullif(trim(coalesce(v_location ->> 'formatted_address', '')), '');

  if nullif(trim(coalesce(v_location ->> 'lat', '')), '') is null
     or nullif(trim(coalesce(v_location ->> 'lng', '')), '') is null then
    raise exception using errcode = '23514', message = 'location_coordinates_required';
  end if;

  v_location_lat := (v_location ->> 'lat')::double precision;
  v_location_lng := (v_location ->> 'lng')::double precision;

  if v_location_lat < -90 or v_location_lat > 90 then
    raise exception using errcode = '23514', message = 'location_lat_invalid';
  end if;

  if v_location_lng < -180 or v_location_lng > 180 then
    raise exception using errcode = '23514', message = 'location_lng_invalid';
  end if;

  v_location_provider := lower(trim(coalesce(v_location ->> 'provider', '')));
  if v_location_provider = '' then
    v_location_provider := case
      when nullif(trim(coalesce(v_location ->> 'provider_place_id', '')), '') is not null then 'mapbox'
      else 'manual'
    end;
  end if;
  if v_location_provider not in ('mapbox', 'google', 'apple', 'manual') then
    v_location_provider := 'manual';
  end if;

  v_location_provider_place_id := nullif(trim(coalesce(v_location ->> 'provider_place_id', '')), '');

  v_slug := public.normalize_salon_slug(
    coalesce(v_payload #>> '{salon,slug}', v_payload #>> '{salon,name}', '')
  );

  if v_slug <> '' then
    v_payload := jsonb_set(v_payload, '{salon,slug}', to_jsonb(v_slug), true);
  end if;

  v_result := public.create_salon_onboarding_legacy(v_payload);

  v_salon_id := nullif(v_result ->> 'salon_id', '')::uuid;
  if v_salon_id is null then
    v_salon_id := nullif(v_payload #>> '{salon,id}', '')::uuid;
  end if;

  if v_salon_id is not null then
    update public.salons
    set status = 'pending_approval',
        subscription_status = 'inactive',
        billing_status = 'inactive',
        trial_end_at = null,
        trial_end = null,
        billing_mode = case when exists (
          select 1 from public.countries c where c.code = v_country_code and coalesce(c.requires_manual_billing, false) = true
        ) then 'manual' else 'stripe' end,
        is_active = true
    where id = v_salon_id;

    v_location_saved := public.upsert_primary_salon_location(
      p_salon_id => v_salon_id,
      p_label => coalesce(nullif(trim(coalesce(v_location ->> 'label', '')), ''), 'Main Branch'),
      p_country_code => v_location_country_code,
      p_city => v_location_city,
      p_address_line => v_location_address_line,
      p_formatted_address => v_location_formatted_address,
      p_lat => v_location_lat,
      p_lng => v_location_lng,
      p_provider => v_location_provider,
      p_provider_place_id => v_location_provider_place_id
    );

    update public.salons
    set latitude = v_location_saved.lat,
        longitude = v_location_saved.lng,
        area = coalesce(nullif(v_location_saved.city, ''), nullif(v_location_saved.address_line, ''), area),
        country_code = coalesce(nullif(v_location_saved.country_code, ''), country_code)
    where id = v_salon_id;

    if v_invite.id is not null then
      update public.salon_invites
      set uses = coalesce(uses, 0) + 1
      where id = v_invite.id;
    end if;

    v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
      'status', 'pending_approval',
      'subscription_status', 'inactive',
      'billing_status', 'inactive',
      'trial_end_at', null,
      'slug', v_slug,
      'invite_applied', (v_invite.id is not null),
      'location', jsonb_build_object(
        'id', v_location_saved.id,
        'country_code', v_location_saved.country_code,
        'city', v_location_saved.city,
        'address_line', v_location_saved.address_line,
        'formatted_address', v_location_saved.formatted_address,
        'lat', v_location_saved.lat,
        'lng', v_location_saved.lng,
        'provider', v_location_saved.provider,
        'provider_place_id', v_location_saved.provider_place_id,
        'is_primary', v_location_saved.is_primary
      )
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.create_salon_onboarding(jsonb) to anon, authenticated;
