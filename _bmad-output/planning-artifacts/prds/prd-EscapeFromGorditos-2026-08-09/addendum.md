# Addendum — Escape From Gorditos PRD

Technical and ops detail extracted during brownfield formalization. **Not** requirements language; see `prd.md` for FRs.

## Canonical knowledge

- Product knowledge index: `docs/index.md`
- Agent implementation guardrails: `_bmad-output/project-context.md`
- API contracts: `docs/api-contracts-api.md`
- Data/schema risks: `docs/data-models-api.md`

## Mechanism notes (do not elevate to FRs without product intent)

| Topic | Reality |
|-------|---------|
| Quest live source | Prefer `json.tarkov.dev`; GraphQL fallback (non-seasonal); IndexedDB ~6h; bundled JSON fallback |
| Story narrative | Bundled `web/src/data/storyline.json` (TarkovBuddy-derived) |
| Extracts | Browser → json.tarkov.dev (no `/api/maps/extracts`) |
| Fixed markers API | `/api/fixed-routes`; marker types `default` \| `kb-document` \| `question` (`kb` legacy alias) |
| Usage ingest | `POST /api/stats/visit` with `events[]` (not `/api/stats/usage`) |
| Task snapshots | Cron `/api/cron/sync-tasks` → Turso; `GET /api/tasks` optional; SPA primary path remains `useTasks` |
| Admin dashboard | `AdminDashboardPage` + `/api/admin/dashboard` exist; page not mounted in `main.tsx` |
| siteTasks client | `web/src/api/siteTasks.ts` can call `/api/tasks`; not wired into primary SPA load |
| Local dual runtime | `npm run dev` emulates `/api/auth/*` only; `npm run dev:full` for Turso APIs (fixed markers, stats) |
| Schema gap | `ensureSchema()` creates fixed_route_points, site_stats, site_visitors only |
| README drift | README still describes GraphQL as primary Side Quest source; product truth is json.tarkov.dev-first (see FR-20) |

## Rejected-for-this-PRD alternatives

- Writing a greenfield feature roadmap instead of as-is baseline — deferred; owner chose formalize-existing.
- Treating unwired Admin Dashboard as shipped UX — explicitly non-goal for baseline UI.

## Research note

No external competitive landscape research was required for an as-is formalization; sources were internal docs + README.
