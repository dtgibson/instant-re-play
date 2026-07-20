# Security Report — Data Export

- **Date:** 2026-07-19
- **Feature:** data-export (`GET /api/export?format=csv|xlsx` — full-archive CSV / XLSX download)
- **Stage:** 7 — The Auditor
- **Stack:** Next.js 16 (App Router, Route Handler, `runtime = "nodejs"`) · TypeScript · Drizzle ORM · Postgres via Neon (prod) / PGlite (dev+tests) · `exceljs` 4.4.0 (XLSX writer)
- **Checklists used:**
  - `security-nextjs` (managed Next.js checklist — the frontend stack)
  - Generic data-access + OWASP pass (Neon has no dedicated checklist)
  - `security-supabase` (borrowed for shared data-access / RLS / secrets thinking; Supabase-specific items N/A — this app uses Neon + Drizzle, not Supabase)
- **Outcome:** **PASSED WITH NOTES**

---

## Summary

The data-export feature adds one read-only HTTP surface (`GET /api/export`) plus a
pure serializer library (`src/lib/export.ts`) and one dependency (`exceljs`). The
review focused on the **new** attack surface: spreadsheet formula injection, the
new route's input/header/filename handling, CSV (RFC 4180) correctness, the
`exceljs` dependency, and data exposure.

**No new implementation vulnerability was found.** The security-critical logic —
formula-injection neutralization and RFC 4180 quoting — is correct, is applied in
the right order (neutralize *before* CSV quoting), covers **both** formats, and
survived an adversarial bypass hunt. The one unauthenticated-access observation is
the **documented, accepted v1 design posture** (single-user app, deployment-level
access control), not an implementation defect, and does not block deploy.

Verification run by the Auditor: `vitest run` (47/47 passed), the adversarial
`scripts/verify-export.ts` end-to-end harness (45/45 passed, including the real
Route Handler), and custom neutralizer bypass probes (see Checks Performed). `src/`
typechecks clean.

---

## Findings

| # | Severity | Title | Status |
|---|----------|-------|--------|
| 1 | Informational | Export route is unauthenticated — full archive readable by anyone who can reach the URL | Accepted v1 posture (mitigated by private deployment) |
| 2 | Informational | Transitive `uuid` moderate advisory via `exceljs`; unreachable in this usage | No action required |
| 3 | Informational | Type error in `scripts/verify-export.ts` (verify harness, not shipping code) — build hygiene, not security | Recommend trivial fix |

### 1. Unauthenticated export of the full archive — Informational (accepted)

`GET /api/export` performs no session/auth check and returns the entire `plays`
archive to any caller who can reach the URL. This is **by design and documented**:
`pipeline.config.json` records `auth.strategy = "none"` with "Access control is
deployment-level (private deployment / Vercel Deployment Protection). Anyone who
can reach the URL can read and write," and the PRD/schema state the single-user,
deployment-level privacy model (NFR-02). Every existing surface (Server Actions,
the list read) already shares this posture; export adds no new *class* of exposure —
the same data is already served to the same audience by the list view.

- **Mitigation (in place / required at deploy):** keep the deployment private
  (Vercel Deployment Protection / SSO / password). Do not expose the URL publicly.
- **Blocking?** No. Per the review scope this is the documented, accepted design
  decision, surfaced as Informational — not a Critical/High. Revisit if/when the
  product adds multi-user or public deployment (would then require real auth).

### 2. Transitive `uuid` advisory via `exceljs` — Informational

`npm audit` reports GHSA-w5hq-g745-h8pq (moderate): "uuid missing buffer bounds
check in v3/v5/v6 when `buf` is provided," pulled in transitively by `exceljs`. The
vulnerable path only triggers when a caller passes a `buf` argument to uuid
generation; `exceljs` calls `uuid()` for string ids and never passes `buf`, so the
path is **not reachable**. `exceljs` itself is **MIT-licensed**, pure-JS, used
**server-side only** (dynamically imported inside the `nodejs` Route Handler), and
this feature only **writes** workbooks (`writeBuffer()`) — it never parses untrusted
`.xlsx` input, so parser-side advisory classes do not apply. A moderate `postcss`
advisory (GHSA-qx2v-qp2m-jg93) also appears in the Next build toolchain; it is
build-time only and unrelated to the export runtime. No Critical/High; nothing that
applies to the export attack surface.

### 3. Type error in the verify harness — Informational (build hygiene, not security)

`scripts/verify-export.ts:213` has a TS2358 (`… instanceof Date` on a value already
narrowed to `string`). It is in a **verification script**, not the shipping feature;
`src/` typechecks clean and all runtime tests pass. It carries **no security
consequence**. It is noted only because `tsconfig` `include` globs `**/*.ts`, so it
could trip `next build`'s typecheck — a one-line fix in the harness (drop the
redundant `instanceof` guard). Out of security scope; flagged for the record.

---

## Checks Performed

| Area | Check | Result |
|---|---|---|
| **Formula injection (FR-08)** | `neutralizeCell` prefixes `'` to any value starting with `=` `+` `-` `@`, TAB (U+0009), CR (U+000D) | PASS — regex `/^[=+\-@\t\r]/`, exact canonical set |
| Formula injection — order | Neutralization applied **before** RFC 4180 quoting (apostrophe lands inside the quoted field) | PASS — `csvField` calls `neutralizeCell` first, then quotes; probe `"'=x,y"` confirmed |
| Formula injection — both formats | Applied to **every** cell of CSV **and** XLSX (including header cells) | PASS — CSV via `csvField`; XLSX via `row.map(neutralizeCell)` |
| Formula injection — bypass hunt | Leading space / leading LF / fullwidth `＝` (U+FF1D) / `=` not-first-char | PASS — none is a live vector: space+LF are not stripped-to-formula by spreadsheets and inputs are `.trim()`-ed at write time; homoglyph is not the ASCII `=` operator; canonical `\t`/`\r` are guarded |
| Formula injection — XLSX cell typing | Raw `=`-leading string assigned to `cell.value` cannot become a live formula | PASS — probe shows `exceljs` stores a plain string (`isFormula: false`); pipeline stores `'=1+1` as text with numFmt `@` |
| **Route input validation** | `?format=` strictly validated to `csv`/`xlsx`, else 400 | PASS — `isExportFormat` narrows to `"csv"|"xlsx"`; unknown/missing → 400 (`verify-export` confirms both) |
| Route — no unvalidated value into logic/headers/filename | Headers use fixed `CONTENT_TYPE[format]`; filename from validated format + server date | PASS — no user input reaches any header or the filename |
| Route — reflected input | 400 body echoes `format` value | PASS (safe) — `Content-Type: text/plain`, not a header, not HTML → no reflected XSS / no header injection |
| Route — path traversal | Filename `instant-re-play-<UTC date>.<ext>`, no user-controlled path segment | PASS — no traversal surface |
| Route — content sniffing | `Content-Disposition: attachment` (not inline) + `Cache-Control: no-store` | PASS — download-only, archive not cached |
| Route — runtime | `export const runtime = "nodejs"`, `dynamic = "force-dynamic"` | PASS — exceljs stays server-side; read at request time |
| **Data access / injection** | Reuses `listPlays` (Drizzle parameterized reads); export takes no filter params | PASS — no string interpolation, no user input in SQL |
| Secrets exposure | Route/lib reference any `process.env` / DATABASE_URL / secrets | PASS — none referenced; response carries play data only |
| `.env` hygiene | `.env` / `.env*.local` git-ignored; only `.env.example` (no real secrets) present | PASS |
| **CSV correctness (RFC 4180)** | Comma/quote/CR/LF fields quoted; embedded `"` doubled; CRLF rows; UTF-8 BOM | PASS — adversarial round-trip parse (comma+quote+newline in one cell) preserved, no column drift; accented names intact |
| Empty archive | Header-only valid file, both formats, never an error | PASS |
| **Dependency (`exceljs`)** | License / server-only / advisory applicability | PASS — MIT, server-side write-only; transitive `uuid` advisory unreachable (see Finding 2); no applicable Critical/High |
| **Data exposure** | Full archive returned without auth | Informational — documented accepted v1 posture; mitigate with private deployment (Finding 1) |
| Next.js checklist — CSP/headers/env/deps | Reviewed against `security-nextjs` | No export-specific gap; app-level headers/CSP unchanged by this feature |
| Verification run | `vitest run`; `scripts/verify-export.ts`; custom probes; `tsc` on `src/` | 47/47 + 45/45 + probes green; `src/` clean |

---

## Deploy decision

**PASSED WITH NOTES — does not block deploy.** No Critical or High security finding;
no new implementation vulnerability. The single Informational item of substance
(unauthenticated export) is the documented, accepted single-user v1 posture whose
mitigation is a **private deployment** — which must remain in place. The dependency
and harness-typecheck notes are non-blocking.
