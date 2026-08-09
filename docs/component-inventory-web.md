# Component Inventory: React Frontend (`web`)

**Date:** 2026-08-09  
**Location:** `web/src/components`

## Shell & access

| Component | Role |
|-----------|------|
| `LoginScreen` | Site password gate UI |
| `HomeUsageScreen` | Post-login home: choose Quests vs Routes (+ usage framing) |
| `AppFooter` | Footer branding / links |
| `HeaderAccessCode` | Reveal weekly code (public sessions) |
| `DailyCodeModal` | Modal for weekly access code |
| `CrtViewTransition` | CRT-style view transition wrapper |
| `EyeToggleButton` | Visibility toggle control |

## Quests / Side Quests

| Component | Role |
|-----------|------|
| `TaskCard` | Quest card (trader art, status, maps, items) |
| `TaskDetail` | Selected quest detail panel |
| `TaskTableView` | Tabular quest listing |
| `TaskPrereqTooltip` | Prerequisite hover details |
| `ActiveTasksView` | In-progress quests grouped by map |
| `TraderLevelsPanel` | Trader level requirements / status |
| `GameModeControl` | Regular / seasonal / PvE mode switch |
| `DataSourceControl` | Live vs fallback / data source UX |

## Story

| Component | Role |
|-----------|------|
| `StoryView` | Story campaign shell |
| `StoryDetail` | Selected story node detail |
| `StoryTreeView` | Local storyline graph (bundled JSON) |
| `StoryApiTreeView` | API/story-related trader quest graph |
| `StoryNodeCard` | Node card in story trees |

## Maps / Routes

| Component | Role |
|-----------|------|
| `RouteMapsView` | Map list + interactive SVG overlays (personal + fixed pins, zones, drag) |
| `MapViewerModal` | Full-screen / modal map viewer with pan-zoom |
| `MapFloatingTooltip` | Floating label/tooltip over map |
| `FixedLayerToggles` | Toggle fixed markers / extracts layers |

## Admin

| Component | Role | Wired? |
|-----------|------|--------|
| `AdminRoutesPage` | Edit shared fixed points (`/admin/routes`) | Yes (`main.tsx`) |
| `AdminLoginCard` | Admin token entry | Used by admin routes |
| `AdminDashboardPage` | Visits/usage/task sync dashboard | **No** — not mounted |

## Orchestration (not under `components/`)

| Module | Role |
|--------|------|
| `App.tsx` | Main product modes, quests, routes, site-gated shell |
| `context/SiteAuthContext.tsx` | `SiteAuthGate` wrapping app |
| `hooks/*` | Domain state (tasks, progress, maps, logs, presence, …) |

## Styling

- Primary stylesheet: `web/src/App.css` (markers, layers, zone annotations, layout)
- Global: `web/src/index.css`
- i18n strings: `web/src/i18n/translations.ts`

---

_Generated using BMAD Method `document-project` workflow_
