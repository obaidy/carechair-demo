# CareChair Demo Monorepo (Vite SPA + Next.js Public Web)

This repo now contains two apps:

- Root app (`/`): existing Vite React SPA for dashboard/admin flows.
- Public web (`/web`): new Next.js App Router app for SEO pages (`/`, `/explore`, city/service/salon public routes).

The existing SPA routing/build behavior is intentionally preserved.

## Apps

### 1) Dashboard SPA (existing, unchanged)
- Tech: React + Vite
- Purpose: salon/admin dashboard and existing demo app
- Default deployment: Netlify

### 2) Public SEO site (new)
- Tech: Next.js App Router (`/web`)
- Purpose: public landing, explore, city/service listing, salon booking SEO pages
- Recommended deployment: Vercel (can also run on Netlify)

## Development Scripts (root)

- `npm run dev:app` -> run Vite SPA only
- `npm run dev:web` -> run Next.js web app only
- `npm run dev` -> run both in parallel
- `npm run build` -> build Vite SPA only (kept for current Netlify flow)

## Environment Variables

### Root SPA (`.env`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_TOKEN` (optional)
- existing demo vars (`VITE_ADMIN_PASS`, `VITE_SALON_SLUG`, etc.)

### Next public web (`/web/.env`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN` (optional): enables static map preview on salon public page
- `NEXT_PUBLIC_SITE_URL` (optional but recommended): canonical/hreflang base URL

See `web/.env.example`.

## Deployment

### Recommended setup (Option A)

- `carechair.com` -> deploy `/web` Next app (Vercel)
- `app.carechair.com` -> deploy root Vite SPA (Netlify)

This avoids rewrite complexity and keeps current SPA routes/deployment behavior intact.

### If using one provider

Deploy as two separate projects:
- Project 1 build root (`npm run build`) for SPA
- Project 2 build `/web` (`npm --prefix web run build`) for public web

## Public SEO Features in `/web`

- SSR/server data fetching from Supabase with public filters
- Valid public routes:
  - `/`
  - `/explore`
  - `/[country]/[city]`
  - `/[country]/[city]/[slug]` (resolves salon profile + booking or service listing)
- Legacy route redirects:
  - `/home` -> `/`
  - `/en/home`, `/ar/home`, `/cs/home`, `/ru/home` -> `/` (and locale cookie is set)
- Metadata per page (title/description/canonical/hreflang)
- `sitemap.xml` and `robots.txt`
- JSON-LD `LocalBusiness` on salon profile pages
- i18n with `next-intl`: `ar`, `en`, `cs`, `ru` (RTL supported for Arabic)
- Directions links (Apple Maps + Google Maps)
- Static map preview using Mapbox token fallback

## Location Sanity Check (SPA)

Run a lightweight DB sanity script after applying migrations:

```bash
VITE_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
SANITY_SALON_SLUG=your-salon-slug \
npm run sanity:location
```

This verifies:
- primary location upsert works,
- direction links can be generated from stored coordinates,
- invalid latitude is rejected by server-side constraints.
