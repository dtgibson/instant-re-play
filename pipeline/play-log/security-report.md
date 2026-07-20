# Security Review — The Play Log

**Date:** 2026-07-18
**Feature:** play-log
**Stack:** Next.js (App Router) + TypeScript frontend · Postgres on Neon (Drizzle ORM), PGlite embedded Postgres for local/dev · Vercel deploy
**Checklists used:**
- `reference/checklists/security-nextjs.md` (frontend = `nextjs`) — applied in full.
- `reference/checklists/security-supabase.md` — **borrowed** for shared Postgres/RLS/data-handling thinking. `neon` has **no dedicated checklist**, so per the documented fallback I ran a generic data-access pass (parameterized queries / no SQL injection, DB secrets never client-exposed, server-side authz/access scoping) plus the **OWASP Top 10**, and used the Supabase list as the closest relational-DB reference. Supabase-auth-specific and RLS-specific items are marked **N/A (no in-app auth by design; single Postgres role)** below.

**Outcome:** PASSED WITH NOTES

---

## Summary

The Play Log is a small, well-bounded Next.js App Router app with a clean
server boundary: all reads go through a Server Component (`page.tsx`) and all
writes through three `"use server"` Server Actions, both of which re-validate
and normalize input server-side before touching the database. Every database
query uses the Drizzle query builder with bound parameters — there is no raw
string SQL carrying user input anywhere, and search/filter/sort run in-memory
in pure JavaScript, so there is effectively **zero SQL-injection surface**. All
user-supplied text renders through React's default escaping (no
`dangerouslySetInnerHTML`, no `innerHTML`, no `eval`), and the IMDb external
links are correctly hardened (`encodeURIComponent`, `target="_blank"`,
`rel="noopener noreferrer"`, name-only payload). No secrets are committed and
`DATABASE_URL` never crosses into the client bundle.

No Critical or High implementation vulnerabilities were found, so **deployment
is not blocked**. Three notes are surfaced: the app ships no HTTP security
headers / CSP (Low, defense-in-depth), Server Action inputs are not
runtime-schema-validated (Informational hardening), and — by explicit,
documented v1 design — there is no in-app authentication, so anyone who can
reach the URL can read and write (Informational, mitigated by keeping the
deployment private). None of the three blocks ship.

---

## Findings

### 1. Access control is deployment-level only — no in-app auth (ACCEPTED BY DESIGN)

**Severity:** Informational
**Location:** `src/app/actions.ts` (all three actions), `src/app/page.tsx`; design of record in `schema.md` → Design Decisions ("Auth: none in v1") and `pipeline.config.json` → `auth.strategy: "none"`.
**Description:** The Server Actions (`createPlayAction`, `updatePlayAction`, `deletePlayAction`) and the reading page perform no session or identity check — anyone who can reach the URL can list, create, edit, and delete every entry. This is a **deliberate, documented product decision** for a single-user personal archive, not an implementation defect: there is no user table, no `user_id`, and no login by design. Because there is no authenticated session, no auth cookie/token, and no per-user data to segregate, the classic auth-bypass and IDOR risks do not apply here — there is nothing to escalate to.
**Remediation:** No code change required for v1. Mitigate at the deployment layer: keep the Vercel project **private** and enable **Vercel Deployment Protection** (or equivalent network/SSO gating) so the URL is not publicly reachable. If accounts are ever added, the schema note already anticipates an additive `user_id` migration plus an `auth.uid()`-style check in each action.
**Status:** Accepted (by design; mitigation is a deploy-time responsibility — see Deploy Notes).

### 2. No HTTP security headers / Content Security Policy configured

**Severity:** Low
**Location:** `next.config.ts` — no `headers()` block; no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`.
**Description:** The app sends no security response headers. In this specific app the practical risk is limited — there is no `dangerouslySetInnerHTML` sink, no auth cookie/token to exfiltrate, and it is a single-user private deployment — so this is defense-in-depth rather than an exploitable hole. Still, a CSP and standard hardening headers are the recommended baseline (clickjacking protection via frame-ancestors/`X-Frame-Options`, MIME-sniffing protection via `X-Content-Type-Options: nosniff`, referrer minimization). HTTPS enforcement itself is handled by the Vercel platform (automatic HTTP→HTTPS redirect + HSTS at the edge), so that checklist item is satisfied by hosting.
**Remediation:** Add an `async headers()` block to `next.config.ts` returning, for all routes: `Content-Security-Policy` (a restrictive baseline — `default-src 'self'`; note Next may need `'unsafe-inline'`/nonce handling for its inline runtime styles/scripts, so validate against the built app before enforcing), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin`, and a minimal `Permissions-Policy`. Roll CSP out in report-only first if convenient.
**Status:** Open (non-blocking; recommended before or shortly after ship).

### 3. Server Action inputs are not validated against a runtime schema

**Severity:** Informational
**Location:** `src/app/actions.ts` (`createPlayAction`/`updatePlayAction` accept `input: PlayInput`, `id: string`); `src/lib/play.ts` `normalizePlayInput`.
**Description:** Server Actions are a public POST endpoint; TypeScript types are erased at runtime, so a hand-crafted request could send a payload whose shape differs from `PlayInput` (e.g. `actors` as a non-array, `id` as a non-UUID string). `normalizePlayInput` is defensively written (`?? ""`, `?? []`, per-value trim), and all values reach SQL only as **bound parameters** — so this is **not** an injection or data-corruption-beyond-your-own-log risk. The worst realistic outcome of a malformed shape is a thrown error / 500 (e.g. a non-array `actors` that isn't iterable, or a non-UUID `id` rejected by Postgres' `uuid` type), not a security bypass. Flagged as hardening, not a vulnerability.
**Remediation:** Optionally add a lightweight runtime guard at the top of each action (e.g. a small Zod/valibot schema, or a hand-rolled shape check that coerces `actors` to an array of strings and asserts `id` is a UUID) so malformed input returns a clean validation error instead of a 500. Purely robustness; no security exposure today.
**Status:** Open (optional hardening; non-blocking).

---

## Positive controls verified (worth recording)

- **No SQL-injection surface.** Every query uses Drizzle's builder with bound
  params (`eq(plays.id, id)`, `.values(...)`, `.set(...)`). The only raw
  ``sql`...``` fragments interpolate **column identifiers** (`t.name`,
  `plays.dateSeen`), never user input (`src/db/schema.ts`, `src/db/repository.ts`).
  Search/filter/sort execute in-memory in pure JS (`src/lib/query.ts`
  `matchesSearch`/`matchesFilter`/`comparePlays`) over a list loaded with no
  user-controlled `WHERE`, so the free-text search reaches SQL **not at all** —
  even safer than a parameterized `ILIKE`.
- **No XSS sinks.** Repo-wide grep found no `dangerouslySetInnerHTML`,
  `innerHTML`, `eval`, or `new Function`. All user text (play name, venue,
  director, actor names; toast strings; delete-confirm target) renders as React
  children and is auto-escaped.
- **External-link safety (FR-18 / NFR-05).** `src/components/person-value.tsx`
  builds the href via `imdbUrl()` → hardcoded `https://www.imdb.com` host with
  `encodeURIComponent(name)`; `target="_blank"` is paired with
  `rel="noopener noreferrer"`; only the clicked name is sent. Fixed scheme +
  encoded query param means no `javascript:` URI, no open-redirect, no data
  leak beyond the name.
- **Secret hygiene.** `DATABASE_URL` is read only in the server module
  `src/db/index.ts`; no `NEXT_PUBLIC_` variable exists anywhere. `.env` and
  `.env*.local` are gitignored; `.env.example` has no uncommented
  key=value lines (placeholder guidance only); `drizzle.config.ts` falls back to
  a non-secret placeholder. `serverExternalPackages` keeps the DB drivers out of
  the client bundle.
- **Server boundary intact.** `@/db` / `@/db/repository` are imported only by
  `src/app/actions.ts` (`"use server"`) and `src/app/page.tsx` (Server
  Component). No `"use client"` file imports the database. No route handlers or
  middleware exist to form an unguarded second entry point.
- **No SSRF surface.** No server-side fetch of any user-supplied URL; the only
  outbound URL is the fixed IMDb host, navigated client-side.

---

## Checks Performed

### Next.js checklist (`security-nextjs.md`)

| Check | Result |
|---|---|
| Authenticated API routes check session before processing | N/A — no API routes; no in-app auth by design (Finding 1) |
| API routes validate/sanitize all input | Pass (adapted to Server Actions) — server re-validates via `normalizePlayInput`/`validatePlayInput`; see Finding 3 for shape hardening |
| API routes return appropriate status codes (401/403) | N/A — no auth layer by design |
| Internal/non-public routes protected | N/A — no route handlers; access is deployment-level (Finding 1) |
| Routes do not expose server env vars in responses | Pass — actions return only play data; no env echoed |
| All `NEXT_PUBLIC_` vars are non-sensitive | Pass — no `NEXT_PUBLIC_` vars exist |
| Secrets use non-public var names (no `NEXT_PUBLIC_` prefix) | Pass — `DATABASE_URL` is server-only |
| `.env.local` in `.gitignore` (verified) | Pass — `.env` and `.env*.local` gitignored |
| No credentials in any committed file incl. `next.config` | Pass — `.env.example` clean; config uses non-secret placeholder |
| `NEXTAUTH_SECRET` strong (if NextAuth) | N/A — NextAuth not used |
| CSP header configured | **Finding 2** — none configured |
| CSP avoids `unsafe-inline` scripts without nonce/hash | N/A — no CSP present (see Finding 2) |
| CSP avoids `unsafe-eval` | N/A — no CSP present (see Finding 2) |
| Trusted external script domains explicitly listed | N/A — no external scripts; fonts self-hosted via `next/font` |
| Session tokens are httpOnly cookies, not localStorage | N/A — no sessions/tokens |
| CSRF protection enabled | N/A — no auth; no cookie-authenticated state-changing endpoint to forge against |
| OAuth callback URLs allowlisted | N/A — no OAuth |
| JWT session expiry reasonable | N/A — no JWTs |
| Server Components don't over-pass sensitive props to Client | Pass — only play data passed to `PlayLog` |
| `fetch` in Server Components doesn't leak API keys in URLs | Pass — no such fetch; DB access via bound Drizzle queries |
| DB queries parameterized (no string interpolation) | Pass — Drizzle builder + bound params throughout |
| SSR data fns don't return unneeded sensitive fields | Pass — schema has no PII/secret columns; only log data returned |
| Security headers set (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | **Finding 2** — not configured |
| HTTPS enforced (HTTP→HTTPS) | Pass — provided by Vercel platform (edge redirect + HSTS) |
| No known-vulnerable packages in `package.json` | Pass (reviewed) — no advisory-flagged direct deps observed; recommend `npm audit` in CI |
| `next` and related on current supported version | Pass — Next `^16.2.10`, React `19`, Drizzle `0.45.2` (current majors) |

### Neon fallback: generic data-access pass + relational-DB items (from `security-supabase.md`) + OWASP Top 10

| Check | Result |
|---|---|
| Parameterized queries / no SQL injection from user input | Pass — bound params only; search/filter in-memory JS; raw `sql` fragments carry column identifiers, not user data |
| DB connection secret never client-exposed | Pass — `DATABASE_URL` server-only; drivers kept external from client bundle |
| Server-side authorization / access scoping enforced | By design N/A — single-user app, no per-user rows to scope (Finding 1); writes gated only at deploy layer |
| Row-level access scoped to caller (RLS analog) | N/A — no per-user data model; single Postgres role; RLS not applicable in v1 |
| No `SELECT *` exposing PII | Pass — tables hold only user's own theatre log; no PII/credential columns |
| User input inserted via parameterized methods only | Pass — Drizzle `.values()`/`.set()` |
| Sensitive data (passwords/payment) not stored | Pass — none stored; no auth, no payments |
| DB credentials in `.env`, not hardcoded; `.env` gitignored | Pass — verified |
| Error responses don't leak internal implementation detail | Pass — actions surface field-error maps or rethrow to the framework's generic 500; internal `Error` messages (e.g. play-not-found) aren't rendered to the user |
| OWASP A01 Broken Access Control | Accepted-by-design gap (Finding 1); mitigated at deploy layer |
| OWASP A02 Cryptographic Failures | Pass — TLS at edge; no secrets in client; no custom crypto |
| OWASP A03 Injection | Pass — no SQL/HTML/command injection surface |
| OWASP A04 Insecure Design | Pass for scope — auth-less design is explicit and documented with a deploy-layer mitigation |
| OWASP A05 Security Misconfiguration | **Finding 2** — missing security headers/CSP |
| OWASP A06 Vulnerable/Outdated Components | Pass (reviewed) — current majors; recommend `npm audit` in CI |
| OWASP A07 Identification/Auth Failures | N/A by design (Finding 1) |
| OWASP A08 Software/Data Integrity Failures | Pass — no untrusted deserialization; migrations version-controlled (`drizzle/0000_init.sql`) |
| OWASP A09 Logging/Monitoring Failures | Informational — no app-level audit logging (acceptable for single-user v1) |
| OWASP A10 SSRF | Pass — no server-side fetch of user-supplied URLs; only fixed IMDb host, client-navigated |
| Stored XSS via rendered user text | Pass — React auto-escaping; no HTML sinks |
| External link tab-nabbing / data leak (NFR-05) | Pass — `rel="noopener noreferrer"`, `encodeURIComponent`, name-only payload |

---

## Convention Flags
- Security response headers (CSP + `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`)
  should be a standing baseline configured in `next.config.ts` for this project
  going forward.
- Public server entry points (Server Actions / route handlers) should validate
  input shape against a runtime schema, not TypeScript types alone, as a
  standing convention.
- The auth-less v1 posture is safe **only** while the deployment stays private —
  private deployment / Vercel Deployment Protection should be treated as a
  required, non-optional part of every ship of this app until in-app auth exists.
