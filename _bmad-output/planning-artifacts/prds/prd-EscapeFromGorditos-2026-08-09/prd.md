---
title: Escape From Gorditos
status: final
created: 2026-08-09
updated: 2026-08-09
prd_kind: brownfield-as-is
stakes: internal
working_mode: fast
inputs:
  - docs/index.md
  - docs/project-overview.md
  - _bmad-output/project-context.md
  - README.md
---

# PRD: Escape From Gorditos

*Brownfield baseline — formalizes the product **as shipped today**, not a greenfield roadmap.*

## 0. Document Purpose

This PRD is for the product owner and downstream BMAD workflows (UX, architecture spine, epics/stories). It describes **current capabilities** as stable Functional Requirements so planning does not rediscover the codebase. Implementation detail lives in `docs/` and `_bmad-output/project-context.md`; mechanism notes that do not belong in requirements are in `addendum.md`. Glossary terms are authoritative for all FRs and journeys.

## 1. Vision

Escape From Gorditos is a web companion for **Escape From Tarkov**. It helps players browse trader Side Quests and the Story campaign, understand prerequisites and requirements, track progress locally, optionally sync progress from game logs, and plan routes on interactive maps with personal and shared markers.

The product is **local-first for player progress**, with **shared route markers and light site telemetry** on the server. It is already deployed as a gated web app; this PRD freezes that reality as the planning baseline. `[ASSUMPTION: Primary users are Tarkov players in the owner’s community/circle, not a mass-market anonymous SaaS.]`

## 2. Target User

### 2.1 Jobs To Be Done

- See which quests are available given progress, level, and prerequisites.
- Understand objectives, keys/items, trader requirements, and rewards without leaving the tracker.
- Follow Story chapters and related trader quests without duplicating them under Side Quests.
- Keep Started/Completed state across browser sessions on the same device.
- Import progress from Tarkov Logs when using a capable browser.
- Plan map routes with personal pins and see shared (admin) markers and extracts.
- Access the site with a password or rotating weekly code; admins maintain shared markers.

### 2.2 Non-Users (v1)

- Players who need **account-based / cross-device** progress sync (not offered).
- Non-Chromium users who require full Logs sync (File System Access not available).
- Operators expecting a mounted Admin Analytics UI (API exists; UI unwired).

### 2.3 Key User Journeys

- **UJ-1. Alex unlocks the next Side Quest.**
  - **Persona + context:** Alex, mid-wipe PMC, tracks trader quests between raids.
  - **Entry state:** Site session already valid; Side Quests view; Regular or PvE game mode.
  - **Path:** Opens All → Side; filters or searches; opens a locked/available quest; marks Completed on a prerequisite; returns to see newly available quests.
  - **Climax:** Availability updates from prerequisites/level without a server account.
  - **Resolution:** Progress persists in the browser for the next session.
  - **Edge case:** Live Tarkov data fails → cache/fallback still shows quests; progress remains local.

- **UJ-2. Alex plans a Customs run.**
  - **Persona + context:** Same player, preparing a route for active quests.
  - **Entry state:** Authenticated site session; chooses Routes from home.
  - **Path:** Opens a map; toggles extracts/fixed layers; places personal pins; pans/zooms; optionally sees Key Document / question shared markers.
  - **Climax:** Personal pins + shared markers + extracts visible together.
  - **Resolution:** Personal pins stay local; shared markers come from the server when API is available.
  - **Edge case:** Without full API (`dev` only / API down), personal planning still works; fixed markers may be missing.

- **UJ-3. Alex syncs from Tarkov Logs.**
  - **Persona + context:** Prefers game-truth progress over manual toggles.
  - **Entry state:** Chromium browser; connects Logs folder via File System Access.
  - **Path:** Grants folder access; app parses sessions; Started/Completed update; some states become log-locked.
  - **Climax:** Progress reflects detected log events without re-entering each quest.
  - **Resolution:** Continues playing with synced state until wipe/disconnect.
  - **Edge case:** Unsupported browser → Logs sync unavailable; manual progress still works.

- **UJ-4. Admin Mira updates a shared Key Document pin.**
  - **Persona + context:** Trusted admin maintaining shared Routes data.
  - **Entry state:** Opens `/admin/routes`; authenticates with admin token.
  - **Path:** Selects map/environment; creates or drags a `kb-document` / `question` / default marker; saves.
  - **Climax:** Players see the updated shared marker on Routes.
  - **Resolution:** Point persisted server-side for that environment.
  - **Edge case:** Wrong/missing `ADMIN_TOKEN` → writes rejected; GET list may still be public.

## 3. Glossary

- **Side Quest** — Trader quest content shown in the Side Quests experience (not Story-bucketed trader lines).
- **Story** — Narrative campaign chapters/nodes (bundled storyline) plus Story-related trader quests shown under Story.
- **Quest** — A Side Quest or Story-related trader mission with objectives, prerequisites, and rewards.
- **Progress State** — Local Started / Completed (and availability derived from prerequisites and player level).
- **Game Mode** — One of Regular, Seasonal, or PvE, selecting which quest context applies.
- **Data Source** — How Quest lists are obtained (live providers, cache, or bundled fallback).
- **Logs Sync** — Import of Progress State from a user-selected Tarkov Logs directory.
- **Route Map** — Interactive map surface for a Tarkov location.
- **Personal Marker** — Player-owned pin stored only in the browser.
- **Fixed Marker** — Admin-managed shared pin (types include default, Key Document / `kb-document`, question).
- **Extract** — Map extraction point overlay from external Tarkov map data.
- **Site Gate** — Access control before using the app (permanent tokens or weekly code).
- **Site Session** — Opaque browser session after successful Site Gate login.
- **Weekly Access Code** — Rotating code that can unlock the Site Gate; rotates **Monday 05:00 Europe/Madrid**; revealable only to public-kind sessions.
- **Route Environment** — Server filter for Fixed Markers aligned with the selected Game Mode (e.g. seasonal vs other contexts).
- **Admin Token** — Secret credential authorizing Fixed Marker writes and admin/ops endpoints.
- **Usage Event** — Named analytics event batched from the client for product telemetry.
- **Active Quests View** — In-progress Quests grouped by map (Ground Zero variants merged).

## 4. Features

### 4.1 Side Quests Discovery

**Description:** Players browse trader Side Quests with rich cards/table/detail, search and filters, prerequisites, keys/items, rewards, and wiki links. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Browse Side Quests

Player can view Side Quests with trader, map, objective, item, reward, and prerequisite information for the selected Game Mode and language.

**Consequences (testable):**
- Selecting a Quest shows detail including objectives, rewards, prerequisite tooltips, and trader requirements.
- Quest cards can show category-based hand-in requirements (e.g. quantity × category) and special layouts where shipped (e.g. The Collector).
- Story-bucketed trader lines (including Lightkeeper, Labyrinth, Icebreaker) are not duplicated under Side Quests.

#### FR-2: Filter and search Side Quests

Player can filter/search Side Quests by text, trader, and Progress State (and related All-tab controls).

**Consequences (testable):**
- Search and filters narrow the visible Quest list without clearing Progress State.

#### FR-3: Availability from progress

System presents which Quests are available based on completed prerequisites and player level. Realizes UJ-1 climax.

**Consequences (testable):**
- Completing a prerequisite Quest updates availability of dependents in the same session.

### 4.2 Story Campaign

**Description:** Players explore Story chapters/nodes (bundled TarkovBuddy-derived narrative: **9 chapters, ~180 nodes**) and Story-related trader Quests with chapter filters and graph/tree views.

**Functional Requirements:**

#### FR-4: Browse Story

Player can navigate Story by chapter and inspect node/Quest detail and dependency presentation (graph/tree).

**Consequences (testable):**
- Chapter filter changes the visible Story set.
- Graph/tree view shows dependency relationships for the visible chapter set; selecting a node opens its detail.
- Story-related trader Quests (including Lightkeeper, Labyrinth, Icebreaker) appear under Story, not Side Quests.

### 4.3 Progress Tracking

**Description:** Local Progress State with Active-by-map view and wipe. Realizes UJ-1.

**Functional Requirements:**

#### FR-5: Mark Progress State

Player can set a Quest to Started or Completed (when not log-locked).

**Consequences (testable):**
- Progress State survives reload on the same browser profile (localStorage).

#### FR-6: Active Quests View

Player can use the Active Quests View (in-progress Quests grouped by map; Ground Zero variants merged).

**Consequences (testable):**
- Started Quests appear in the Active Quests View under their map group.

#### FR-7: Wipe local data

Player can clear locally stored progress/data via Wipe All.

**Consequences (testable):**
- After wipe, Progress State is empty and availability resets accordingly.

### 4.4 Logs Sync

**Description:** Optional import from Tarkov Logs. Realizes UJ-3.

**Functional Requirements:**

#### FR-8: Sync from Logs folder

Player on a supporting browser can grant access to a Tarkov Logs directory and have Progress State updated from detected events.

**Consequences (testable):**
- Without File System Access support, Logs Sync is unavailable and manual Progress State still works.
- Log-derived states may be non-editable (locked) while Logs Sync is active. `[ASSUMPTION: Locking log-backed states is intentional product behavior.]`

### 4.5 Route Maps

**Description:** Interactive Route Maps with extracts, zones, layers, Personal Markers, and Fixed Markers. Realizes UJ-2.

**Functional Requirements:**

#### FR-9: Interactive Route Map

Player can open a Route Map with pan/zoom and toggle shipped overlays only (extracts, Fixed Marker layers/types, zone annotations when present).

**Consequences (testable):**
- Extract and Fixed Marker layers can be shown/hidden independently when data is available.

#### FR-10: Personal Markers

Player can create, move, and remove Personal Markers stored only in the browser.

**Consequences (testable):**
- Personal Markers persist across reloads on the same browser; they are not written to shared storage.

#### FR-11: View Fixed Markers

Player can see Fixed Markers for the active map and Route Environment (aligned with selected Game Mode) when the shared API is available.

**Consequences (testable):**
- Key Document markers show document-style labeling; question markers are icon/labelless per product rules.
- Changing Game Mode changes which Route Environment Fixed Markers are fetched.

### 4.6 Admin Fixed Markers

**Description:** Authenticated admin maintenance of Fixed Markers. Realizes UJ-4.

**Functional Requirements:**

#### FR-12: Manage Fixed Markers

Admin with Admin Token can create, update (including position), and delete Fixed Markers for a map and environment via the admin Routes UI.

**Consequences (testable):**
- Unauthenticated writes are rejected.
- Changes become visible to players on subsequent Fixed Marker fetches.

### 4.7 Site Gate and Session

**Description:** Site Gate protects the app; sessions retain access. Public sessions can reveal Weekly Access Code.

**Functional Requirements:**

#### FR-13: Unlock via Site Gate

Visitor can unlock the app with a configured permanent token or the Weekly Access Code (valid for the current Monday 05:00 Europe/Madrid week).

**Consequences (testable):**
- Invalid credentials do not grant a Site Session.
- Successful login yields a Site Session retained for the browser session (sessionStorage); reload in the same tab session still recognizes access until the session is cleared.
- `[ASSUMPTION: Public vs private permanent tokens may present distinct branding (e.g. Gorditos) for public/daily-style access; exact brand surfaces are owner-defined.]`

#### FR-14: Reveal Weekly Access Code

Visitor with a public-kind Site Session can reveal the current Weekly Access Code; other kinds cannot.

**Consequences (testable):**
- Non-public sessions receive forbidden/unauthorized on code reveal.

### 4.8 Telemetry and Ops Visibility

**Description:** Visits, presence, Usage Events; aggregate admin dashboard API exists. UI for dashboard is **not** mounted in the current product surface.

**Functional Requirements:**

#### FR-15: Record visits and presence

System records impressions/visits and online presence heartbeats from anonymous visitor identifiers; the shipped UI can surface visit/impression and online counts when the API is available.

**Consequences (testable):**
- After a visit registration with API configured, impression/visit tally available to the client increases.
- Presence heartbeats refresh the online count shown in the UI within the presence window.

#### FR-16: Record Usage Events

Client can batch allowed Usage Events to the server for product analytics.

**Consequences (testable):**
- Only allowlisted event names are accepted. `[ASSUMPTION: Analytics are for the owner’s ops insight, not end-user-facing reports.]`

#### FR-17: Admin analytics API

Admin with Admin Token can fetch aggregate dashboard/usage data via API.

**Consequences (testable):**
- Unauthorized requests are rejected.
- **Out of Scope for current UI:** mounting Admin Dashboard page (code exists, not wired). `[NON-GOAL for current baseline UI]`

### 4.9 Languages, Modes, and Resilience

**Description:** EN/ES, Game Modes, resilient Quest loading.

**Functional Requirements:**

#### FR-18: English and Spanish

Player can use the UI in English or Spanish; Quest content follows the selected language when providers supply it.

**Consequences (testable):**
- Switching language updates UI strings; Quest fetch uses the selected language.

#### FR-19: Game Mode selection

Player can select Regular, Seasonal, or PvE Game Mode affecting Quest context and Route environment filtering.

**Consequences (testable):**
- Changing Game Mode reloads the appropriate Quest context and Fixed Marker environment filter.

#### FR-20: Resilient Quest loading

System serves Quests via live Data Source when possible, otherwise cache/stale cache/bundled fallback so the app remains usable offline or when providers fail. Canonical live preference is **json.tarkov.dev**, with GraphQL as fallback for **non-seasonal** modes only (README may still mention GraphQL-first; treat that as stale).

**Consequences (testable):**
- With network failure after a prior cache, player still sees Quests and can manage Progress State.
- Seasonal Game Mode must still degrade to cache/bundled fallback when live JSON fails; agents must not assume GraphQL fallback exists for Seasonal. `[NOTE FOR PM: mode-specific degradation — document in ops/smoke if needed.]`

## 5. Non-Goals (Explicit)

- Cloud accounts, cross-device Progress State sync, or social profiles.
- Replacing the SPA with a multi-page framework / React Router app shell.
- Making Logs Sync work on all browsers without File System Access.
- Shipping a mounted Admin Analytics UI as part of this baseline (API-only today).
- Making `/api/tasks` the primary Quest Data Source for the SPA without an explicit product decision.
- Mobile-native apps; this is a web product. `[ASSUMPTION: Responsive web is “nice”; desktop Chromium is the primary target.]`

## 6. MVP Scope

*For this brownfield PRD, “MVP” = **currently shipped baseline**.*

### 6.1 In Scope (baseline)

- Side Quests, Story, Progress State, Active Quests View, Wipe All.
- Logs Sync on supporting browsers.
- Route Maps with Personal Markers, Fixed Markers, extracts/layers.
- Admin Fixed Marker management at `/admin/routes`.
- Site Gate, Site Session, Weekly Access Code reveal for public sessions.
- Visit/presence/Usage Event recording when API/DB configured.
- EN/ES, Game Modes, resilient Quest loading.
- Deployed web app on Vercel with Turso-backed shared data.

### 6.2 Out of Scope for MVP (baseline)

- Mounted Admin Dashboard UI — deferred until explicitly prioritized.
- Primary Quest load via Turso snapshots — deferred / ops-only today.
- Account sync, mobile apps, general deep linking beyond `/admin/routes`.

## 7. Success Metrics

`[ASSUMPTION: No formal analytics OKRs exist; metrics below are operational proxies from shipped telemetry.]`

**Primary**
- **SM-1:** Site remains usable for quest tracking (Quest list + Progress State) even when live Data Source fails (validates FR-5, FR-20).
- **SM-2:** Shared Fixed Markers are maintainable by Admin Token holders without code deploys (validates FR-12).

**Secondary**
- **SM-3:** Usage Events and visits are recorded when API/DB is healthy (validates FR-15, FR-16).
- **SM-4:** EN and ES both usable for core Side Quests + Routes flows (validates FR-18).

**Counter-metrics (do not optimize)**
- **SM-C1:** Do not optimize for maximizing Usage Event volume at the cost of trust/privacy.
- **SM-C2:** Do not optimize “always online-only Quests” at the cost of offline/fallback usability (counterbalances naive live-only designs).

## 8. Cross-Cutting NFRs

- **Local-first:** Progress State and Personal Markers must not require a user account.
- **Security:** Admin Token, Turso credentials, and permanent site tokens remain server-side only (never `VITE_*`).
- **Privacy:** Logs Sync only after explicit folder permission; visitor IDs are not authentication.
- **i18n:** New user-visible UI strings ship in EN and ES together.
- **Deployability:** App builds and lints in CI; production Root Directory is `web`.
- **Schema honesty:** Operators must not assume all analytics/task tables are created by `ensureSchema()` on a fresh database. `[NOTE FOR PM: document/ops risk — see docs/data-models-api.md]`

## 9. Open Questions

*Forward-looking only — **do not block** as-is baseline use of §6.1. Resolve before expanding scope beyond the shipped baseline.*

1. Should cloud Progress State sync ever be in scope, or is local-first permanent?
2. Should Admin Dashboard UI be mounted and who may use it?
3. Should Turso Quest snapshots become the primary Data Source for the SPA?
4. What retention/consent story is required for Usage Events beyond current ~90-day technical retention?
5. Which browsers/devices are must-support vs best-effort?
6. Are Fixed Markers considered trusted global truth for all Site Gate users?

## 10. Assumptions Index

- Primary users are Tarkov players in the owner’s community/circle (§1).
- Locking log-backed Progress States is intentional (§4.4 / FR-8).
- Analytics are for owner ops, not end-user reports (§4.8 / FR-16).
- Desktop Chromium is the primary target; responsive web is secondary (§5).
- No formal OKRs; metrics are operational proxies (§7).
- Public/private Site Gate kinds may present distinct branding for public/daily-style access (§4.7 / FR-13).
