# Data Models: Turso / libSQL (`api`)

**Date:** 2026-08-09  
**Store:** Turso (libSQL), client `@libsql/client`  
**Schema bootstrap:** `ensureSchema()` in `web/api/_lib/db.ts`

## Summary

`ensureSchema()` creates and migrates the **core** tables used for fixed routes and visit/presence counters. Several analytics and task-sync tables are **referenced in SQL** but **not** created by `ensureSchema()`. Production databases may already contain those tables from manual migrations; a fresh Turso DB will fail usage ingest, daily stats, or task snapshot reads until those tables exist.

---

## Tables created by `ensureSchema()`

### `fixed_route_points`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Generated server-side |
| `map_key` | TEXT | Validated map id |
| `environment` | TEXT | Added via ALTER; backfilled (historical → seasonal) |
| `left_pct` | REAL | 0–100 map % |
| `top_pct` | REAL | 0–100 map % |
| `color` | TEXT | Pin color |
| `label` | TEXT | Nullable; cleared for labelless types |
| `image_url` | TEXT | Optional (ALTER) |
| `marker_type` | TEXT | `default` / `kb-document` / `question` (ALTER + default) |
| `created_at` / `updated_at` | TEXT | ISO timestamps |

Index: `idx_fixed_routes_map(map_key)`.

### `site_stats`

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | e.g. `impressions` |
| `value` | INTEGER | Counter |

### `site_visitors`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Client visitor id |
| `first_seen_at` | TEXT | |
| `last_seen_at` | TEXT | Also used for online window |
| `visit_count` | INTEGER | |

---

## Tables used but not created in `ensureSchema()`

Documented from SQL in `_lib` / admin handlers. Exact DDL may live only in production Turso.

### Daily site stats (`siteStatsDaily.ts`)

- `site_daily_visitor_hits` — `(day_key, visitor_id)` uniqueness for unique visitors
- `site_daily_stats` — `day_key`, `visits`, `unique_visitors`, `updated_at`

### Usage analytics (`usageLogs.ts`)

- `usage_events` — raw events: `id`, `visitor_id`, `session_id`, `event_name`, `access_kind`, `props_json`, `day_key`, `occurred_at`
- `usage_daily_counts` — per `(day_key, event_name)` aggregates
- `usage_daily_event_visitors` — unique visitors per event/day

Retention: ~90 days (Europe/Madrid day keys). Event allowlist in `USAGE_EVENT_NAMES`.

### Task sync (`taskSync.ts`, admin dashboard)

- `task_snapshots` — per `(game_mode, lang)`: gzip payload, content hash, meta
- `task_sync_days` — daily attempt/status for cron
- `task_snapshot_changes` — change history without full payloads

---

## DTOs (API boundary)

### `FixedRoutePointDto` (`db.ts`)

CamelCase JSON for clients: `mapKey`, `left`, `top`, `markerType`, `imageUrl`, `source: "fixed"`, etc.

### Marker types (`markers.ts`)

Canonical: `default`, `kb-document`, `question`. Legacy alias: `kb` → `kb-document`.

### Site access kinds

`public` | `private` | `daily` | `legacy` (login / usage props).

---

## Brownfield risk

| Risk | Impact |
|------|--------|
| Missing usage/daily/task tables on new DB | POST visit with events / daily rollup / GET tasks / admin usage view fail at runtime |
| Partial ALTERs on old DBs | Handled for `fixed_route_points` columns via `ensureColumn` |
| Client comment `/api/stats/usage` | Misleading; usage posts to `/api/stats/visit` with `events` |

**Recommendation for operators:** keep a checked-in SQL migration (or extend `ensureSchema`) for all tables above so greenfield Turso matches production.

---

_Generated using BMAD Method `document-project` workflow_
