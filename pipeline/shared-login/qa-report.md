# QA Report — Shared Login

**Feature:** shared-login
**Date:** 2026-07-19
**Stage:** 6 — The Tester
**Lane:** feature
**Test Runner:** vitest (`vitest run`)
**Acceptance basis:** `pipeline/shared-login/prd.md` (Success Metrics QA-01 … QA-28)

## Result: **PASSED**

All 28 acceptance criteria are satisfied. The security-critical rows —
unauthenticated requests to `/`, `/stats`, and `/api/export` are blocked; an
unauthenticated server action performs no DB operation; a non-allowlisted
signed-in user is denied everywhere; the app fails closed on misconfiguration;
and there is no open redirect — are each confirmed by a combination of runtime
probes, unit tests, and code inspection. One row (QA-21) is a deploy-time
configuration action outside the scope of local QA and is recorded under Known
Limitations; it is not a feature defect.

---

## Test Suite Results

`npm run test` → **85 passed / 85, 6 files, 0 failed.** No regressions across
any pre-existing suite.

| Suite | File | Tests | Result |
|---|---|---:|---|
| Play model / validation | `tests/play.test.ts` | 13 | Pass |
| Query / filter / sort | `tests/query.test.ts` | 16 | Pass |
| Auth (allowlist, decision core, redirect guard) | `tests/auth.test.ts` | 19 | Pass |
| Stats | `tests/stats.test.ts` | 17 | Pass |
| Export (CSV/XLSX) | `tests/export.test.ts` | 13 | Pass |
| Repository (real PGlite Postgres) | `tests/repository.test.ts` | 7 | Pass |

### Build & type gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | Pass (exit 0, no errors) |
| Production build | `npm run build` | Pass — compiled successfully |
| Migration drift | `npm run db:generate` | **No schema changes, nothing to migrate** — no new migration; schema unchanged |

Build route table confirms every auth surface exists and middleware compiled:

```
┌ ƒ /
├ ƒ /api/export
├ ƒ /auth/callback
├ ƒ /auth/signout
├ ƒ /login
└ ƒ /stats
ƒ Proxy (Middleware)
```

The only build output note is a non-blocking Next.js 16 deprecation warning
("middleware" file convention renamed to "proxy"); the middleware compiles and
runs correctly as `Proxy (Middleware)`.

### Runtime verification (dev server, `127.0.0.1:3941`)

**Run A — dev bypass (no Supabase env, synthetic `dev@localhost`):** `GET /`
200 (renders the log + signed-in email + sign-out control), `GET /stats` 200,
`GET /api/export?format=csv` 200 (UTF-8 BOM, CRLF rows, real data,
`Content-Disposition` attachment), `?format=xlsx` 200 (valid OOXML), unknown
format 400, `GET /login` 307 → `/` (already-invited redirect). Existing log /
stats / export behaviour unchanged.

**Run B — real gate (throwaway Supabase URL + anon key, `ALLOWED_EMAILS` set,
no session):** unauthenticated `GET /` → 307 `/login`; `GET /stats` → 307
`/login`; `GET /api/export?format=csv` and `?format=xlsx` → 307 `/login` (6-byte
body, no file, no play data). No archive content leaked in any redirect body.
Login states render server-side: enter-email (wordmark, labeled email field,
"Send me a link", **zero password fields**), not-invited (`?notice=not-invited`),
expired-link (`?error=link`). Callback with no code → `/login?error=link` (no
session). Open-redirect probe (`?next=//evil.com`) stayed same-origin. Sign-out:
`GET /auth/signout` → 405 (POST-only), `POST` → 303 `/login`.

---

## Acceptance Criteria

| ID | Criterion | Verdict | Evidence |
|---|---|---|---|
| QA-01 | Magic-link, no-password sign-in (FR-01) | **Pass** | Login renders email + send-link; 0 `type="password"` anywhere. |
| QA-02 | Request link → check-email, no enumeration (FR-02) | **Pass** | `signInWithOtp` then identical "sent" state regardless of allowlist; malformed email rejected inline (stays on enter-email). Live send is interactive; render + logic code/unit-verified. |
| QA-03 | Server-side callback, httpOnly session (FR-03) | **Pass** | `/auth/callback` exchanges code server-side via `@supabase/ssr`; httpOnly cookies; no-code path redirects correctly. Live exchange interactive; code-verified. |
| QA-04 | No open redirect (FR-04) | **Pass** | `safeNext` unit-tested against absolute/protocol-relative/backslash/scheme targets → `/`; callback re-anchors to origin; runtime `//evil.com` probe stayed same-origin. |
| QA-05 | Allowlisted end-to-end sign-in (FR-05) | **Pass** | Callback applies allowlist at consume time; `decideAccess` invited path unit-tested; dev-bypass loads the log end to end. Full magic-link click interactive. |
| QA-06 | Allowlist parsing (FR-06) | **Pass** | Unit: `ALLOWED_EMAILS="Owner@Example.com, dad@example.com"` admits `owner@example.com` (case-insensitive, trimmed); unlisted rejected. |
| QA-07 | Session necessary but not sufficient, server-side (FR-07) | **Pass** | `decideAccess`: valid session + non-invited → denied; enforced in middleware + `getInvitedUser`; runtime unauth denial. |
| QA-08 | Non-allowlisted signed-in denied everywhere (FR-08) | **Pass** | Middleware signs out + routes non-allowlisted to not-invited; callback likewise; every boundary uses `getInvitedUser`. `decideAccess` denied path unit-tested. Live non-allowlisted session interactive. |
| QA-09 | Middleware gate before content (FR-09) | **Pass** | Runtime: unauth `/` and `/stats` → 307 `/login` before content; matcher covers all but login/auth/static. |
| QA-10 | Defense in depth at every boundary (FR-10) | **Pass** | `/`, `/stats`, `/api/export`, and all 3 actions each call `getInvitedUser` before any DB access; route returns 401 / actions throw if middleware were bypassed (code + unit). |
| QA-11 | Unauthenticated log/stats blocked (FR-11) | **Pass** | Runtime 307 → `/login`, 6-byte body, no plays/counts/names. |
| QA-12 | Unauthenticated export blocked (FR-12) | **Pass** | Runtime: csv & xlsx → 307 `/login`, no file/data; route's own 401 is the DiD backstop (code). |
| QA-13 | Unauthenticated server action, no DB op (FR-13) | **Pass** | `requireInvited()` throws before `getDb()` in create/update/delete; `getInvitedUser` denies unauth (code + unit). |
| QA-14 | Enter-email state (FR-14) | **Pass** | Runtime: wordmark, labeled email, send-link, Neutra styling. |
| QA-15 | Check-your-email state (FR-15) | **Pass** | "sent" panel confirms link to the entered address + "use a different email"; no invite/registration disclosure (code). |
| QA-16 | Not-invited state (FR-16) | **Pass** | Runtime `?notice=not-invited`: clear non-technical "not on the list" + try-another-email; no access. |
| QA-17 | Invalid-or-expired-link state (FR-17) | **Pass** | Runtime `?error=link`: "did not work" + retry; callback no-code → `/login?error=link`, no session. |
| QA-18 | Public auth surfaces reachable, no loop (FR-18) | **Pass** | `/login` 200 unauth (no loop); callback + signout reachable; matcher excludes them. |
| QA-19 | Sign-out (FR-19) | **Pass** | POST-only form; GET → 405, POST → 303 `/login`; server-side session clear; next request unauthenticated. |
| QA-20 | One shared log, no data change (FR-20) | **Pass** | Schema has no `user_id`, no per-user scoping; `getDb`/schema unchanged; `db:generate` reports no changes. |
| QA-21 | Deploy configuration (FR-21) | **Deferred (deploy-time)** | Turning Deployment Protection off and setting the live Supabase URL/anon key/`ALLOWED_EMAILS` in Vercel is a deploy action, not a build artifact. App fails closed if env is missing. See Known Limitations. Not a feature defect. |
| QA-22 | No auth bypass — full surface sweep (NFR-01/02) | **Pass** | Every route/handler/action enumerated and gated; only login/callback/signout (+static) public; signout returns no data. |
| QA-23 | Secret hygiene & session safety (NFR-03) | **Pass** | No service-role key in source; gating uses `getUser()` (0 `getSession()` for gating); `ALLOWED_EMAILS` server-only, never in a client component; no allowlist email or `service_role` in the client bundle; httpOnly cookies via `@supabase/ssr`. |
| QA-24 | Fail closed (NFR-04) | **Pass** | Unit: missing Supabase env in prod → denied; blank `ALLOWED_EMAILS` invites nobody. Middleware + `getInvitedUser` have explicit fail-closed branches. |
| QA-25 | Accessibility (NFR-05) | **Pass** | Labeled email field (`htmlFor`/`id`), `aria-invalid`, `aria-describedby`, `role="alert"` errors, `role="status"` `aria-live` announcements, focus management, `:focus-visible` ring; not color-only (code/markup). Full AT audit interactive. |
| QA-26 | Responsive Neutra login (NFR-06) | **Pass** | Neutra tokens (floating plane, uppercase labels, single aloe primary reused for send-link); responsive layout + viewport meta (code/CSS). 360px visual is interactive. |
| QA-27 | Existing behaviour unchanged for signed-in users (NFR-07) | **Pass** | All pre-existing suites green; no schema/`getDb` change; dev-bypass run shows identical log order, export (BOM/CRLF/filename), and stats. |
| QA-28 | Performance (NFR-08) | **Pass** | Observed dev timings negligible (proxy + app-code per request in the tens of ms); navigation prompt. Not a formal benchmark. |

**Tally:** 27 Pass, 1 Deferred (deploy-time), 0 Fail.

---

## Edge Cases Exercised

- **Open-redirect smuggling:** `https://evil.com`, `http:evil`, `//evil.com`,
  `/\evil.com`, `/\/evil.com`, `javascript:...`, `../secret`, `evil.com` — all
  reduced to `/` by `safeNext` (unit); runtime `//evil.com` probe stayed
  same-origin.
- **Allowlist parsing:** mixed case, surrounding whitespace, extra/empty commas
  (`owner@example.com,,dad@example.com,`), all-blank (`" , , "`), and empty
  string never admitted.
- **Fail-closed:** missing Supabase env in production → denied; blank/absent
  `ALLOWED_EMAILS` → nobody invited.
- **Dev bypass is inert in production:** `decideAccess` with
  `nodeEnv="production"` + Supabase unconfigured → denied (never bypass), and
  bypass requires *both* non-production *and* unconfigured Supabase.
- **Export format guard:** unknown `format` → 400; only `csv`/`xlsx` served.
- **Sign-out CSRF surface:** `/auth/signout` is POST-only (GET → 405), so a
  prefetch or forged `<img>` cannot log the user out.
- **Callback with no/invalid code:** establishes no session, lands on the
  expired-link state.
- **Redirect bodies carry no data:** unauth `/`, `/stats`, `/api/export`
  responses are 6-byte redirects with no plays, counts, names, or file bytes.

## Known Limitations

- **QA-21 (deploy configuration) is a deploy-time action, not a code artifact.**
  Switching off Vercel Deployment Protection and setting the live
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `ALLOWED_EMAILS` in the Vercel project must be performed at deploy and verified
  on the deployed URL. The application itself is proven to cover every surface
  and to fail closed if those vars are absent, satisfying the precondition that
  protection flips from platform-level to app-level only once the login covers
  everything.
- **Interactive-only rows require a live Supabase project** (a real magic-link
  request, code exchange, and an authenticated invited/non-invited session):
  QA-02, QA-03, QA-05, and the live-session portions of QA-08, QA-15, QA-23,
  QA-25, QA-26. Each is verified here by code inspection, unit tests, and the
  unauthenticated redirect/deny probe. The synthetic dev-bypass user exercises
  the full authenticated app path (log/stats/export) without Supabase.
- **NFR audits (accessibility, 360px responsiveness, performance)** are verified
  from markup, CSS, and observed timings rather than a formal AT/visual/benchmark
  pass; nothing observed contradicts the requirements.

---

*Environment: Next.js 16.2.10 (Turbopack), Node/PGlite for tests and local dev.
Dev server started and stopped by The Tester; no server left running.*
