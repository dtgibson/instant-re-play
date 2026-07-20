# Security Report — Entry Polish & App Icon

- **Date:** 2026-07-19
- **Feature:** entry-polish-and-app-icon (self-sourced autocomplete, new optional `playwright` field, home-screen app icon + web app manifest)
- **Stack:** Next.js 16 (App Router, Node runtime), React 19, Drizzle ORM + Postgres (Neon in prod / PGlite locally), Supabase SSR auth, exceljs export, sharp (build-time icon rasterizer)
- **Checklist(s):** Security Checklist — Next.js (`reference/checklists/security-nextjs.md`, loaded via `get_instructions`)
- **Outcome:** **PASSED WITH NOTES**

Critical/High findings: **none**. This change does **not** block deploy.

---

## Summary

The improvement is additive UI/data. I reviewed the full changed surface — the middleware matcher change, the new `playwright` column and its migration, the repository/query/export/suggest logic, the entry drawer and row/person-value/autocomplete components, the manifest and layout metadata, and the icon pipeline. The change introduces **no new trust boundary weakening and no new data-exposure surface**.

The most important item, the **middleware matcher change**, is safe. Adding `webmanifest` to the un-gated extension list exposes `/manifest.webmanifest` only, which serves **public app metadata exclusively** (name, short_name, description, display, start_url, theme/background colors, static icon URLs) — verified live. The data routes `/`, `/stats`, and `/api/export` remain gated by middleware (verified by simulating the compiled matcher regex), and each of them additionally re-verifies `getInvitedUser()` before any DB read (defense in depth — middleware is the first gate, not the only gate). No change was made to `updateSession`, `auth.ts`, `decideAccess`, or any session logic.

The `playwright` column is written/read through parameterized Drizzle (no interpolation), rendered React-escaped in the row, neutralized against spreadsheet formula injection in both CSV and XLSX like every other cell, and its filter type is allow-listed in `parseFilter`. Autocomplete is pure client-side over the archive already loaded in-page — no new endpoint, no server round-trip, no data beyond what the signed-in user already sees. `sharp` is a build-only devDependency, not a runtime dependency, and is absent from the compiled server bundle; the app serves static PNGs.

---

## Findings

### FR-1 — Middleware extension exclusion is broad; safety rests on defense-in-depth (Informational / Low)
The matcher un-gates **any** path ending in `.svg .png .jpg .jpeg .gif .webp .ico .css .js .woff/woff2 .webmanifest` (standard Next.js boilerplate; only `webmanifest` is new this change). A hypothetical route ending in `.js`/`.css` would skip middleware. **No such data route exists** (all data routes are `/`, `/stats`, `/api/export`, and the Server Actions POSTed to `/`, none of which end in those suffixes — confirmed by matcher simulation), and every data-bearing boundary independently calls `getInvitedUser()` before any DB access, so even a bypassed first gate leaks nothing. No action required; recorded because the pattern's safety depends on the boundary-level re-checks continuing to exist.

### FR-2 — Content-Security-Policy is minimal (Informational / Low, pre-existing, out of scope)
The app sets `Content-Security-Policy: frame-ancestors 'none'` plus X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy (verified live), but no `script-src`/`style-src` directive. This is a pre-existing posture, deliberately narrow per `next.config.ts`, and **not introduced or worsened by this change** — the additive UI adds no inline event-handler scripts, no `dangerouslySetInnerHTML`, and no new external origins (fonts are self-hosted via `next/font`, icons are same-origin static PNGs). Noted only for completeness against the checklist's CSP section.

No Critical, High, or Medium findings.

---

## Checks Performed

| # | Check | Area | Result |
|---|-------|------|--------|
| 1 | `/manifest.webmanifest` un-gated serves ONLY public metadata (name, colors, icon URLs) — no user data | Middleware / manifest | PASS (verified live: JSON body is static app metadata) |
| 2 | Data routes `/`, `/stats`, `/api/export` STILL gated by matcher after the change | Middleware | PASS (matcher regex simulated: all three GATED) |
| 3 | Static asset / auth surfaces (`/icon-*.png`, `/apple-touch-icon.png`, `/login`, `/auth/*`) un-gated as intended, no redirect loop | Middleware | PASS |
| 4 | `updateSession` / `auth.ts` / `decideAccess` / session cookie logic unchanged | Auth | PASS (no change; dev-bypass still keyed on `NODE_ENV!=="production" && unconfigured`) |
| 5 | Page/route/action boundaries independently re-verify `getInvitedUser()` before DB read | Auth (defense in depth) | PASS (`page.tsx`, `stats/page.tsx`, `api/export/route.ts`, `actions.ts` all gate first) |
| 6 | `playwright` written/read via parameterized Drizzle (no string interpolation) | Injection (SQL) | PASS (`.values({playwright: norm.playwright \|\| null})`, `eq()` predicates) |
| 7 | `playwright` React-escaped in the row; IMDb href uses `encodeURIComponent` | Injection (XSS) | PASS (`PersonValue` renders `{name}` as text child; `imdbUrl` encodes) |
| 8 | `playwright` neutralized against CSV/XLSX formula injection like other cells | Injection (CSV/XLSX) | PASS (`playToRow` includes it; `neutralizeCell` applied to every cell in both `toCsv` and `toXlsxBuffer`) |
| 9 | `playwright` filter type allow-listed; no unbounded param | Input validation | PASS (`parseFilter` allow-list incl. `playwright`; `matchesFilter`/`matchesSearch` handle it) |
| 10 | Migration `0001_breezy_vulture.sql` is additive nullable column + index, no data loss | Schema/migration | PASS (`ADD COLUMN "playwright" text` + btree index) |
| 11 | Autocomplete derives only from in-page archive; no new endpoint/round-trip | Data exposure | PASS (`collectFieldValues`/`suggestValues` pure over `plays` prop; only new route is public manifest) |
| 12 | Autocomplete highlight renders escaped (no `dangerouslySetInnerHTML`) | Injection (XSS) | PASS (`highlightFragment` slices original value; rendered via `<mark>`/`<span>` text children) |
| 13 | `sharp` is a devDependency, not a runtime dependency | Dependencies | PASS (in `devDependencies` only; not in `dependencies`) |
| 14 | `sharp` not imported in app runtime / server bundle; only in `scripts/gen-icons.mjs` | Dependencies | PASS (grep of `src/` finds no import; not present in `.next/server` output) |
| 15 | Shipped app serves static PNGs from `public/`; no runtime image processing | Icon pipeline | PASS |
| 16 | `sharp` 0.34.5 — no known-critical advisory applying to build-only use | Dependencies | PASS (current release; used at build only) |
| 17 | `layout.tsx` metadata is static public identity (title, manifest URL, apple-touch-icon, theme color) — no user data | Metadata | PASS |
| 18 | Server-only allowlist (`ALLOWED_EMAILS`, no `NEXT_PUBLIC_`) not reachable client-side | Env vars | PASS (`auth.ts` server-only; unchanged) |
| 19 | `.env`, `.env*.local`, `.env*` in `.gitignore` | Env vars | PASS |
| 20 | Baseline security headers present (CSP frame-ancestors, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | Headers | PASS (verified live on manifest response) |
| 21 | Export route rejects unknown `format` (400) and unauthenticated callers (401, not redirect) | API route | PASS (unchanged; playwright rides the existing pipeline) |
| 22 | No new API/data endpoints introduced (only the public `manifest.ts` route) | Attack surface | PASS |

---

### Verdict

**PASSED WITH NOTES** — two informational/low notes (broad-but-safe middleware extension exclusion resting on defense-in-depth; pre-existing minimal CSP), neither introduced as a defect by this change and neither blocking. No Critical/High findings. Cleared for deploy.
