# CareChair Web (Next.js App Router)

This app lives in `/web` and is the public + dashboard Next.js frontend.
The root Vite SPA remains untouched as fallback.

## Requirements

- Node.js `>=18.18` (recommended Node 20)
- npm `>=9`

## Environment Variables

Create `web/.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (recommended for canonical + sitemap)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (optional for static map preview)
- `NEXT_PUBLIC_SUPERADMIN_CODE` (optional; defaults to `1989` in demo)

## Local Development

```bash
cd web
npm install
npm run dev
```

Or from repo root:

```bash
npm run dev:web
```

## Build

```bash
cd web
npm run build
npm run start
```

Or from repo root:

```bash
npm run build:web
npm run start:web
```

## Public Routes

Locale prefix is required:

- `/{locale}`
- `/{locale}/explore`
- `/{locale}/{country}/{city}`
- `/{locale}/{country}/{city}/{slug}`

Supported locales:

- `en`, `ar`, `cs`, `ru`

Legacy redirects:

- `/home` -> `/`
- `/{locale}/home` -> `/{locale}`

## Dashboard Routes

- `/{locale}/login`
- `/{locale}/app` (salon admin)
- `/{locale}/sa` (superadmin)

Middleware enforces:

- locale prefix redirect
- auth redirect for `/app` and `/sa`
- role guard with `/{locale}/403`

## Netlify Deployment (for `/web` only)

Create a separate Netlify site for this folder.

- Base directory: `web`
- Build command: `npm run build`
- Publish directory: `.next`
- Node version: `20`

Install Netlify Next runtime plugin in site settings if required (`@netlify/plugin-nextjs`).

Recommended production split:

- `carechair.com` -> Next app (`/web`)
- `app.carechair.com` -> existing Vite SPA
