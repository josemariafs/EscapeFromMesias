# Development Guide: Serverless API (`api`)

**Date:** 2026-08-09

## Prerequisites

- Node.js 22 + npm
- [Vercel CLI](https://vercel.com/docs/cli) (via `npx vercel`)
- Turso database URL + auth token
- Secrets from `web/.env.example`

## Environment

Copy `web/.env.example` → `web/.env.local` (and/or Vercel project env for deploy):

| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` | libSQL URL |
| `TURSO_AUTH_TOKEN` | Turso auth |
| `ADMIN_TOKEN` | Bearer for admin writes / dashboard / cron fallback |
| `PERMANENT_TOKEN_PUBLIC` | Site gate + weekly code reveal |
| `PERMANENT_TOKEN_PRIVATE` | Site gate (no weekly code reveal) |
| `PERMANENT_TOKEN_MV` | Site gate + weekly code reveal (like public) |
| `CRON_SECRET` | Optional; Vercel Cron Bearer for task sync |

Never use `VITE_` prefix for these secrets.

## Local run

```bash
cd web
npm ci
npm run dev:full
```

Opens Vercel dev (default listen `3000`) so `/api/*` resolves to `web/api/**/*.ts`.

## Adding an endpoint

1. Add `web/api/<path>.ts` (or folder + `index.ts` / `[id].ts`)
2. Export default `async function handler(req, res)`
3. Use `_lib/http` for CORS/OPTIONS; `_lib/auth` for admin; `ensureSchema` + `getDb` for SQL
4. Keep business logic in `_lib` when shared

## Schema caveat

`ensureSchema()` only ensures fixed routes + site_stats + site_visitors. Usage/daily/task tables must already exist (or be added to bootstrap). See [data-models-api.md](./data-models-api.md).

## Useful curls

```bash
# Public fixed points
curl "http://localhost:3000/api/fixed-routes?environment=seasonal"

# Admin create (example shape)
curl -X POST http://localhost:3000/api/fixed-routes \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mapKey":"customs","left":50,"top":50,"color":"#ff0000","markerType":"default"}'

# Force task sync
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/api/cron/sync-tasks?force=1"
```

## Related docs

- [architecture-api.md](./architecture-api.md)
- [api-contracts-api.md](./api-contracts-api.md)
- [deployment-guide.md](./deployment-guide.md)

---

_Generated using BMAD Method `document-project` workflow_
