# CareChair Activation Flow

## Lifecycle
1. User logs in with phone OTP (Supabase Auth).
2. Salon is created in `draft`.
3. Owner configures salon profile/services/staff/hours while in draft.
4. Owner submits activation request via `request-activation` edge function.
5. Salon moves to `pending_approval` and request appears in admin queue.
6. Super admin reviews queue and approves/rejects via `review-activation` edge function.
7. If approved:
- salon status -> `active`
- public listing + booking page become visible
- reminders can be enabled
8. If rejected:
- request status -> `REJECTED`
- salon status -> `draft`
- owner can edit and resubmit.

## What Changes Per Status
- `draft`
- Owner can edit profile and operational setup.
- Public booking remains locked.
- Activation CTA shown.

- `pending_approval`
- Owner can still edit profile and resubmit details.
- Awaiting admin queue decision.
- Public booking remains locked.

- `active`
- Public pages enabled (`/explore`, `/s/[slug]`).
- Booking link shown to owner.
- Reminder/automation settings can be enabled.

- `suspended`
- Public booking disabled.
- Support CTA shown.

## Web Surfaces
- Owner settings: `/[locale]/app/settings`
- Status banner: dashboard layout for all owner pages.
- Admin queue: `/[locale]/admin/activation-queue`
  - Tabs: Pending / Active / Suspended
  - Pending detail includes submitted data + maps link + Approve/Reject.

## Mobile Surfaces
- Onboarding activation screen supports:
  - `MANUAL` address mode (free-text address)
  - `LOCATION` mode (GPS permission + lat/lng capture)
- Dashboard status card now includes CTA for draft/pending salons.

## Security Model
- Client cannot approve/reject directly in DB.
- `request-activation` and `review-activation` edge functions enforce:
  - JWT auth
  - owner membership check for activation request
  - super admin check for review
- RLS enabled on `activation_requests` and `admin_users`.

## Test Checklist
- [ ] Owner creates salon -> status is `draft`.
- [ ] Owner submits activation request -> status becomes `pending_approval`.
- [ ] Pending request appears in `/admin/activation-queue`.
- [ ] Super admin approves -> request `APPROVED`, salon `active`.
- [ ] Super admin rejects -> request `REJECTED`, salon `draft`.
- [ ] `/explore` shows only active public salons.
- [ ] `/s/[slug]` resolves only active salons.
- [ ] Mobile activation request works in both address modes.
- [ ] Invite flow remains independent of activation flow.
