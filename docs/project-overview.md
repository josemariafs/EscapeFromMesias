# Escape From Gorditos - Project Overview

**Date:** 2026-08-09  
**Type:** Multi-part web application (React SPA + Vercel serverless API)  
**Architecture:** Client-rendered SPA with file-based serverless backend and Turso/libSQL persistence

## Executive Summary

Escape From Gorditos is a web quest tracker for **Escape From Tarkov**. Players browse trader side quests and the Story campaign, track progress in the browser, sync progress from Tarkov log files, and plan routes on SVG maps with personal and admin-shared markers.

The product is deployed on Vercel (`web/` is the deploy root). The React frontend talks to colocated `/api/*` serverless functions and external Tarkov data providers (`json.tarkov.dev`, GraphQL fallback). Shared route points, visits, presence, usage analytics, and task snapshots persist in Turso.

## Project Classification

- **Repository Type:** Multi-part (frontend + API under `web/`)
- **Project Type(s):** `web` (React UI), `backend` (Vercel Node handlers)
- **Primary Language(s):** TypeScript, React
- **Architecture Pattern:** Feature-oriented SPA orchestration + thin serverless handlers over shared `_lib` modules

## Multi-Part Structure

### React Frontend (`web`)

- **Type:** web
- **Location:** `web/src`
- **Purpose:** Quest/Story UI, log sync, route maps, site login, analytics client
- **Tech Stack:** React 19, Vite 8, TypeScript 6, Dagre, IndexedDB/localStorage

### Vercel Serverless API (`api`)

- **Type:** backend
- **Location:** `web/api`
- **Purpose:** Site auth, fixed routes CRUD, stats/presence/usage, task sync/snapshots, admin dashboard data
- **Tech Stack:** `@vercel/node`, `@libsql/client` (Turso)

### How Parts Integrate

The SPA calls same-origin `/api/*` via `fetch` wrappers in `web/src/api/`. Admin writes use `Authorization: Bearer ADMIN_TOKEN`. Site gate uses session tokens in `sessionStorage`. Fixed route points and telemetry are shared server-side; quest progress for users remains primarily client-side (localStorage / logs).

## Technology Stack Summary

### Frontend Stack

| Category | Technology | Version / Notes |
|----------|------------|-----------------|
| UI | React | ^19.2 |
| Build | Vite | ^8 |
| Language | TypeScript | ~6.0 |
| Graph layout | @dagrejs/dagre | Story trees |
| Persistence | localStorage, sessionStorage, IndexedDB | Progress, sessions, caches |
| Deploy | Vercel (static + SPA rewrite for `/admin/*`) | |

### API Stack

| Category | Technology | Version / Notes |
|----------|------------|-----------------|
| Runtime | Vercel serverless | File-based routes under `web/api` |
| Database | Turso / libSQL | `@libsql/client` ^0.17 |
| Auth | Bearer admin + site session tokens | Weekly code Europe/Madrid |
| External data | json.tarkov.dev (+ GraphQL fallback on client) | Cron `/api/cron/sync-tasks` → Turso snapshots |

## Key Features

- Side Quests and Story campaign with prerequisite unlocking
- Local progress + Tarkov Logs filesystem sync (Chromium File System Access API)
- Route maps with personal pins, extracts, and admin fixed points (Key Document / question markers)
- Site password / weekly code gate; Gorditos branding for public/daily access
- Visit counter, online presence, and batched usage analytics
- Offline-capable quest data via IndexedDB cache and bundled JSON fallbacks

## Architecture Highlights

- `App.tsx` orchestrates home / quests / routes; `/admin/routes` is pathname-routed in `main.tsx`
- Quest load chain: IndexedDB → json.tarkov.dev → GraphQL (non-seasonal) → stale cache → bundled fallback
- Maps project game coordinates to SVG percentages; layers toggle fixed markers and extracts
- API `ensureSchema()` creates base tables; several stats/sync/usage tables are referenced in SQL but may require external provisioning (brownfield risk)

## Development Overview

### Prerequisites

- Node.js 22 (CI uses 22)
- npm
- For full API locally: Vercel CLI + Turso credentials + env tokens

### Getting Started

```bash
cd web
npm ci
cp .env.example .env.local   # fill TURSO_*, ADMIN_TOKEN, PERMANENT_TOKEN_*
npm run dev                  # Vite only (no /api)
npm run dev:full             # vercel dev on :3000 (API + SPA)
```

### Key Commands

| Action | Command |
|--------|---------|
| Install | `cd web && npm ci` |
| Dev (UI) | `npm run dev` |
| Dev (full API) | `npm run dev:full` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Preview | `npm run preview` |

## Repository Structure

```
EscapeFromGorditos/
├── README.md                 # Product documentation
├── web/                      # Deployable app (Vercel Root Directory)
│   ├── api/                  # Serverless handlers
│   ├── src/                  # React SPA
│   ├── public/               # Maps, markers, traders, branding
│   └── vercel.json
├── docs/                     # Generated BMAD project knowledge (this folder)
├── .github/workflows/ci.yml  # lint + build in web/
└── _bmad/                    # BMAD Method tooling
```

## Documentation Map

- [index.md](./index.md) — Master index for AI-assisted work
- [architecture-web.md](./architecture-web.md) — Frontend architecture
- [architecture-api.md](./architecture-api.md) — API architecture
- [integration-architecture.md](./integration-architecture.md) — Cross-part integration
- [source-tree-analysis.md](./source-tree-analysis.md) — Annotated tree
- [api-contracts-api.md](./api-contracts-api.md) — HTTP contracts
- [data-models-api.md](./data-models-api.md) — Turso schema notes
- [component-inventory-web.md](./component-inventory-web.md) — UI catalog
- [development-guide-web.md](./development-guide-web.md) / [development-guide-api.md](./development-guide-api.md)
- [deployment-guide.md](./deployment-guide.md)

---

_Generated using BMAD Method `document-project` workflow_
