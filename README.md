# Acumen

> Cambridge IGCSE & A Level exam intelligence — multi-tenant SaaS for schools.

Monorepo containing the marketing site, the application, and shared packages.

## Layout

```
acumen/
├── apps/
│   ├── marketing/        Astro static site → acumen.app
│   └── app/              Vite + React SPA + Hono API → app.acumen.app + api.acumen.app
│       ├── client/       Frontend (Vite + React + Tailwind + shadcn-style ui)
│       ├── server/       Backend (Hono + Drizzle + Better Auth + Resend + Paystack)
│       └── shared/       Types + Zod schemas shared client ↔ server
├── cloudbuild-staging.yaml
├── cloudbuild-prod.yaml
├── DEPLOY.md             Cloud Build / Cloud Run / Secret Manager setup
└── package.json          npm workspaces (root)
```

## Quick start

```bash
# 1. Install (workspaces)
npm install

# 2. Configure env
cp apps/app/server/.env.example apps/app/server/.env       # fill DATABASE_URL, secrets
cp apps/app/client/.env.example apps/app/client/.env
cp apps/marketing/.env.example apps/marketing/.env

# 3. Push schema to Neon
npm run db:push

# 4. Run everything in parallel
npm run dev
```

After this:
- **Marketing site** at `http://localhost:4322`
- **App client** at `http://localhost:5173`
- **App API** at `http://localhost:8787`

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) — branch-based deploys to Cloud Run via Cloud Build:

| Branch | Marketing | App client | App API |
|--------|-----------|------------|---------|
| `main` | acumen.40analytics.com | app.acumen.40analytics.com | api.acumen.40analytics.com |
| `staging` | staging.acumen.40analytics.com | app-staging.acumen.40analytics.com | api-staging.acumen.40analytics.com |

## Tech

- **Frontend (app):** Vite 6, React 19, React Router v7 (declarative), TanStack Query, Tailwind, Lucide, Recharts
- **Frontend (marketing):** Astro 4
- **Backend:** Hono on Node 20, Drizzle ORM, Neon serverless Postgres
- **Auth:** Better Auth (Google OAuth + magic link via Resend)
- **Payments:** Paystack (mobile money + cards, GHS by default)
- **Email:** Resend
- **Hosting:** Cloud Run · Cloud Build · Artifact Registry · Secret Manager (project `middleware-348515`)
