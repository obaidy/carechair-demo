-- Corrective migration:
-- reset salons that were auto-marked active by previous backfill,
-- unless they already have explicit paid/trial/override/subscription state.

update public.salons
set
  setup_paid = false,
  billing_status = 'inactive',
  is_active = false
where
  coalesce(setup_required, true) = true
  and coalesce(manual_override_active, false) = false
  and coalesce(trial_enabled, false) = false
  and trial_end is null
  and stripe_subscription_id is null
  and stripe_customer_id is null
  and coalesce(billing_status, 'inactive') in ('active', 'inactive')
  and coalesce(setup_paid, false) = true;

