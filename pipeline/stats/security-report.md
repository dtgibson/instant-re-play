# Security Report — Theatregoing Stats

**Date:** 2026-07-19
**Feature:** stats
**Stage:** 7 — The Auditor (security review)
**Stack:** Next.js 16 (App Router, RSC + Server Actions) · TypeScript · Drizzle ORM · Postgres (Neon prod / PGlite local) · Vercel
**Reviewer:** The Auditor (hands-off / Studio Style)

---

## Checklist(s)

- **Next.js App Router security checklist** — the Weft-hosted `security-nextjs`
  situational checklist was requested via `get_instructions` but returned *no
  content* (`available: false`). Review fell back to the standard Next.js
  App Router security pass: `searchParams` handling, Server Component vs.
  `"use client"` boundary, Server Action mutation surface, secret exposure to
  the client, `dangerouslySetInnerHTML`/redirect sinks.
- **Generic data-access review** — no dedicated Neon checklist exists, so a
  manual data-access pass covered query construction, parameterization, and the
  read/write surface of the new code.
- **OWASP Top 10 pass** — Injection (A03), XSS (A03), Broken Access Control
  (A01), SSRF/open-redirect (A10), Security Misconfiguration (A05), Vulnerable
  Dependencies (A06).

---

## Outcome

**PASSED** — no Critical or High findings. The feature is a purely additive,
read-only aggregation plus a URL-seeded filter. The one Informational item
(unauthenticated archive) is the documented, accepted single-user v1 posture,
not introduced by this feature and not a deploy blocker.

**Blocks deploy: NO.**

---

## Summary

The stats feature adds:

- `src/lib/stats.ts` — a pure, DB-free, HTTP-free `computeStats(plays)` over the
  existing `Play[]`. No I/O, no injection surface.
- `src/app/stats/page.tsx` — a `force-dynamic` **Server Component**. It reads the
  archive via the existing `listPlays(db)` (SELECTs only), computes stats, and
  renders static markup. No mutation, no `"use client"`, no secrets, no external
  calls, no new dependency.
- `src/lib/query.ts` — pure `filterHref()` and `parseFilter()` helpers.
- `src/app/page.tsx` — reads `searchParams`, runs `parseFilter`, passes an
  `initialFilter` prop to `PlayLog`.
- `src/components/play-log.tsx` — seeds its existing single-filter `useState`
  from `initialFilter`.

**The new attack surface is the `/?filter=<type>&value=<value>` URL param.** It
was traced end-to-end and is safe:

1. **Type is allow-listed.** `parseFilter` accepts `type` only when it is
   exactly `"venue" | "director" | "actor"` (case-sensitive literal comparison);
   anything else — absent, wrong case (`"VENUE"`), unknown (`"author"`),
   non-string, or an array (Next yields `string[]` for repeated keys, which the
   `typeof sp.filter === "string"` guard in `page.tsx` rejects) — yields `null`
   and the log loads unfiltered. Verified by the passing `tests/query.test.ts`
   suite (bad type, wrong case, empty value, missing type/value all → `null`).

2. **Value is opaque exact-match text.** It is never parsed, never used to build
   a query. Filtering happens in memory via `matchesFilter` (`play.venue ===
   value`, `play.director === value`, `play.actors.includes(value)`) over the
   already-loaded `Play[]`. It is **never interpolated into SQL** — and the DB
   layer is Drizzle with column-reference-only `sql` templates and `eq()`
   parameter binding regardless, so no SQL-injection path exists.

3. **No reflected XSS.** The value is rendered in the active-filter banner as a
   plain JSX child — `<strong>{filter.value}</strong>` — which React
   HTML-escapes. There is **no `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
   or `new Function`** anywhere in `src/` (grep clean). A crafted value such as
   `"><script>alert(1)</script>` renders as inert text.

4. **No HTML/redirect construction from the value.** There is no `redirect()`,
   `permanentRedirect()`, or `middleware`. The only URL built from a value is
   the *outbound* `filterHref`, which `encodeURIComponent`s the value; and
   `filter.type` (used as a `FILTER_LABEL` object key) is constrained to the
   three allow-listed literals, so no prototype-pollution / unexpected-key path.
   `parseFilter` also receives an explicitly-constructed `{ filter, value }`
   object (not the raw `searchParams`), so no `__proto__`-key concern.

**No schema / auth change.** `drizzle/` contains only `0000_init.sql`; this
feature adds no migration, table, column, or constraint (QA-23). Auth posture is
unchanged — there is still no in-app auth (`auth.strategy: "none"`), by design.

**No secret exposure.** `process.env` is referenced only in `src/db/index.ts`
(`DATABASE_URL`, `PGLITE_DATA_DIR`), both server-only; no `NEXT_PUBLIC_*` and no
env value crosses to a client component. **No new dependency** — `package.json`
is unchanged.

---

## Findings

| # | Severity | Title | Notes |
|---|----------|-------|-------|
| 1 | Informational | Unauthenticated full-archive read/write is the accepted v1 posture | Pre-existing and documented in `pipeline.config.json` (`auth.strategy: "none"` — single-user personal app; access control is deployment-level via private deployment / Vercel Deployment Protection). Not introduced or widened by the stats feature. `/stats` exposes only aggregate counts over the same archive the log already serves unauthenticated. **Not a blocker.** Mitigation: keep the deployment private (Vercel Deployment Protection). Revisit if the app ever becomes multi-tenant. |

No Critical, High, Medium, or Low findings.

---

## Checks Performed

| Area (OWASP / checklist) | Check | Result |
|---|---|---|
| Injection — XSS (A03) | Filter `value` rendered in banner is React-escaped (`<strong>{filter.value}</strong>`), not raw HTML | PASS — no reflected XSS |
| Injection — XSS (A03) | Grep for `dangerouslySetInnerHTML` / `innerHTML` / `__html` / `eval` / `new Function` in `src/` | PASS — none found |
| Injection — SQL (A03) | Filter `value` never reaches a query; in-memory `===` / `.includes` only; DB uses Drizzle `eq()` + column-only `sql` templates | PASS — no SQLi surface |
| Input validation | `parseFilter` allow-lists `type` to `venue\|director\|actor` (case-sensitive); rejects absent/wrong-case/unknown/non-string/array | PASS — verified by `tests/query.test.ts` (32/32) |
| Input validation | Repeated `?filter=`/`?value=` keys (Next `string[]`) rejected by `typeof === "string"` guard in `page.tsx` | PASS |
| Broken Access Control (A01) | `/stats` is read-only: no create/edit/delete control; only `listPlays` SELECTs | PASS |
| Mutation surface | No new Server Action; existing mutations untouched by this feature | PASS |
| Open redirect / SSRF (A10) | No `redirect()`/`permanentRedirect()`/`fetch`/external call; `filterHref` builds a relative, `encodeURIComponent`-encoded URL | PASS |
| Prototype pollution | `FILTER_LABEL[filter.type]` key constrained to 3 literals; `parseFilter` fed an explicit object, not raw `searchParams` | PASS |
| Secret exposure (A05) | `process.env` server-only (`src/db/index.ts`); no `NEXT_PUBLIC_*`; no env value crosses RSC→client | PASS |
| RSC boundary | `stats/page.tsx` has no `"use client"`; runs `force-dynamic` on the server | PASS |
| Schema integrity (QA-23) | `drizzle/` holds only `0000_init.sql`; no new migration/table/column/constraint | PASS |
| Auth posture | No change; `auth.strategy: "none"` unchanged, deployment-level access control | PASS (Informational #1) |
| Vulnerable dependencies (A06) | `package.json` unchanged; no new dependency added | PASS |
| Verification | `npx vitest run tests/query.test.ts tests/stats.test.ts` | PASS — 32/32 |
