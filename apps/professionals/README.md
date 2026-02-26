# CareChair Professionals App

Premium mobile and tablet app for salon operations.

## What is included now

- WhatsApp-first OTP login with SMS fallback
- Email/password login fallback
- Pending-approval screen for new salon admins
- Calendar-first dashboard UI (Noona-inspired clean layout)
- Tablet-responsive split layout

## Environment

Set these variables before running the app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Use `.env.example` as template:

```bash
cp apps/professionals/.env.example apps/professionals/.env
```

Then fill values:

```bash
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

## Run

From repo root:

```bash
npm run dev:professionals
```

If your local default Node is below 20, use:

```bash
npm run dev:professionals:node20
```

Or directly:

```bash
cd apps/professionals
npm run start
```

## Notes

- Expo + React Native stack in this project requires Node 20+.
- OTP channel logic tries WhatsApp first, then falls back to SMS.
