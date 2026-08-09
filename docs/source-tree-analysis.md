# Source Tree Analysis

**Date:** 2026-08-09

```
EscapeFromGorditos/
├── README.md                      # Product docs + screenshots
├── docs/                          # BMAD project knowledge (this folder)
├── .github/workflows/ci.yml       # lint + build (web/)
├── _bmad/                         # BMAD Method assets
└── web/                           # ← Vercel Root Directory
    ├── package.json
    ├── vercel.json                # Vite + /admin SPA rewrite
    ├── .env.example
    ├── api/                       # Serverless handlers
    │   ├── _lib/                  # db, auth, markers, usage, taskSync, …
    │   ├── admin/                 # dashboard, ping
    │   ├── auth/                  # login, session, daily-code
    │   ├── cron/                  # sync-tasks
    │   ├── fixed-routes/          # index + [id]
    │   ├── stats/                 # visit, presence
    │   └── tasks/                 # serve snapshots
    ├── public/                    # Static maps, markers, traders, branding
    ├── scripts/                   # e.g. resolve-app-version
    └── src/
        ├── main.tsx               # Admin routes vs App
        ├── App.tsx / App.css      # Product shell + styles
        ├── api/                   # Browser fetch wrappers
        ├── components/            # UI
        ├── context/               # SiteAuthGate
        ├── hooks/                 # Domain state
        ├── i18n/                  # EN/ES
        ├── data/                  # storyline + task fallbacks
        ├── utils/                 # unlock, maps, logs, analytics
        ├── types/                 # Shared TS types
        └── generated/             # app-version.json (build)
```

## Critical paths

| Path | Why it matters |
|------|----------------|
| `web/src/App.tsx` | Main UX orchestration |
| `web/src/hooks/useTasks.ts` | Quest source chain |
| `web/src/components/RouteMapsView.tsx` | Map UX + drag |
| `web/src/components/AdminRoutesPage.tsx` | Shared pin admin |
| `web/api/_lib/db.ts` | Schema bootstrap + DTOs |
| `web/api/fixed-routes/*` | Shared pin API |
| `web/api/_lib/taskSync.ts` | Cron snapshot pipeline |
| `web/public/maps/*` | SVG map assets |

## Parts

See [project-parts.json](./project-parts.json).

---

_Generated using BMAD Method `document-project` workflow_
