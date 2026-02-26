# CareChair Professionals (Expo)

Production-ready mobile/tablet app for salon owners and admins to manage bookings, calendar, clients, staff, reminders, and onboarding.

## Stack

- Expo + React Native + TypeScript
- React Navigation (native stack + bottom tabs)
- TanStack React Query
- Zustand
- react-hook-form + zod
- date-fns
- Supabase (OTP + data) with secure auth/session storage via `expo-secure-store`
- Expo Notifications scaffold (push token capture)
- i18n: Arabic + English (default Arabic, RTL-aware)

## Features (MVP)

- Phone OTP login and persistent session
- Owner context bootstrap + onboarding (Create/Claim salon)
- Salon lifecycle states: `DRAFT -> PENDING_REVIEW -> ACTIVE -> SUSPENDED`
- Dashboard summary + quick actions + event feed
- Calendar (Day/Week/List)
- Booking flow: client -> service -> staff -> available slot -> confirm
- Slot logic: respects working hours + existing conflicts
- Appointment detail bottom sheet with status actions + reschedule flow
- Block time flow
- Clients list with tablet master-detail profile
- Staff management + service assignment + performance mini-cards
- More tab: salon profile, services, reminders, activation request, language/theme, logout

## Project Structure

```text
src/
  api/
    mock/
    supabase/
  app/
  components/
  i18n/
  navigation/
  screens/
  state/
  theme/
  types/
  utils/
```

## Environment

Create `apps/professionals/.env` from template:

```bash
cp apps/professionals/.env.example apps/professionals/.env
```

Variables:

- `EXPO_PUBLIC_USE_MOCK_API=true` (default; set `false` to use Supabase)
- `EXPO_PUBLIC_USE_INVITES_V2=false` (set `true` to enable V2 onboarding/invite flow)
- `EXPO_PUBLIC_SUPABASE_URL=...`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`

Fallback aliases supported in code:

- `EXPO_PUBLIC_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Run

From repo root:

```bash
npm run dev:professionals
```

If local Node is below 20:

```bash
npm run dev:professionals:node20
```

Or directly:

```bash
cd apps/professionals
npm run start
```

## Notes

- React Native/Expo SDK in this app expects Node 20+.
- API mode logs once at startup: `[CareChair Professionals] API mode: mock|supabase`.
- Supabase adapter includes TODO markers where production table/RPC contracts must be finalized.

## Supabase Membership + Invite Setup

Migration and functions added:

- `supabase/migrations/20260226170000_001_carechair_multi_tenant.sql`
- `supabase/functions/create-invite`
- `supabase/functions/accept-invite`

Setup checklist:

1. Enable Phone OTP:
   - Supabase Dashboard -> Authentication -> Providers -> Phone -> Enable.
2. Ensure app env in `apps/professionals/.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Push DB migration:
   - `supabase db push`
4. Deploy edge functions:
   - `supabase functions deploy create-invite`
   - `supabase functions deploy accept-invite`
5. Set function secrets:
   - `supabase secrets set APP_WEB_URL=https://carechair.vercel.app`
6. Confirm JWT enforcement in function configs:
   - `supabase/functions/create-invite/config.toml` -> `verify_jwt = true`
   - `supabase/functions/accept-invite/config.toml` -> `verify_jwt = true`

Quick curl test (replace values):

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/create-invite" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"salon_id":"<salon-uuid>","role":"STAFF","expires_in_hours":72,"max_uses":1}'
```

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/accept-invite" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"code":"A7K9Q2XZ"}'
```

Compatibility note:

- This migration is non-destructive and keeps legacy `/web` public booking/explore flows.
- Legacy `salon_memberships` is synced from `salon_members` when present.

Rollout docs:

- `docs/rollout-v2.md`
- `docs/cutover-checklist.md`
