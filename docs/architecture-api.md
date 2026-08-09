# Architecture: Vercel Serverless API (`api`)

**Date:** 2026-08-09  
**Part:** `api` (`web/api`)  
**Pattern:** File-based serverless handlers + shared `_lib` modules over Turso

## Overview

The API is a set of Vercel Node serverless functions under `web/api`. Handlers validate HTTP method/auth, then call `_lib` helpers for DB, crypto session auth, markers, and stats. Persistence is Turso (libSQL) via `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

## Architecture Pattern

**Thin route handlers + shared libraries**

- Each `*.ts` file under `web/api/**` is one endpoint (Vercel file routing)
- Cross-cutting concerns in `web/api/_lib/`
- No Express/Fastify app shell; each export is a `VercelRequest`/`VercelResponse` handler

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Runtime | @vercel/node | ^5.6.7 | Types + Node serverless |
| DB client | @libsql/client | ^0.17.0 | Turso / libSQL |
| Language | TypeScript | (via web tsconfig) | Handlers |
| Auth | HMAC SHA-256 | Node crypto | Site sessions |
| Timezone | Europe/Madrid | env-aware | Weekly code windows |

## Layer Details

### HTTP / Routing

Vercel maps paths to files, for example:

| Path | File |
|------|------|
| `POST /api/auth/login` | `api/auth/login.ts` |
| `POST /api/auth/session` | `api/auth/session.ts` |
| `POST /api/auth/daily-code` | `api/auth/daily-code.ts` |
| `GET/POST /api/fixed-routes` | `api/fixed-routes/index.ts` |
| `PATCH/DELETE /api/fixed-routes/:id` | `api/fixed-routes/[id].ts` |
| `GET /api/admin/ping` | `api/admin/ping.ts` |
| `GET /api/admin/dashboard` | `api/admin/dashboard.ts` |
| `GET/POST /api/stats/visit` | `api/stats/visit.ts` (visits + usage events) |
| `GET/POST /api/stats/presence` | `api/stats/presence.ts` |
| `GET /api/tasks` | `api/tasks/index.ts` |
| `GET/POST /api/cron/sync-tasks` | `api/cron/sync-tasks.ts` |

Shared helpers: `http.ts` (CORS/preflight, body, errors), `auth.ts`, `db.ts`, `environment.ts`, `siteAccess.ts`, `markers.ts`, `usageLogs.ts`, `siteStatsDaily.ts`, `taskSync.ts`, `maps.ts`, `image.ts`.

### Auth Model

1. **Admin Bearer** — `Authorization: Bearer <ADMIN_TOKEN>` for fixed-route writes, admin ping/dashboard, optional cron force
2. **Cron** — Bearer `CRON_SECRET` or `ADMIN_TOKEN` for `/api/cron/sync-tasks`
3. **Site session** — permanent tokens or weekly code → issued token; validated via `POST /api/auth/session`; public sessions can fetch weekly code
4. **Public reads** — `GET /api/fixed-routes`, visit impressions, tasks snapshot
5. **Visitor identity** — client-generated visitor/session ids for visits/presence/usage (not cryptographic auth)

### Data Layer

- `getDb()` lazily creates libSQL client from env
- `ensureSchema()` creates/migrates:
  - `fixed_route_points` (+ column ALTERs)
  - `site_stats`
  - `site_visitors`
- **Important:** usage, daily stats, and task snapshot tables are **referenced** but **not** created in `ensureSchema()`. See [data-models-api.md](./data-models-api.md).

### Domain Modules

| Module | Responsibility |
|--------|----------------|
| `markers.ts` | Normalize marker types (`kb-document`, legacy `kb` alias, question, etc.) |
| `siteAccess.ts` | Weekly password, permanent tokens, session issue/verify |
| `usageLogs.ts` | Batched usage event persistence |
| `siteStatsDaily.ts` | Daily rollups for admin dashboard |
| `environment.ts` | Required env validation |

## Data Flow

### Fixed route point write

```
Client (AdminRoutesPage)
  → Authorization: Bearer ADMIN_TOKEN
  → POST /api/fixed-routes | PATCH/DELETE /api/fixed-routes/:id
  → auth check → ensureSchema → SQL on fixed_route_points
  → JSON response
```

### Site login

```
Client password
  → POST /api/auth/login { password }
  → match weekly code or PERMANENT_TOKEN_*
  → issue session token + kind
  → client stores in sessionStorage
  → POST /api/auth/session to re-validate
```

### Visit / presence / usage

```
Anonymous client visitorId [/ sessionId + events]
  → POST /api/stats/visit (visit OR usage batch)
  → POST /api/stats/presence (heartbeat)
  → optional daily aggregates + usage tables for dashboard
```

## Source Tree

```
web/api/
├── _lib/           # Shared server utilities
├── admin/          # Dashboard + ping
├── auth/           # Login, session, daily-code
├── cron/           # Task sync cron
├── fixed-routes/   # Shared route points
├── stats/          # Visit (+ usage), presence
└── tasks/          # Serve Turso snapshots
```

## Brownfield Risks

- Schema drift: `ensureSchema()` incomplete vs SQL usage
- Task cron fills Turso snapshots; SPA still prefers live Tarkov JSON/GraphQL
- Admin dashboard API exists; React page not mounted in `main.tsx`


## Development Notes

- Run with `cd web && npm run dev:full` (Vercel CLI)
- Required env: see `web/.env.example` and [development-guide-api.md](./development-guide-api.md)
- Keep handlers thin; put SQL and validation in `_lib`

---

_Generated using BMAD Method `document-project` workflow_
