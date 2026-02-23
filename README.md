# CareChair Demo Monorepo (Vite SPA + Next.js)

This repo contains two frontends:

- Root app (`/`): existing Vite React SPA (kept as fallback, unchanged build/deploy behavior)
- Next app (`/web`): locale-prefixed public SEO pages + Next dashboards

## Apps

### 1) Vite SPA (existing)
- Path: `/`
- Purpose: existing demo fallback
- Build: `npm run build`
- Deploy: Netlify (current default)

### 2) Next app
- Path: `/web`
- Purpose: public SEO pages + salon admin + superadmin
- Runtime: Node.js `>=18.18` (recommended Node 20)

## Root Scripts

- `npm run dev:app` -> run Vite SPA
- `npm run dev:web` -> run Next app in `/web`
- `npm run dev` -> run both
- `npm run build` -> build Vite SPA only
- `npm run build:web` -> build Next app
- `npm run start:web` -> start Next app

## Next Routes (`/web`)

Locale prefix is required for app routes (`en`, `ar`, `cs`, `ru`):

- Public:
  - `/{locale}`
  - `/{locale}/explore`
  - `/{locale}/{country}/{city}`
  - `/{locale}/{country}/{city}/{slug}`
- Auth:
  - `/{locale}/login`
- Dashboards:
  - `/{locale}/app` (salon admin)
  - `/{locale}/sa` (superadmin)

Legacy redirects:

- `/home` -> `/`
- `/{locale}/home` -> `/{locale}`

## Environment

### Root SPA `.env`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_TOKEN` (optional)

### Next `/web/.env`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (recommended)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (optional)
- `NEXT_PUBLIC_SUPERADMIN_CODE` (optional demo override)

More details: `web/README.md`.

## Recommended Deployment Split

- `carechair.com` -> Next app (`/web`)
- `app.carechair.com` -> Vite SPA (root)

This keeps current SPA deployment behavior intact and avoids risky rewrites.
