# CareChair Professionals V2 Membership Rollout Plan

## Scope

- Replace legacy onboarding/join membership paths with V2 (`salons`, `salon_members`, `salon_invites`, `audit_log`, Edge Functions).
- Roll out safely with `USE_INVITES_V2` feature flag.
- Keep legacy reads temporary only, freeze legacy writes at cutover.

## 1) Staging Setup

1. Provision staging Supabase project (or isolated staging schema).
2. Apply migrations:
   - `supabase db push`
   - Ensure `20260226170000_001_carechair_multi_tenant.sql` is applied.
3. Deploy Edge Functions:
   - `supabase functions deploy create-invite`
   - `supabase functions deploy accept-invite`
4. Set secrets/config:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_WEB_URL=https://carechair.vercel.app`
5. Enable phone OTP in staging auth provider.
6. Set app staging env:
   - `EXPO_PUBLIC_USE_MOCK_API=false`
   - `EXPO_PUBLIC_USE_INVITES_V2=true`
   - staging `EXPO_PUBLIC_SUPABASE_URL`
   - staging `EXPO_PUBLIC_SUPABASE_ANON_KEY`
7. Seed data:
   - One owner with one salon
   - One owner with two salons
   - One invite with `max_uses=1`
   - One revoked invite
   - One expired invite

## 2) Acceptance Tests

Run this checklist in staging. Expected result must pass for every item.

- [ ] Create salon from app V2 wizard
  - Expected: salon row exists, `status='draft'` (or mapped draft), owner row in `salon_members` with `role='OWNER'`, `status='ACTIVE'`.
- [ ] Create invite via Edge Function
  - Expected: response contains `code`, `invite_link`, `web_link`; `token_hash` stored; raw token not persisted as real secret; `audit_log` contains `invite.created`.
- [ ] Accept invite with token
  - Expected: `salon_members` upserted/activated; `used_count` increments; `last_used_at` updated; `audit_log` contains `invite.accepted`.
- [ ] Accept invite with code
  - Expected: same as token flow.
- [ ] Accept expired invite
  - Expected: function returns `EXPIRED`; no membership write; `audit_log` contains `invite.accept_failed` with reason `EXPIRED`.
- [ ] Accept revoked invite
  - Expected: function returns `REVOKED`; no membership write; failure audit logged.
- [ ] Accept maxed invite
  - Expected: function returns `MAX_USES`; no membership write; failure audit logged.
- [ ] Re-join after REMOVED
  - Expected: existing row in `salon_members` switches back to `ACTIVE` with invite role.
- [ ] Multi-salon user flow
  - Expected: switcher appears, salon selection persists via secure storage and survives app restart.
- [ ] Session persistence
  - Expected: app opens without OTP when refresh token still valid.

## 3) Production Rollout with Feature Flag

Single flag: `USE_INVITES_V2`.

### When `USE_INVITES_V2 = ON`

- Onboarding uses V2 screens only.
- Join uses `accept-invite` function only.
- Salon creation writes to `salons` + `salon_members` only.
- Membership reads from `salon_members` only.

### When `USE_INVITES_V2 = OFF`

- Existing legacy onboarding flow remains active.

### Rollout percentages

1. Internal accounts only.
2. 1-2 pilot salons.
3. 20% of new signups.
4. 100% new signups.
5. Migrate existing legacy users.

## 4) Freeze Legacy Writes

Once pilot is stable in production:

1. Disable any legacy membership write path in app/API.
2. Keep temporary legacy read fallback only for already-migrated sessions if required.
3. Set explicit cutover date and communicate freeze window.

## 5) Migration Plan

Use `supabase/migrations/999_migrate_legacy_to_v2.sql`.

- Small legacy set (<=5 users): manual migration + manual verification.
- Larger legacy set (>=50 users): scripted migration + verification queries + sampled row checks.

Order:

1. Snapshot legacy counts.
2. Migrate salons.
3. Migrate memberships with role/status mapping.
4. Run verification queries (counts, orphans, sampled joins).
5. Switch reads to V2 only.
6. Keep rollback snapshot.

## 6) Observability

Track from `audit_log`:

- `invite.created`
- `invite.accepted`
- `invite.create_failed`
- `invite.accept_failed` with reasons (`INVALID_INVITE`, `EXPIRED`, `REVOKED`, `MAX_USES`, `RATE_LIMITED`)

Operational query:

```sql
select action, meta->>'reason' as reason, count(*) as total
from public.audit_log
where created_at > now() - interval '24 hours'
  and action like 'invite.%'
group by 1,2
order by total desc;
```

## 7) Legacy Retirement

Disable legacy read path only after all are true:

1. 14+ days stable V2 invite acceptance success rate.
2. No unresolved invite failures outside expected validation reasons.
3. 100% of active users have `salon_members` rows.
4. Support tickets show no auth/membership routing regressions.

Then:

1. Remove legacy read fallback code.
2. Remove trigger-based legacy sync.
3. Archive/drop legacy tables after 30 days of stability.
