---
title: 'Split weekly access codes for PUBLIC vs MV'
type: 'feature'
created: '2026-08-14'
status: 'done'
baseline_commit: 'dc7e99d'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** One shared weekly 4-digit code cannot brand PUBLIC separately from MV. PUBLIC (token or weekly) must keep Gorditos logos; MV weekly users must see the same app as `PERMANENT_TOKEN_MV` but cannot reveal any access password.

**Approach:** Derive two weekly codes from `PERMANENT_TOKEN_PUBLIC` and `PERMANENT_TOKEN_MV`. Keep `daily` for PUBLIC weekly; add `daily-mv` for MV weekly. Only permanent `public` / `mv` may reveal their own audience code.

## Boundaries & Constraints

**Always:**
- Two distinct zero-padded 4-digit codes; rotate Monday 05:00 Europe/Madrid.
- PUBLIC token + PUBLIC weekly → Gorditos (`/gorditos-logo.png`).
- MV token + MV weekly → default logos (`/logo.png`), same as current MV.
- Reveal only for permanent `public` and `mv`. Weekly / private / admin / legacy cannot.
- `POST /api/auth/daily-code` returns that session's audience code.
- Permanent wins if it equals a weekly code; `ADMIN_TOKEN` wins over all.
- Weekly sessions die when `weekKey` changes. Use `timingSafeEqual`.
- Vite `npm run dev` auth middleware must match Vercel handlers.
- Add `daily-mv` to every `SiteAuthKind` / usage / admin allow-list.
- New UI copy in EN+ES.

**Ask First:**
- Renaming historical `daily` (breaks admin history labels).
- Changing rollover, code length, or adding a PRIVATE weekly code.

**Never:**
- Do not leak codes in login/session errors or use `VITE_` on tokens.
- Do not give weekly sessions the reveal button/API.
- Do not change PRIVATE/admin/legacy behavior beyond allow-listing `daily-mv`.
- Do not add a test runner or migrate Turso.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PUBLIC permanent | `PERMANENT_TOKEN_PUBLIC` | kind `public`, Gorditos, can reveal PUBLIC weekly | N/A |
| PUBLIC weekly | PUBLIC weekly code | kind `daily`, Gorditos, no reveal; `/daily-code` 403 | N/A |
| MV permanent | `PERMANENT_TOKEN_MV` | kind `mv`, default logos, can reveal MV weekly ≠ PUBLIC | N/A |
| MV weekly | MV weekly code | kind `daily-mv`, default logos, no reveal; `/daily-code` 403 | N/A |
| Codes differ | Both tokens set | Same-week PUBLIC weekly ≠ MV weekly | On digit collision, re-derive MV only until distinct |
| Missing token | PUBLIC or MV env empty | That audience has no weekly login; the other still works | 401 for the missing audience |
| Wrong / stale | Unknown password or prior `weekKey` session | Login/session 401; no audience hint | 401 |
| Overlap | Password equals a permanent or `ADMIN_TOKEN` | Permanent kind, or `admin` if admin | N/A |

</frozen-after-approval>

## Code Map

- `web/api/_lib/siteAccess.ts` -- weekly HMAC, login/session, reveal helper
- `web/api/_lib/auth.ts` -- re-exports
- `web/api/auth/daily-code.ts` -- reveal endpoint
- `web/vite.config.ts` -- local `/api/auth/*` must stay in sync
- `web/src/api/siteAuth.ts` -- client kind + sessionStorage allow-list
- `web/src/context/SiteAuthContext.tsx` -- `useGorditosLogo` (`public` \| `daily` only)
- `web/api/_lib/usageLogs.ts` -- `USAGE_ACCESS_KINDS` + empty buckets
- `web/src/utils/usageAnalytics.ts` -- client `isAccessKind`
- `web/src/api/adminDashboard.ts` -- admin kind unions
- `web/src/components/AdminDashboardPage.tsx` -- labels, colors, filter
- `web/.env.example` + `docs/development-guide-api.md` -- two codes / reveal rules

## Tasks & Acceptance

**Execution:**
- [x] `web/api/_lib/siteAccess.ts` -- PUBLIC + MV weekly codes; keep `daily`, add `daily-mv`; collision-safe; add `getRevealableWeeklyCode(kind)`
- [x] `web/api/_lib/auth.ts` -- re-export updated helpers
- [x] `web/api/auth/daily-code.ts` -- return audience code; 403 for weekly kinds
- [x] `web/vite.config.ts` -- call the shared reveal helper (no local selection)
- [x] `web/src/api/siteAuth.ts` -- accept `daily-mv` in type + `getStoredSiteKind`
- [x] `web/src/context/SiteAuthContext.tsx` -- Gorditos only for `public` and `daily`
- [x] `web/api/_lib/usageLogs.ts` + `web/src/utils/usageAnalytics.ts` + `web/src/api/adminDashboard.ts` + `web/src/components/AdminDashboardPage.tsx` -- whitelist `daily-mv`; labels "Weekly PUBLIC" / "Weekly MV" (+ ES)
- [x] `web/.env.example` + `docs/development-guide-api.md` -- two codes, reveal rules

**Acceptance Criteria:**
- Given both tokens set, when a user logs in with each weekly code, then kind, logos, and reveal match the I/O matrix.
- Given a `public` session, when `/api/auth/daily-code` is called, then `code` is this week's PUBLIC weekly password, not MV.
- Given `daily` or `daily-mv`, when `/daily-code` is called, then 403 and the header/home reveal control is hidden.
- Given Vite `npm run dev`, when the same passwords are used, then login/session/reveal match Vercel.
- Given an MV-weekly session, when usage events are sent, then `access_kind` is `daily-mv`.

## Spec Change Log

## Design Notes

Keep `daily` = PUBLIC weekly so existing analytics stay meaningful. New `daily-mv` = MV weekly.

Session material must include audience (`weekly:v2:public:<weekKey>:<code>` vs `weekly:v2:mv:...`) so equal digits cannot alias sessions. Bump only the MV derivation on collision.

Replace parameterless `getWeeklyAccessCode()` so callers cannot grab "the" code. Vite and `daily-code.ts` must use one helper.

## Verification

**Commands:**
- `cd web && npm run lint` -- expected: no new errors
- `cd web && npm run build` -- expected: success

**Manual checks (if no CLI):**
- PUBLIC token → Gorditos + reveal PUBLIC weekly; that code → `daily` (Gorditos, no reveal).
- MV token → default logo + different MV weekly; that code → `daily-mv` (default logo, no reveal).
- PRIVATE: default logo, no reveal. Prior-week sessions reject after Monday 05:00 Madrid.

## Suggested Review Order

**Weekly derivation**

- Two HMAC codes; MV remaps only if digits collide with PUBLIC.
  [`siteAccess.ts:97`](../../web/api/_lib/siteAccess.ts#L97)

- Session material includes audience so equal digits cannot alias.
  [`siteAccess.ts:137`](../../web/api/_lib/siteAccess.ts#L137)

**Login and reveal**

- Permanent wins; weekly becomes `daily` or `daily-mv`.
  [`siteAccess.ts:197`](../../web/api/_lib/siteAccess.ts#L197)

- Only permanent `public` / `mv` may reveal; helper picks the audience code.
  [`siteAccess.ts:119`](../../web/api/_lib/siteAccess.ts#L119)

- Vercel reveal uses one `now` for session, code, and weekKey.
  [`daily-code.ts:33`](../../web/api/auth/daily-code.ts#L33)

- Vite `/api/auth/daily-code` calls the same helper.
  [`vite.config.ts:136`](../../web/vite.config.ts#L136)

**Branding**

- Gorditos stays on `public` and PUBLIC weekly (`daily`) only.
  [`SiteAuthContext.tsx:37`](../../web/src/context/SiteAuthContext.tsx#L37)

**Allow-lists and admin**

- Client persists and accepts `daily-mv`.
  [`siteAuth.ts:1`](../../web/src/api/siteAuth.ts#L1)

- Usage events keep `daily-mv` instead of dropping it as unknown.
  [`usageLogs.ts:8`](../../web/api/_lib/usageLogs.ts#L8)

- Admin labels split historical `daily` from new `daily-mv`.
  [`AdminDashboardPage.tsx:59`](../../web/src/components/AdminDashboardPage.tsx#L59)

**Docs**

- Env comments document two codes and reveal rules.
  [`.env.example:14`](../../web/.env.example#L14)

