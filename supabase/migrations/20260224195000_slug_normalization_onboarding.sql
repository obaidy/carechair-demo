-- Ensure onboarding slug is normalized with underscores, never spaces.

create or replace function public.normalize_salon_slug(input text)
returns text
language sql
immutable
as $$
  select trim(both '_' from regexp_replace(regexp_replace(lower(coalesce(input, '')), '\\s+', '_', 'g'), '_+', '_', 'g'));
$$;

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
        is_active = true
    where id = v_salon_id;

    v_result := coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
      'status', 'pending_approval',
      'subscription_status', 'inactive',
      'billing_status', 'inactive',
      'trial_end_at', null,
      'slug', v_slug
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.create_salon_onboarding(jsonb) to anon, authenticated;
