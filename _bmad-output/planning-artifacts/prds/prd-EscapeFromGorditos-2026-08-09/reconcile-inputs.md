# Reconcile Inputs → Brownfield As-Is PRD

**PRD:** `prd.md` (+ `addendum.md` for mechanism)  
**Date:** 2026-08-09  
**Verdict:** **gaps**

Scope: capability / requirement gaps or contradictions. Implementation detail that correctly belongs in `addendum.md` is ignored unless it contradicts a product claim in the PRD.

---

## 1. `docs/index.md` (+ skim `docs/project-overview.md`)

### Alignment (OK)

- Core product shape matches PRD vision: Side Quests, Story, local progress, Logs sync, route maps (personal + admin markers), site gate, visits/presence/usage, resilient quest loading, Vercel + Turso.
- Brownfield highlights (schema gap, unwired AdminDashboard, extracts client→json.tarkov.dev, usage via `/api/stats/visit`) match PRD §4.8 / §5 / addendum — not missing as FRs.
- Overview quest load chain and dual local runtime are addendum/project-context material; PRD correctly stays at FR-20 level.

### Gaps / contradictions

| # | Direction | Finding |
|---|-----------|---------|
| D1 | Input → PRD missing | Overview Key Features: **“Gorditos branding for public/daily access.”** PRD covers Site Gate + Weekly Access Code + public-kind reveal (FR-13/14) but does **not** formalize branding or a distinct “daily access” product surface as a capability. |
| D2 | Input → PRD thin | Overview lists **visit counter** as a user-visible concern alongside presence/analytics. PRD FR-15 is API/recording-oriented; no FR that players/admins *see* a visit counter in the shipped UI. |
| D3 | Input → PRD thin | Docs highlight unwired **`siteTasks` client helpers** alongside AdminDashboard. PRD/non-goals call out Admin Dashboard UI and `/api/tasks` as non-primary SPA source, but never name `siteTasks` as an unwired client path (minor; could live in addendum). |
| D4 | PRD → Input weak | PRD FR-19 **Game Mode** (Regular / Seasonal / PvE) is first-class. Overview Key Features do **not** list mode selection; only architecture note implies seasonal via GraphQL fallback. Not a hard contradiction, but docs under-specify a PRD baseline capability. |

**Ignored (addendum-correct):** ensureSchema table list, extract/usage route facts, IndexedDB TTL, cron→Turso snapshots, Node 22, SPA orchestration in `App.tsx`.

---

## 2. `README.md`

### Alignment (OK)

- Side Quests, Story, progress unlock, Active-by-map, Wipe All, EN/ES, localStorage, detail panel basics, filters, admin `/admin/routes` + Turso setup, Vercel deploy — covered by PRD FRs / MVP.
- Story-related trader lines under Story (not Side) matches FR-1/FR-4 consequences.

### Gaps / contradictions

| # | Direction | Finding |
|---|-----------|---------|
| R1 | **Contradiction** | README **Data sources / What it does** state Side Quests load from **tarkov.dev GraphQL** as the live source. Docs overview + addendum + project-context: prefer **`json.tarkov.dev`**, GraphQL as **fallback** (non-seasonal). PRD §4.9 uses vague “live Data Source”; addendum matches docs, **not** README. Product-facing README claim is stale vs brownfield truth. |
| R2 | Input → PRD missing | README product bullets: **category-based hand-in requirements** on cards (e.g. “5× Drinks”) and **special wide layout for The Collector**. Neither appears as FR/consequence in PRD (UI capability of shipped baseline). |
| R3 | Input → PRD missing | README names Story trader buckets: **Lightkeeper, Labyrinth, Icebreaker**. PRD only says “Story-related / Story-bucketed trader lines” without naming which lines are in the Story bucket. |
| R4 | Input → PRD missing | README claims Story scale: **9 chapters, ~180 nodes** (TarkovBuddy). PRD Glossary/FR-4 describe Story chapters/nodes but not this shipped content scale. |
| R5 | Input → PRD thin | README detail panel: **prerequisite tooltips** and explicit **trader requirements** presentation. PRD FR-1 covers prerequisites/trader info at browse level; tooltip/trader-requirement UX not called out. |
| R6 | PRD → Input missing | README “What it does” **omits** first-class shipped capabilities that the PRD baselines: **Route Maps** (personal/fixed/extracts), **Logs Sync**, **Site Gate / Weekly Access Code**, **Game Modes**, **telemetry** (visit/presence/usage). Routes appear only under Turso setup, not product features. README is an incomplete product surface vs PRD as-is. |

**Ignored (not PRD requirements):** live demo URL, screenshots, AGPL license, maintenance scripts, Vite/React badge stack versions.

---

## 3. `_bmad-output/project-context.md`

### Alignment (OK)

- Product shape, local-first progress/markers, Site Gate, Logs Chromium-only, Fixed Markers types, Admin Dashboard unwired, `/api/tasks` non-primary, EN+ES string rule, CI lint+build, secrets not `VITE_*`, schema honesty — all reflected in PRD FRs / NFRs / non-goals.
- Mechanism paths (visit ingest, extracts client-side, dual `dev` vs `dev:full`) correctly belong in addendum; PRD does not wrongly elevate them.

### Gaps / contradictions

| # | Direction | Finding |
|---|-----------|---------|
| P1 | Input → PRD missing | **Weekly Access Code boundary:** project-context specifies **Europe/Madrid, Monday 05:00**. PRD Glossary only says “Europe/Madrid week boundary” — missing the authoritative cutover time that defines “current” code for FR-13/14. |
| P2 | Input → PRD thin | Smoke expectations include **site gate / weekly code (`public` only)** and **stats under `dev:full`**. PRD covers public-only reveal (FR-14) but does not state that full telemetry/shared APIs require the full local API runtime (ops usability of baseline; borderline addendum). |
| P3 | Input → PRD thin | Explicit **sessionStorage** for site/admin tokens vs localStorage progress. PRD says Site Session in “browser session” without storage locus; fine for mechanism, but if session durability is a product claim it is underspecified (reload/tab behavior). |
| P4 | Neutral / OK | “No React Router / no unit runner” align with PRD non-goals and Deployability NFR; no contradiction. |

**Ignored (addendum/guardrails):** import `.js` rules, marker CSS sync, ESLint toggles, commit policy, path aliases.

---

## Cross-input summary

| Priority | Gap | Sources |
|----------|-----|---------|
| High | Live quest source: GraphQL (README) vs json.tarkov.dev primary (docs/addendum/context); PRD too vague to resolve | R1 |
| High | README product list missing Routes, Logs Sync, Site Gate, Game Modes, telemetry vs PRD baseline | R6 |
| Medium | Weekly code cutover **Monday 05:00** not in PRD | P1 |
| Medium | Card/detail UX: category hand-ins, Collector layout, prerequisite tooltips | R2, R5 |
| Medium | Named Story trader lines + 9ch/~180 nodes | R3, R4 |
| Low | Gorditos branding / daily access; visit-counter UX; Game Mode under-documented in overview; `siteTasks` | D1–D4, P2–P3 |

### Suggested PRD follow-ups (not applied here)

1. Clarify FR-20 Data Source order in one sentence (or point to addendum as normative for live source) and flag README for doc fix.
2. Add FR/consequence or glossary note for Weekly Code Monday 05:00 Europe/Madrid.
3. Optionally promote Collector/category hand-in and named Story traders if they are stable product rules.
4. Treat README feature list refresh as doc debt outside PRD, or note README lag in Open Questions.

---

## Verdict

**gaps** — PRD covers the brownfield spine well against docs/overview and project-context, but README contradicts the live quest source and under-documents major shipped surfaces; a few product-facing details (weekly cutover time, card/Story specifics, branding/daily access) are in inputs but not frozen in PRD FRs.
