---
project_name: 'EscapeFromGorditos'
user_name: 'RA_MeSiAs'
date: '2026-08-09'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - code_quality_rules
  - workflow_rules
  - dont_miss_rules
status: complete
rule_count: 52
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **App root:** `web/` only for product code. Vercel Root Directory = `web` when linking the **repo root** (do not set Root Directory `web` if the CLI cwd is already `web/`).
- **UI:** React/React DOM `^19.2.6`, Vite `^8.0.12`, TypeScript `~6.0.2`, `"type": "module"`.
- **Libs:** `@dagrejs/dagre` `^3` (Story graphs). `@libsql/client` `^0.17` and `@vercel/node` `^5.9` belong to **serverless API** (`web/api`), not the React bundle.
- **Lint:** ESLint 10 flat config; `react-hooks/set-state-in-effect` intentionally **off**.
- **Explicitly absent:** React Router, Redux/Zustand, Tailwind/CSS-in-JS system, Prettier project config, unit-test runner (CI = lint + build).
- **Node:** 22 (CI).
- **Local dual runtime:** `npm run dev` = Vite + **auth-only** `/api/auth/*` middleware. Full Turso-backed `/api/*` requires `npm run dev:full` (`vercel dev` :3000).
- **Product shape:** Tarkov quest/story tracker + route maps + site gate — not a generic multi-page app framework.

## Critical Implementation Rules

### Language-Specific Rules

- Prefer `import type { X }` for type-only imports (`verbatimModuleSyntax` / `erasableSyntaxOnly`).
- **Split import conventions by tree:**
  - `web/src/**`: relative imports **without** `.js` (Vite/TSX).
  - `web/api/**`: relative imports **with** `.js` extension (Vercel/Node ESM), even when the source file is `.ts`.
- Do not add path aliases (`@/`) — none configured today.
- Keep unused locals/params out (`noUnusedLocals` / `noUnusedParameters`).
- Client API helpers: throw `Error` (optional Spanish user-facing message); no shared Result monad.
- Server handlers: `OPTIONS` via `_lib/http`; JSON errors with explicit status; never leak secrets in bodies.
- UI strings: both EN and ES in `src/i18n/translations.ts` in the same change.

### Framework-Specific Rules

**React / SPA**
- No React Router: modes in `App.tsx` state; only `/admin/routes` special-cased in `main.tsx` (keep `vercel.json` `/admin/*` rewrite).
- Domain hooks in `src/hooks/` + components in `src/components/`; no new global stores.
- Site gate via `SiteAuthGate` — do not bypass.
- Progress/personal routes → **localStorage**; task cache → **IndexedDB**; site/admin tokens → **sessionStorage**. Do not move user progress to Turso unless asked.
- Map/marker styles in `App.css` beside existing layer/annotation rules.
- Keep marker helpers in sync: `src/types/routes.ts` ↔ `api/_lib/markers.ts` (`kb` → `kb-document`; `question` labelless).

**Serverless API**
- One file ≈ one route under `web/api/**`; shared logic in `_lib/`.
- Fixed points: `/api/fixed-routes` (not `/api/routes/fixed`). Writes need `Authorization: Bearer ADMIN_TOKEN`.
- Usage events: `POST /api/stats/visit` with `{ visitorId, sessionId, events }` — no `/api/stats/usage`.
- Extracts: client → `json.tarkov.dev` (`mapExtracts.ts`), not `/api/maps/extracts`.
- `ensureSchema()` only: `fixed_route_points`, `site_stats`, `site_visitors`. Usage/daily/task tables are not auto-created.
- Do not mount `AdminDashboardPage` or switch SPA task load to `/api/tasks` without an explicit product decision (`useTasks` owns live/fallback).

### Testing Rules

- No unit/e2e runner in-repo — do not add Jest/Vitest/Playwright unless the user asks.
- Done means: `cd web && npm run lint && npm run build` (matches CI).
- Manual smoke when relevant: quests EN/ES, progress unlock, routes/admin drag+fixed pins, site gate / weekly code (`public` only), stats under `dev:full`.
- If adding tests later: convention + npm script + CI in the same change.
- Do not weaken TS/ESLint to green CI.

### Code Quality & Style Rules

- Naming: `PascalCase.tsx` components (`export function Name`); hooks `useThing.ts`; utils/api `camelCase.ts`.
- Extract reusable logic to hooks/utils; avoid inventing a deep `services/` layer.
- Styles: `App.css` / `index.css` only unless asked for another system.
- Update types + markers + CSS + admin/UI together for map/marker features.
- Minimal diffs; no unrelated reformatting or Prettier drive-bys.

### Development Workflow Rules

- App code in `web/`; BMAD knowledge in `docs/`; this file in `_bmad-output/`.
- Env from `web/.env.example` → `.env.local`. Never commit secrets; never `VITE_` for server secrets.
- Deploy from **repo root** with Root Directory `web`.
- Cron `/api/cron/sync-tasks` is not the SPA primary quest source.
- Commit only when the user asks; no force-push/`--no-verify`/unsafe amend unless explicitly requested.
- Agents: `docs/index.md` for orientation; **this file** for implementation guardrails.

### Critical Don't-Miss Rules

**Do not**
- Assume `npm run dev` exposes Turso APIs (only `/api/auth/*` emulated).
- Invent REST paths — see `docs/api-contracts-api.md`.
- Drop map CSS (zones, layers, Key Document label-above-image, drag cursors) without checking `RouteMapsView` + `App.css`.
- Treat legacy `kb` as a separate product type.
- Add React Router “while you’re here.”
- Rely on `ensureSchema()` for usage/daily/task-snapshot tables on a fresh Turso DB.
- Silently replace `useTasks` with `/api/tasks`.

**Edge cases**
- Weekly codes: Europe/Madrid, Monday 05:00. PUBLIC and MV each derive a distinct 4-digit code. Reveal only for permanent `public` / `mv` (own audience). `daily` / `daily-mv` cannot reveal.
- Game mode (`regular` / `seasonal` / `pve`) affects task sources and route `environment`.
- Logs sync needs Chromium File System Access.
- Admin dashboard exists but is unwired — do not mount unless asked.

**Security**
- Admin mutations and cron force-sync require server-side Bearer secrets.
- Visitor IDs are not auth — never authorize privileged actions from them alone.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing code.
- Follow these rules; when unsure, prefer the more restrictive option.
- Use `docs/index.md` for architecture/API detail; use this file for “do / don’t” constraints.
- Update this file if new unobvious patterns emerge.

**For Humans:**

- Keep this lean and agent-focused.
- Update when the stack or deploy/auth patterns change.
- Review periodically; remove rules that become obvious.

Last Updated: 2026-08-09
