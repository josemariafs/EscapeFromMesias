# Escape From Gorditos — Documentation Index

**Generated:** 2026-08-09  
**Scan level:** Exhaustive (BMAD `document-project`)  
**Repository type:** Multi-part (`web` frontend + `api` serverless under `web/`)

## Quick start for AI assistants

1. Read [project-overview.md](./project-overview.md) for product and stack.
2. Use [source-tree-analysis.md](./source-tree-analysis.md) to locate code.
3. For UI work → [architecture-web.md](./architecture-web.md) + [component-inventory-web.md](./component-inventory-web.md).
4. For API/DB → [architecture-api.md](./architecture-api.md) + [api-contracts-api.md](./api-contracts-api.md) + [data-models-api.md](./data-models-api.md).
5. For cross-cutting flows → [integration-architecture.md](./integration-architecture.md).
6. For run/deploy → [development-guide-web.md](./development-guide-web.md), [development-guide-api.md](./development-guide-api.md), [deployment-guide.md](./deployment-guide.md).

## Parts

| Part | Path | Docs |
|------|------|------|
| React Frontend | `web/src` | architecture-web, component-inventory-web, development-guide-web |
| Vercel Serverless API | `web/api` | architecture-api, api-contracts-api, data-models-api, development-guide-api |

Machine-readable: [project-parts.json](./project-parts.json)

## Document catalog

| Document | Description |
|----------|-------------|
| [project-overview.md](./project-overview.md) | Executive summary, stack, getting started |
| [architecture-web.md](./architecture-web.md) | SPA architecture & data flows |
| [architecture-api.md](./architecture-api.md) | Serverless architecture |
| [integration-architecture.md](./integration-architecture.md) | How parts and externals connect |
| [source-tree-analysis.md](./source-tree-analysis.md) | Annotated repository tree |
| [api-contracts-api.md](./api-contracts-api.md) | HTTP endpoints |
| [data-models-api.md](./data-models-api.md) | Turso tables & schema gaps |
| [component-inventory-web.md](./component-inventory-web.md) | React component catalog |
| [development-guide-web.md](./development-guide-web.md) | Frontend local workflow |
| [development-guide-api.md](./development-guide-api.md) | API local workflow |
| [deployment-guide.md](./deployment-guide.md) | Vercel + env + checks |
| [project-scan-report.json](./project-scan-report.json) | Workflow scan state |

## Brownfield highlights

- `ensureSchema()` does not create usage / daily stats / task snapshot tables (runtime risk on fresh DB).
- `AdminDashboardPage` and `siteTasks` client helpers exist but are not wired into the main mount path.
- Map extracts are client → json.tarkov.dev (no `/api/maps/extracts`).
- Usage analytics POST to `/api/stats/visit` with `events` (not a separate `/usage` route).

## Existing human docs

- Root [README.md](../README.md) — product features, screenshots, quick start
- Optional screenshots under `docs/screenshots/` (referenced by README)

---

_Generated using BMAD Method `document-project` workflow_
