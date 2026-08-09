# Architecture: React Frontend (`web`)

**Date:** 2026-08-09  
**Part:** `web` (`web/src`)  
**Pattern:** Feature-oriented SPA with centralized orchestration in `App.tsx`

## Overview

The frontend is a Vite + React 19 client SPA. Most of the product surface is a single long-lived `App` that switches between Home, Side Quests, Story, and Route Maps. Admin route editing is a separate entry via pathname `/admin/routes`. State is mostly React hooks plus browser storage; server shared state is fetched through thin `web/src/api/*` clients.

## Architecture Pattern

**Feature-oriented SPA orchestration**

- One root component owns product modes, auth gate, data source, and progress
- Domain logic lives in hooks (`useTasks`, `useProgress`, `useRouteMaps`, …)
- Presentation in `components/`
- Pure utilities in `utils/`
- No React Router; navigation is local state + one pathname check for admin

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | React | ^19.2 | UI |
| Build | Vite | ^8 | Dev server / production bundle |
| Language | TypeScript | ~6.0 | Types (`strict`) |
| Layout | @dagrejs/dagre | ^1.1.5 | Story tree graphs |
| Storage | localStorage / sessionStorage / IndexedDB | browser | Progress, sessions, task cache |
| Data | fetch + GraphQL | — | Tarkov tasks, site API |
| Deploy | Vercel | — | Static assets + SPA rewrite |

## Layer Details

### Entry & Shell

- `main.tsx` — mounts React; if `pathname` starts with `/admin/routes`, renders `AdminRoutesPage` only
- `App.tsx` — main product shell (home, quests, routes, modals, site gate)
- `App.css` + `index.css` — global / component styles (no CSS modules)

### State Management

| Concern | Mechanism |
|---------|-----------|
| Site session | `SiteAuthContext` + `sessionStorage` (`eg_site_session`) |
| Quest progress | `useProgress` → localStorage |
| Story unlock | `useStoryProgress` → localStorage |
| Tasks | `useTasks` → IndexedDB cache + remote + fallback JSON |
| Personal routes | `useRouteMaps` → localStorage |
| Fixed routes | `useFixedRouteMaps` → `/api/fixed-routes` |
| Extracts | `useMapExtracts` → `json.tarkov.dev` (client) |
| Logs sync | `useTarkovLogSync` → File System Access + log parser |
| Usage | `usageAnalytics` buffer → `POST /api/stats/visit` with `events` |

No Redux/Zustand. Patterns: `useState`/`useEffect`/`useMemo`/`useCallback`, custom hooks, context for site auth.

### Data Access

| Module | Role |
|--------|------|
| `api/tarkovJson.ts` | Prefer json.tarkov.dev |
| `api/tarkov.ts` | GraphQL fallback (non-seasonal) |
| `api/fixedRoutes.ts` | Shared route points CRUD + admin ping |
| `api/mapExtracts.ts` | Map extracts from json.tarkov.dev |
| `api/siteAuth.ts` | Login / session / daily-code |
| `api/siteStats.ts` | Visits, presence |
| `api/siteTasks.ts` | Turso `/api/tasks` helpers (**not wired into App**) |
| `api/adminDashboard.ts` | Admin dashboard fetch (**UI not mounted**) |

### Auth & Security (client)

- Site gate: `useSiteAuth` → POST `/api/auth/login`, Bearer on verify
- Admin: `useAdminAuth` → `sessionStorage` token matching server `ADMIN_TOKEN`
- Sensitive tokens never baked into client env; only `VITE_*` public vars
- File System Access used for Tarkov Logs folder (user-granted)

## Data Flow

### Quest loading

```
useTasks
  → IndexedDB hit (fresh?) → return
  → fetchTasksFromJson (json.tarkov.dev)
  → else fetchTasks GraphQL (if not seasonal)
  → else stale IndexedDB
  → else bundled tasks-fallback-*.json
```

### Progress

```
User / log sync → useProgress (localStorage)
                → unlock evaluation (utils/unlock, storylineUnlock)
                → Task / Story UI
```

### Route maps

```
Personal points ← useRouteMaps (local)
Fixed points    ← useFixedRouteMaps ← GET /api/fixed-routes
Extracts        ← useMapExtracts ← json.tarkov.dev
UI              ← RouteMapsView / MapViewerModal (pan-zoom, layers, drag)
Admin writes    ← AdminRoutesPage → Bearer ADMIN_TOKEN → /api/fixed-routes
```

## Key Components

| Area | Components |
|------|------------|
| Shell | `App`, `AppFooter`, `LoginScreen`, `HomeUsageScreen` |
| Quests | `TaskCard`, `TaskDetail`, `TaskTableView`, `ActiveTasksView`, `TraderLevelsPanel` |
| Story | `StoryView`, `StoryDetail`, `StoryTreeView`, `StoryApiTreeView`, `StoryNodeCard` |
| Maps | `RouteMapsView`, `MapViewerModal`, `FixedLayerToggles`, `MapFloatingTooltip` |
| Admin | `AdminRoutesPage`, `AdminLoginCard` (`AdminDashboardPage` exists, unwired) |
| Controls | `GameModeControl`, `DataSourceControl`, `HeaderAccessCode`, `EyeToggleButton` |

Full catalog: [component-inventory-web.md](./component-inventory-web.md)

## Source Tree

See [source-tree-analysis.md](./source-tree-analysis.md) for annotated layout. Critical paths:

- `web/src/App.tsx` — product orchestration
- `web/src/hooks/` — domain state
- `web/src/utils/` — unlock, maps, logs, analytics
- `web/src/data/` — storyline + fallbacks
- `web/public/maps|markers|traders/` — static assets

## Notable Gaps / Brownfield Notes

- `AdminDashboardPage` and `fetchAdminDashboard` are implemented but not mounted
- `siteTasks.ts` not used by main app flow
- No React Router; deep links limited (`/admin/routes` only)
- CI runs lint + build only (no unit tests)

## Development Notes

- Prefer matching existing hook + component patterns
- Keep i18n keys in `i18n/translations.ts` for EN/ES
- Map CSS lives in `App.css` (zone annotations, markers, layers)
- Dev without API: `npm run dev`; with API: `npm run dev:full`

---

_Generated using BMAD Method `document-project` workflow_
