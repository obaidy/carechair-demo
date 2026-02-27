# Debug E2E Checklist

1. Set runtime flags
- `apps/professionals/.env`: `EXPO_PUBLIC_USE_MOCK_API=false`
- `apps/professionals/.env`: set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `web/.env`: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Confirm both URLs point to the same Supabase project ref.

2. Verify auth session and uid
- Log in with OTP in Professionals app.
- Open mobile `More -> Diagnostics` (dev only).
- Check: `API mode = supabase`, `Session exists = yes`, `auth.uid()` present.
- In Supabase SQL editor verify user exists:
  - `select id, phone, created_at from auth.users order by created_at desc limit 10;`

3. Verify membership-driven onboarding
- In mobile Diagnostics, press `Refresh Session + Memberships`.
- If memberships count is `0`, onboarding should show Create/Join path.
- If memberships count is `1+`, app routes to existing salon context and no demo fallback is used.

4. Create test draft salon and verify DB row
- In mobile Diagnostics, press `Create Test Draft Salon`.
- Verify response includes `salonInsert.data.id`.
- In SQL editor run:
  - `select id, name, slug, status, created_by, created_at from public.salons order by created_at desc limit 10;`
  - `select salon_id, user_id, role, status, joined_at from public.salon_members order by joined_at desc limit 20;`
- Expected: new salon `status = DRAFT` and owner membership `status = ACTIVE`.

5. Request activation and verify queue
- In mobile Diagnostics, press `Request Activation for Latest Salon`.
- Then press `Fetch Latest activation_requests`.
- In SQL editor verify:
  - `select id, salon_id, status, requested_by, created_at from public.activation_requests order by created_at desc limit 20;`
- Expected: new/updated `activation_requests` row with `status = PENDING` and salon `status = PENDING_REVIEW`.

6. Super admin review
- Add admin user once (replace UUID):
  - `insert into public.admin_users (user_id) values ('<YOUR_USER_ID>') on conflict (user_id) do nothing;`
- Open web: `/<locale>/admin/activation-queue`.
- Approve/reject pending request.
- Verify:
  - Approved => salon `status = ACTIVE`
  - Rejected => salon `status = DRAFT`

7. Public SEO visibility check
- `/<locale>/explore` should list only public/active salons.
- `/<locale>/s/<slug>` and location routes should 404 for non-public/non-active salons.

8. Diagnostics pages for truth source
- Owner page: `/<locale>/app/diagnostics`
- Super admin page: `/<locale>/admin/diagnostics`
- Verify these show:
  - server/client Supabase URL host
  - session uid
  - memberships for uid
  - last visible salons and activation requests
  - recent Supabase API errors

9. If behavior is inconsistent
- Check diagnostics logs first (mobile + web).
- Ensure no environment points to a different Supabase project.
- Ensure membership rows exist in `public.salon_members` for the current `auth.uid()`.
