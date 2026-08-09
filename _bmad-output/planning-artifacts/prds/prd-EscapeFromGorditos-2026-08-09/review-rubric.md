# PRD Quality Review — Escape From Gorditos (brownfield as-is)

**Context for this walk:** `prd_kind: brownfield-as-is`, `stakes: internal`, `working_mode: fast`. Competitive landscape research, launch GTM, and greenfield differentiation are **out of scope** for this review. Mechanism detail in `addendum.md` is treated as supporting evidence, not as missing PRD furniture.

## Overall verdict

This is a **usable brownfield baseline**: Vision, Non-Users/Non-Goals, UJs, Glossary, and FRs with consequences freeze the shipped product without pretending to be a roadmap. Scope honesty and shape fit are the strengths. What is at risk is a handful of **done-ness / as-is accuracy** gaps—especially resilience under Seasonal Game Mode versus the addendum’s GraphQL note, and thin testable consequences for Story graph/tree and telemetry—that could mislead UX/architecture/story extraction if left unfixed. **Verdict: pass-with-fixes.**

## Decision-readiness — strong

A decision-maker can treat this as the planning baseline without rediscovering the codebase. Trade-offs are stated as product reality, not smoothed into “balance everything”: local-first vs cross-device (§2.2, §5), Chromium-gated Logs Sync (§2.2, FR-8), Admin Analytics API without mounted UI (FR-17 + `[NON-GOAL for current baseline UI]`), and explicit deferral of Turso snapshots as primary Quest source (§5, §6.2). Open Questions (§9) are genuinely open forward-scope items, not rhetorical answers—appropriate for an as-is freeze. The single `[NOTE FOR PM]` on schema honesty (§8) lands on a real ops tension. For *internal* stakes, open-item density (6 OQs + 5 assumptions) is acceptable; the document does not claim green-light for new product bets.

### Findings
- **medium** Forward OQs could be misread as baseline blockers (§9) — Six open questions sit next to a “stable Functional Requirements” framing (§0). A reader skimming for build-ready new work might stall on cloud sync / consent before using the baseline. *Fix:* Prefatory line under §9: “Forward-looking; do not block as-is baseline use. Resolve before expanding scope beyond §6.1.”

## Substance over theater — strong

Content is earned. Two protagonists (Alex, Mira) drive four UJs that map to FR clusters; no persona pile-on. Vision (§1) is Tarkov-specific (Side Quests, Story, Logs Sync, Route Maps, Site Gate)—not swappable category boilerplate. NFRs (§8) are product-shaped (local-first, never `VITE_*` for secrets, `ensureSchema()` honesty, EN+ES together), not “scalable/secure/reliable” wallpaper. Success Metrics (§7) admit they are operational proxies (`[ASSUMPTION: No formal analytics OKRs…]`) with counter-metrics—honest for an internal companion. No innovation/differentiation theater; addendum correctly notes competitive research was not required.

### Findings
*(none — dimension holds without actionable gaps for this PRD shape)*

## Strategic coherence — strong

Thesis is clear: a **local-first, gated Tarkov web companion** whose planning artifact freezes **shipped** capability. Features (§4.1–4.9) follow that arc (discovery → progress → optional Logs → routes/admin → gate → light telemetry → i18n/modes/resilience), not a random backlog. MVP (§6) explicitly redefines “MVP” as currently shipped baseline—correct scope kind for brownfield. SMs validate the thesis (offline/fallback usability SM-1; admin-maintainable shared markers SM-2) rather than vanity DAU. Counter-metrics SM-C1/SM-C2 protect privacy and fallback usability against naive optimization.

### Findings
- **low** Primary SMs are qualitative proxies (§7 SM-1/SM-2) — Fine given the OKR assumption, but they won’t drive a numeric dashboard without later definition. *Fix:* Optional one-liner each (e.g. “fallback path exercised in smoke after provider fault”; “admin can CRUD Fixed Marker without deploy”) if ops later wants pass/fail checks.

## Done-ness clarity — adequate

Most FRs carry at least one testable consequence (availability updates, localStorage survival, wipe reset, log-lock, Site Gate failure, allowlisted Usage Events, unauthorized admin writes). That is enough for Fast-path story seeding. Soft spots remain where section prose promises surfaces that consequences do not pin down, and where telemetry “done” is nearly tautological.

### Findings
- **high** Seasonal resilience overstated vs addendum mechanism (FR-20, FR-19; addendum Quest live source) — FR-20 claims live → cache → bundled fallback so the app “remains usable” when providers fail; FR-19 includes Seasonal. Addendum states GraphQL fallback is **non-seasonal**. As-is readers may assume identical resilience across Game Modes. *Fix:* Add a consequence or `[NOTE FOR PM]` under FR-20/FR-19: Seasonal may lack GraphQL fallback; cache/bundled path still required; document mode-specific degradation.
- **medium** Story graph/tree lacks testable consequences (§4.2 description vs FR-4) — Description promises “graph/tree views”; FR-4 consequences only cover chapter filter and Story vs Side Quest placement. *Fix:* Add consequences for graph/tree (e.g. dependency edges visible for chapter set; selecting a node shows Quest detail).
- **medium** Telemetry FR-15 consequence is circular (FR-15) — “Visit and presence endpoints update counters used by the client when API is configured” does not state an observable client/ops outcome. *Fix:* Name a checkable effect (e.g. presence heartbeat refreshes online count in UI; visit increments impression tally visible to admin API).
- **low** Overlay “etc.” weakens FR-9 (FR-9) — “toggle overlays (extracts, Fixed Marker layers, etc.)” invites invented layers. *Fix:* Enumerate shipped toggles (extracts, Fixed Marker types/layers, zones if shipped) or say “shipped layer toggles only; see addendum.”

## Scope honesty — strong

Omissions do real work: Non-Users (§2.2), Non-Goals (§5), MVP out-of-scope (§6.2), and inline `[NON-GOAL for current baseline UI]` on Admin Dashboard (FR-17). Assumptions are tagged and indexed (§10). Deferred product decisions sit in Open Questions rather than silent scope creep. De-scoping (analytics UI, Turso-primary Quests, account sync) is explicit. For brownfield as-is, this dimension is a model of honesty.

### Findings
*(none material — optional clarity note already captured under Decision-readiness)*

## Downstream usability — strong

Document purpose (§0) correctly positions the PRD for UX / architecture / epics. Glossary (§3) covers load-bearing nouns used in FRs/UJs. IDs are contiguous (UJ-1–4, FR-1–20, SM-1–4, SM-C1–C2) with Feature→UJ realization links. Each UJ names a protagonist and carries entry/path/climax/resolution/edge. Sections are extractable with Glossary terms rather than vague “see above.” Addendum cleanly parks mechanism so requirements stay product-language.

### Findings
- **low** “Environment” vs Game Mode underspecified (FR-11, FR-19; Glossary) — FR-11 says “Game Mode / environment context”; Glossary defines Game Mode but not environment. *Fix:* Glossary entry or one clause: environment filter aligns with selected Game Mode for Fixed Markers (or name the actual env keys if distinct).

## Shape fit — strong

Shape matches product and stakes: multi-surface companion (quests + maps + admin + gate) justifies UJs without over-formalizing into enterprise B2B theater; internal Fast path justifies operational SMs over growth OKRs. Brownfield discipline is followed—current vs unwired (Admin Dashboard), personal vs Fixed Markers, and “MVP = shipped” are distinguished. Mechanism belongs in `addendum.md`; research note correctly declines competitive landscape. No greenfield GTM/launch sections are missing because they are not required.

### Findings
*(none — do not demand competitive research or launch GTM for this PRD kind)*

## Mechanical notes

- **Assumptions Index roundtrip:** Five inline `[ASSUMPTION: …]` tags (§1, FR-8, FR-16, §5, §7) all appear in §10; index entries resolve to those locations. Pass.
- **ID continuity:** FR-1–20, UJ-1–4, SM-1–4 + SM-C1–C2 — no gaps/duplicates observed. Cross-refs (UJ realization, SM→FR) resolve.
- **Glossary drift (minor):** “Active-by-map” / “Active Quests by map” / “Active/map grouping” (FR-6, §6.1); “Key Document” vs `kb-document` (handled in Glossary Fixed Marker). Prefer one display name in FRs.
- **UJ protagonists:** Alex (UJ-1–3), Mira (UJ-4) — named with context inline. Pass.
- **Required sections for internal / brownfield Fast:** Purpose, Vision, Users/UJs, Glossary, Features/FRs, Non-Goals, MVP-as-baseline, SMs, NFRs, Open Questions, Assumptions Index — present. Competitive/GTM sections correctly absent.
- **Addendum alignment risk:** Quest fallback stack and Admin Dashboard wiring noted in addendum; only the Seasonal/GraphQL mismatch rises to a high finding above.
