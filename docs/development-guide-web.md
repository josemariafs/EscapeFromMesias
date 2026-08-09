# Development Guide: React Frontend (`web`)

**Date:** 2026-08-09

## Prerequisites

- Node.js 22 (matches CI)
- npm
- Chromium-based browser recommended for Tarkov Logs (File System Access API)

## Setup

```bash
cd web
npm ci
cp .env.example .env.local   # optional for UI-only; required for API features
npm run dev                  # Vite, typically http://localhost:5173
```

UI-only mode works without Turso; fixed routes, site login, and stats need `npm run dev:full` + env (see [development-guide-api.md](./development-guide-api.md)).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite SPA only |
| `npm run dev:full` | `vercel dev` on port 3000 (SPA + `/api`) |
| `npm run build` | Version resolve + `tsc -b` + Vite build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Conventions

- TypeScript `strict` via `tsconfig.app.json`
- Prefer existing hooks + components over new global state libraries
- Keep EN/ES strings in `i18n/translations.ts`
- Map/marker CSS belongs in `App.css` alongside existing layer styles
- Do not commit secrets (`.env.local`)

## Key entry points

- `src/main.tsx` — `/admin/routes` vs `App`
- `src/App.tsx` — product shell
- `src/hooks/useTasks.ts` — quest load chain
- `src/components/RouteMapsView.tsx` — map interactions

## Testing

- No unit test suite in-repo; CI = lint + build (`.github/workflows/ci.yml`)
- Manual: quests load, progress unlock, routes drag, admin fixed points, site gate

## Related docs

- [architecture-web.md](./architecture-web.md)
- [component-inventory-web.md](./component-inventory-web.md)
- [integration-architecture.md](./integration-architecture.md)

---

_Generated using BMAD Method `document-project` workflow_
