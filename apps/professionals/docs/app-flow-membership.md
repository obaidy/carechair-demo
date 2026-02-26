# CareChair Professionals App Flow (OTP + Membership + Invites)

## 1) App launch

1. Restore Supabase session from secure storage (`expo-secure-store`).
2. If session exists and refresh token is valid -> continue.
3. If no session -> show Phone OTP login.

## 2) OTP login

1. User enters phone number.
2. App calls `supabase.auth.signInWithOtp({ phone })`.
3. User enters OTP code.
4. App calls `supabase.auth.verifyOtp({ phone, token, type: "sms" })`.
5. On success, app upserts `public.user_profiles` (`user_id = auth.uid()`).

## 3) Membership resolution

1. App calls `listMyActiveMemberships()` from `src/api/supabase/membership.ts`.
2. If memberships count is `0`:
   - Show entry screen with:
     - `Create salon`
     - `Join via code/link`
3. If memberships count is `1`:
   - Set active salon and navigate to Dashboard.
4. If memberships count is `>1`:
   - Show Salon Switcher and persist selected salon in secure storage.

## 4) Create salon path

1. App inserts salon in `public.salons` with `status='DRAFT'` and `created_by=auth.uid()`.
2. DB trigger `trg_seed_owner_membership` inserts owner membership into `public.salon_members`.
3. User lands in onboarding setup (services/staff/hours).
4. User presses `Request Activation` -> salon status transitions to `PENDING_REVIEW`.
5. ACTIVE status unlocks booking link + reminders.

## 5) Join salon path

1. User opens Join screen.
2. User pastes invite code or opens link containing `token`.
3. App calls edge function `accept-invite`.
4. Function validates invite and inserts/updates membership.
5. App refreshes memberships and routes to selected salon dashboard.

## 6) Invite creation path (Owner/Manager)

1. Owner/Manager opens Team/Invite UI.
2. App calls edge function `create-invite` with:
   - `salon_id`
   - `role` (`MANAGER` or `STAFF`)
   - optional `expires_in_hours`
   - optional `max_uses`
3. Function returns:
   - deep link: `carechair://join?token=...`
   - web link: `https://carechair.vercel.app/join?token=...`
   - short code: `A7K9Q2XZ`

## 7) Security model

1. OTP auth identifies the user.
2. RLS enforces tenant access on `salon_members`, `salon_invites`, `user_profiles`, `audit_log`.
3. Invite acceptance uses server-side service role + atomic SQL function (`accept_salon_invite_atomic`).
4. Client cannot directly consume invites by querying code/token from DB.
