# API Contracts: Serverless API (`api`)

**Date:** 2026-08-09  
**Base path:** `/api` (same origin as the SPA on Vercel)

## Conventions

- Content type: `application/json`
- CORS + `OPTIONS` via `web/api/_lib/http.ts`
- Admin / cron auth: `Authorization: Bearer <ADMIN_TOKEN>` or `CRON_SECRET` where noted
- Site session: opaque token from login, sent in JSON body (not always Bearer)

---

## Auth

### `POST /api/auth/login`

**Auth:** none  
**Body:** `{ "password": "string" }`  
**Success (200):**

```json
{ "ok": true, "token": "string", "kind": "public|private|daily|legacy" }
```

**Errors:** `401` invalid password; `503` permanent tokens not configured

### `POST /api/auth/session`

**Auth:** none (token in body)  
**Body:** `{ "token": "string" }`  
**Success (200):** `{ "ok": true, "kind": "..." }`  
**Errors:** `401` `{ "ok": false }`; `503` not configured

### `POST /api/auth/daily-code`

**Auth:** site session token in body; **requires** `kind === "public"`  
**Body:** `{ "token": "string" }`  
**Success (200):** weekly 4-digit code + week metadata  
**Errors:** `401` / `403` / `503`

---

## Fixed routes

### `GET /api/fixed-routes`

**Auth:** none  
**Query:** `environment` (`seasonal` default; validated route environment)  
**Success (200):** `{ "points": FixedRoutePointDto[], "environment": "..." }`

`FixedRoutePointDto`: `id`, `mapKey`, `environment`, `left`, `top`, `color`, optional `label` / `imageUrl`, `markerType` (`default` | `kb-document` | `question`; legacy `kb` → `kb-document`), `source: "fixed"`, timestamps.

### `POST /api/fixed-routes`

**Auth:** Admin Bearer  
**Body:** `{ mapKey, left, top, color, environment?, label?, imageUrl?, markerType? }`  
**Success:** created point DTO  
**Errors:** `401`, `400` validation

### `PATCH /api/fixed-routes/:id`

**Auth:** Admin Bearer  
**Body:** partial fields (position, type, label, image, map, environment, color)  
**Success (200):** updated DTO  
**Errors:** `401`, `404`, `400`

### `DELETE /api/fixed-routes/:id`

**Auth:** Admin Bearer  
**Success:** `204` no content  
**Errors:** `401`, `404`

### `GET /api/admin/ping`

**Auth:** Admin Bearer  
**Purpose:** verify admin token from client (`verifyAdminToken`)  
**Success (200):** ok payload

---

## Stats

### `GET /api/stats/visit`

**Auth:** none  
**Success (200):** `{ "impressions": number }`

### `POST /api/stats/visit`

**Auth:** none  
**Two modes:**

1. **Visit increment** — body `{ "visitorId": "string" }` → upserts `site_visitors`, bumps impressions, records daily visit  
2. **Usage batch** — body `{ "visitorId", "sessionId", "events": [...] }` → `recordUsageEvents` (allowed event names in `usageLogs.ts`)

**Client note:** `usageAnalytics.flushUsageEvents` posts usage batches to this same path (comment may still say `/api/stats/usage`; that dedicated route does not exist).

### `GET /api/stats/presence`

**Auth:** none  
**Success (200):** online count in recent window

### `POST /api/stats/presence`

**Auth:** none  
**Body:** `{ "visitorId": "string" }`  
**Success (200):** heartbeat upsert + online count

---

## Admin dashboard

### `GET /api/admin/dashboard`

**Auth:** Admin Bearer  
**Query:**

- default: impressions, unique visitors, online, fixed points, task sync meta, daily stats
- `?view=usage` — usage snapshot (optional `accessKind` filter)

**Success (200):** aggregate JSON  
**Client:** `AdminDashboardPage` + `adminDashboard.ts` exist; page is **not** mounted in `main.tsx`

---

## Tasks (Turso snapshots)

### `GET /api/tasks`

**Auth:** none  
**Query (required):** `gameMode=regular|seasonal|pve`, `lang=es|en`  
**Success (200):** tasks array + meta (`fetchedAt`, …); may be gzip-aware on wire  
**Errors:** `400` missing params; `503` no snapshot yet

**Client:** `siteTasks.ts` can call this; primary SPA load path is still `useTasks` → json.tarkov.dev / GraphQL / cache / fallback.

### `GET|POST /api/cron/sync-tasks`

**Auth:** Bearer `CRON_SECRET` or `ADMIN_TOKEN`  
**Query:** `force=1` to bypass schedule gates  
**Success (200):** sync run outcome (modes × langs)  
**Purpose:** fill/update Turso task snapshots from json.tarkov.dev

---

## External (client-only)

| Provider | Used for |
|----------|----------|
| `https://json.tarkov.dev` | Preferred tasks + map extracts |
| Tarkov GraphQL | Client fallback for non-seasonal tasks |

There is **no** `/api/maps/extracts` handler; extracts are fetched in the browser via `mapExtracts.ts`.

---

_Generated using BMAD Method `document-project` workflow_
