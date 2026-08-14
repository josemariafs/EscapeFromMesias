# Deployment Guide

**Date:** 2026-08-09  
**Platform:** Vercel  
**App directory:** `web/`

## Production shape

- **Framework:** Vite (configured in `web/vercel.json`)
- **Build:** `npm run build` → `dist/`
- **Serverless:** files under `web/api/**` become `/api/*`
- **SPA admin:** rewrite `/admin/:path*` → `/index.html`

## Vercel project settings

| Setting | Value |
|---------|--------|
| Root Directory | `web` (when linking the git monorepo root) |
| Build Command | `npm run build` (default from vercel.json) |
| Output Directory | `dist` |
| Node | 22 recommended (CI) |

**Important:** Deploy from the **repository root** with Root Directory = `web`. Deploying with cwd already inside `web/` while Root Directory is also `web` fails (“Root Directory web does not exist”).

## Required environment variables

Set in Vercel Project → Settings → Environment Variables (Production / Preview as needed):

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ADMIN_TOKEN`
- `PERMANENT_TOKEN_PUBLIC`
- `PERMANENT_TOKEN_PRIVATE`
- `PERMANENT_TOKEN_MV`
- `CRON_SECRET` (if using Vercel Cron for task sync)

## CLI deploy (example)

From repo root:

```bash
npx vercel deploy --prod --yes
```

Ensure the linked project has Root Directory `web` and env vars configured.

## CI

`.github/workflows/ci.yml` runs in `web/`: install, lint, build. It does not deploy.

## Post-deploy checks

1. Site login with permanent token / weekly code
2. Quests load (live or fallback)
3. Routes: fixed points GET; admin write with `ADMIN_TOKEN` at `/admin/routes`
4. Visit counter / presence increment
5. Optional: force sync `GET /api/cron/sync-tasks?force=1` with admin/cron auth; then `GET /api/tasks?gameMode=regular&lang=es`

## Database

Confirm Turso has not only `ensureSchema()` tables but also usage/daily/task tables if those features are used in production. See [data-models-api.md](./data-models-api.md).

---

_Generated using BMAD Method `document-project` workflow_
