# V2 Cutover Checklist (Invites + Membership)

## Pre-cutover

- [ ] Staging acceptance tests in `docs/rollout-v2.md` all pass.
- [ ] Edge Functions `create-invite` + `accept-invite` deployed in production.
- [ ] `USE_INVITES_V2` available and configurable.
- [ ] Audit log monitoring query/dashboard ready.

## Phase 1: Internal Enablement

- [ ] Enable `USE_INVITES_V2=true` for internal test accounts.
- [ ] Validate deep link join (`carechair://join?token=...`).
- [ ] Validate web fallback link (`https://carechair.vercel.app/join?token=...`).
- [ ] Validate multi-salon switch/persistence.

## Phase 2: Pilot Salons

- [ ] Enable V2 for 1-2 pilot salons.
- [ ] Monitor invite success/failure ratio for 48h.
- [ ] Confirm no OTP loop/session regressions.

## Phase 3: Traffic Ramp

- [ ] Enable V2 for 20% of new signups.
- [ ] Monitor:
  - [ ] `invite.accept_failed` reasons
  - [ ] `RATE_LIMITED` spikes
  - [ ] onboarding conversion
- [ ] Ramp to 100% new signups.

## Phase 4: Freeze Legacy Writes

- [ ] Disable all app/API writes to legacy membership tables.
- [ ] Keep temporary legacy reads only if required for transitional users.
- [ ] Announce migration window and lock date.

## Phase 5: Data Migration

- [ ] Run `supabase/migrations/999_migrate_legacy_to_v2.sql`.
- [ ] Run verification queries (counts/orphans/samples).
- [ ] Spot-check pilot and high-value accounts.

## Phase 6: Switch Reads to V2 Only

- [ ] Remove legacy read fallback in app code.
- [ ] Confirm routing logic uses only `salon_members`.
- [ ] Observe 7-14 days with stable metrics.

## Phase 7: Legacy Retirement

- [ ] Remove legacy sync trigger/function.
- [ ] Remove legacy screens/code paths.
- [ ] Archive old tables.
- [ ] Optionally drop legacy tables after 30 days stable.
