-- Hybrid approval fix:
-- Onboarding submissions must enter pending_approval for all countries.
-- Trial starts only after explicit superadmin approval (IQ)
-- or after billing success (non-IQ).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_salon_onboarding'
      AND oidvectortypes(p.proargtypes) = 'jsonb'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_salon_onboarding_legacy'
      AND oidvectortypes(p.proargtypes) = 'jsonb'
  ) THEN
    ALTER FUNCTION public.create_salon_onboarding(jsonb)
      RENAME TO create_salon_onboarding_legacy;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_salon_onboarding(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_salon_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_salon_onboarding_legacy'
      AND oidvectortypes(p.proargtypes) = 'jsonb'
  ) THEN
    RAISE EXCEPTION USING errcode = '42883', message = 'create_salon_onboarding_legacy_missing';
  END IF;

  v_result := public.create_salon_onboarding_legacy(payload);

  v_salon_id := NULLIF(v_result ->> 'salon_id', '')::uuid;
  IF v_salon_id IS NULL THEN
    v_salon_id := NULLIF(payload #>> '{salon,id}', '')::uuid;
  END IF;

  IF v_salon_id IS NOT NULL THEN
    UPDATE public.salons
    SET status = 'pending_approval',
        subscription_status = 'inactive',
        billing_status = 'inactive',
        trial_end_at = NULL,
        trial_end = NULL,
        is_active = TRUE
    WHERE id = v_salon_id;

    v_result := COALESCE(v_result, '{}'::jsonb) || jsonb_build_object(
      'status', 'pending_approval',
      'subscription_status', 'inactive',
      'billing_status', 'inactive',
      'trial_end_at', NULL
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_salon_onboarding(jsonb) TO anon, authenticated;
