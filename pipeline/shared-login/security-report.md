# Security Report — Shared Login

**Date:** 2026-07-19
**Feature:** shared-login (application-level magic-link auth + invite allowlist)
**Stage:** 7 — The Auditor (full security review, hands-off / Studio Style)
**Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Supabase Auth via
`@supabase/ssr` (identity only), Neon/PGlite via Drizzle (data, unchanged),
deploy target Vercel.

**Checklists used:**
1. **Weft "Security Checklist — Next.js"** (`reference/checklists/security-nextjs.md`,
   loaded via `get_instructions {situational, checklist-nextjs}`) — API routes,
   env vars, CSP/headers, auth, server-component data, dependencies.
2. **OWASP-aligned auth pass** — A01 Broken Access Control, A07 Identification &
   Authentication Failures, A05 Security Misconfiguration — plus an
   auth-specific sweep: session validation (`getUser` vs `getSession`), open
   redirect, user enumeration, CSRF, secret hygiene, fail-closed behaviour, and
   the dev-bypass kill-switch.

---

## Outcome: **PASSED WITH NOTES**

The most security-sensitive feature in the app is well built. Every protected
surface independently enforces `getInvitedUser()` / `requireInvited()` **before**
any database access; the allowlist is server-side, case-insensitive, trimmed, and
fail-closed; the callback has no open redirect; the anon key + URL are the only
client-reachable Supabase secrets (the allowlist and any service-role key are
provably absent from the client bundle); and the local-dev bypass is provably
dead in production. No data-schema change; all 85 existing tests pass.

**No Critical or High findings — deploy is not blocked.** Three Low/informational
items are hardening opportunities, not gates.

---

## Summary of what was verified

- **Static review** of every new/changed file listed in the schema's file
  inventory (middleware, the three Supabase clients, `auth.ts`, login page +
  form, callback, signout, sign-out control, and the guard additions in
  `page.tsx`, `stats/page.tsx`, `api/export/route.ts`, `actions.ts`).
- **Unit tests:** the security-critical pure core (`isInvited`, `decideAccess`,
  `safeNext`) has 17 dedicated tests — all pass — including "bypass is DEAD in
  production even when Supabase is unconfigured" and the full open-redirect
  rejection matrix. Full suite: **85/85 pass**, `tsc --noEmit` clean.
- **Dynamic probe (gate ON):** ran `next dev` with Supabase *configured* (dev
  bypass off) and **no session cookie**, then hit every surface — see the Checks
  Performed table. All protected surfaces denied; public surfaces reachable;
  no off-origin redirect; a forged cookie was rejected by `getUser()`.
- **Production build with canary env values**, then grepped the client bundle
  (`.next/static`): the allowlist canary is **absent** from the client; the
  anon key + URL are present (expected, public-safe); `service_role` appears
  only as the Supabase library's own JSDoc warning string in server-side source
  maps — no key value, absent from the client bundle.
- **`drizzle-kit generate`:** "No schema changes, nothing to migrate" — confirms
  no data-schema change (only the pre-existing `0000_init.sql`; tables `plays` /
  `play_actors`, no `user_id`).

---

## Findings

### F-1 — LOW — Logout CSRF on `/auth/signout`
**Location:** `src/app/auth/signout/route.ts`
The sign-out endpoint is a plain route-handler `POST` with no `Origin` /
`Sec-Fetch-Site` / CSRF-token check. Using POST (verified: `GET` returns 405)
correctly stops prefetch/`<img>` logout, but a cross-site page that
auto-submits a `<form method="post" action="…/auth/signout">` can still force a
signed-in user to be logged out.
**Impact:** annoyance only — ends the session; **no data exposure, no state
mutation, no privilege change.** This is why it is Low and does not block deploy.
**Remediation (optional):** before signing out, verify the request `Origin`/
`Sec-Fetch-Site` matches the app origin, or reimplement sign-out as a Next
Server Action (which carries built-in CSRF/Origin protection).

### F-2 — LOW — No security response headers configured
**Location:** `next.config.ts` (no `headers()` block; no middleware headers)
None of CSP, `X-Frame-Options` / CSP `frame-ancestors`, `X-Content-Type-Options`,
`Referrer-Policy`, or `Permissions-Policy` is set — a Next.js-checklist gap. Most
relevant here: without frame-ancestors/`X-Frame-Options`, the `/login` screen can
be framed (clickjacking surface).
**Impact:** low for a two-person private archive, but cheap to fix.
**Remediation (optional):** add a `headers()` entry setting at least
`X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`),
`X-Content-Type-Options: nosniff`, and a `Referrer-Policy`.

### F-3 — INFORMATIONAL — `middleware` file convention deprecated in Next 16
**Location:** `src/middleware.ts`
Build/dev both warn: *"The 'middleware' file convention is deprecated. Please use
'proxy' instead."* The middleware **still runs** (dynamically verified: it issues
the `/login` redirects), so there is no current gap, and defense-in-depth means
every boundary re-checks even if middleware ever lapsed. Migrate to `proxy.ts`
before a future major to avoid a silent outer-gate loss.

### F-4 — INFORMATIONAL — No app-level rate limiting on magic-link requests
The login form calls `signInWithOtp` with no app-side throttle, relying on
Supabase's built-in per-email / per-IP OTP limits. The allowlist bounds who can
actually gain access; residual risk is email-bombing an address up to Supabase's
limits. Acceptable for this app; noted for awareness.

### F-5 — INFORMATIONAL — Cookie flags verified by design, not by live capture
Session cookies are managed by `@supabase/ssr` with the canonical, un-overridden
cookie adapter, which sets `HttpOnly` (and `Secure` in production) by default;
the code never reads the session from client storage (gating is server-side
`getUser()` only). This could not be observed on a live `Set-Cookie` because no
real Supabase project was available in review. **Verify once in production**
(DevTools → Application → Cookies: `HttpOnly` + `Secure` present on the
`sb-*-auth-token` cookies).

---

## Checks Performed

| # | Check | Method | Result |
|---|---|---|---|
| 1 | `/` denies unauthenticated | dynamic (no cookie) | **307 → /login** ✅ |
| 2 | `/stats` denies unauthenticated | dynamic | **307 → /login** ✅ |
| 3 | `/api/export?format=csv` denies | dynamic | **307 → /login** (no file) ✅ |
| 4 | `/api/export?format=xlsx` denies | dynamic | **307 → /login** (no file) ✅ |
| 5 | Each surface re-checks independently (not middleware-only) | code review | `getInvitedUser()` in `page.tsx`, `stats/page.tsx`, `api/export`; `requireInvited()` in all 3 actions — all **before** first `getDb()` ✅ |
| 6 | Server actions guarded (public POST endpoints) | code review | `createPlayAction`/`updatePlayAction`/`deletePlayAction` throw before any DB op ✅ |
| 7 | Middleware matcher covers `/`,`/stats`,`/api/export`; leaves `/login`,`/auth/*`,static open | code + dynamic | `/login` 200, `/auth/*` reachable, no redirect loop ✅ |
| 8 | Allowlist server-side, case-insensitive + trimmed | unit tests | 17/17 incl. mixed case + stray spaces ✅ |
| 9 | Valid session, non-allowlisted email → denied everywhere | code + unit | middleware `signOut`+redirect; callback `signOut`; `decideAccess`→denied ✅ |
| 10 | Uses `getUser()` (revalidates), never `getSession()` for gating | grep + code | only `getUser()` in gates; `getSession` appears only in warning comments ✅ |
| 11 | Forged/garbage auth cookie rejected | dynamic | **307 → /login** (getUser revalidates) ✅ |
| 12 | Open redirect blocked (`https://evil.com`, `//evil.com`) | dynamic + unit | never redirects off-origin; `safeNext` matrix passes ✅ |
| 13 | CRLF in `next` neutralized | code review | `safeNext` + `new URL(next, origin)` strips control chars + origin re-check + Node header validation ✅ |
| 14 | `ALLOWED_EMAILS` absent from client bundle | canary prod build + grep | canary secret **absent** from `.next/static`; not inlined (runtime-only) ✅ |
| 15 | No service-role key anywhere | grep app + build | only library JSDoc strings server-side; **none** in client bundle ✅ |
| 16 | Only URL + anon key are `NEXT_PUBLIC_` | code + build | anon key/URL present in client (expected); nothing else ✅ |
| 17 | Dev bypass provably dead in production | unit test + code | requires `NODE_ENV!=="production"` **and** Supabase unconfigured; prod is both false ✅ |
| 18 | Fail closed on missing env / empty allowlist | unit + code | missing Supabase → deny; empty `ALLOWED_EMAILS` → nobody invited ✅ |
| 19 | Sign-out is server-side POST, GET rejected | dynamic | POST → 303 /login; GET → **405** ✅ |
| 20 | Sign-out clears session server-side | code review | `supabase.auth.signOut()` (cookie removal via adapter) ✅ |
| 21 | No user enumeration at request time | code review | uniform "check your email"; `shouldCreateUser:true`; no allowlist check pre-send ✅ |
| 22 | CSRF posture — server actions | code review | Next Server Actions carry built-in Origin/CSRF protection (residual low) ✅ |
| 23 | CSRF — signout | dynamic + code | POST-only; **no Origin check** → see F-1 (Low) ⚠️ |
| 24 | No data-schema change | `drizzle-kit generate` | "No schema changes, nothing to migrate"; only `0000_init.sql` ✅ |
| 25 | Existing behaviour intact for signed-in users | full test suite | **85/85 pass**, `tsc` clean ✅ |
| 26 | Queries parameterized (no SQL injection) | code review | Drizzle query builder / bound `sql` params throughout ✅ |
| 27 | Security response headers | code review | none configured → see F-2 (Low) ⚠️ |
| 28 | `.env*`/`.env.local` gitignored | file review | `.gitignore` covers `.env`, `.env*.local`, `.env*` ✅ |
| 29 | Middleware convention deprecation | build warning | still functions; see F-3 (info) ⚠️ |

---

## Deploy notes (for the owner)

1. **Vercel env (Production):** set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ALLOWED_EMAILS`. Keep `ALLOWED_EMAILS`
   **server-only** — never prefix it with `NEXT_PUBLIC_`. Do **not** add a
   `SUPABASE_SERVICE_ROLE_KEY`; nothing in this feature needs one.
2. **Supabase dashboard:** enable Email provider (magic link / OTP, no password);
   set **Site URL** to the production domain; add **Redirect URLs allowlist**
   (`https://<prod-domain>/**` and `http://localhost:3000/**`) — the provider-side
   open-redirect guard.
3. **Flip protection LAST:** verify the login covers every surface in preview →
   set env → configure Supabase → redeploy → confirm a signed-out stranger lands
   on `/login` → **only then** turn **off** Vercel Deployment Protection
   (Project Settings → Deployment Protection), so the archive is never briefly
   public.
4. **After deploy:** confirm the `sb-*-auth-token` cookies show `HttpOnly` +
   `Secure` (F-5).
5. **Optional hardening (both Low):** add security response headers (F-2) and an
   `Origin` check on `/auth/signout` (F-1).

**Review housekeeping:** a stale `next dev` (PID 20285) was already running in the
project directory during review; it was stopped to run a clean gated test, and
the canary build artefacts were removed. No dev server is running now.
