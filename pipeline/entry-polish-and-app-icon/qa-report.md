# QA Report — Entry Polish & App Icon

- **Date:** 2026-07-19
- **Feature:** entry-polish-and-app-icon (Improve lane, Stage 4 — The Tester)
- **Test Runner:** vitest 4.1.10 (Node), plus live checks against the running dev
  server at http://127.0.0.1:3939/ (dev-bypass mode, reseeded archive with playwrights)
- **Result:** PASSED

Three additive polish items verified working with **no regression** to the shipped
Play Log: (1) the new optional `playwright` field, (2) self-sourced entry
autocomplete, (3) the home-screen app icon + web manifest.

---

## Test Suite Results

### Unit / integration (`npm run test` — vitest)
```
Test Files  7 passed (7)
     Tests  104 passed (104)
```
No regression across any suite:

| Suite | File | Status |
|---|---|---|
| play (normalize/format/imdb) | tests/play.test.ts | pass |
| query (filter/search/sort) | tests/query.test.ts | pass |
| repository | tests/repository.test.ts | pass |
| export (CSV/XLSX) | tests/export.test.ts | pass |
| stats | tests/stats.test.ts | pass |
| auth (invite allowlist) | tests/auth.test.ts | pass |
| suggest (autocomplete logic) | tests/suggest.test.ts | pass (13 cases: distinct, prefix-first, substring, never-invent/unseen) |

### Typecheck & build
- `npx tsc --noEmit` → **0 errors** (exit 0).
- `npm run build` → **success** (Next.js 16.2.10 / Turbopack, compiled in 3.0s).
  Route table lists `○ /manifest.webmanifest` (prerendered static) — **manifest present**.

### Schema drift
- `npm run db:generate` → **"No schema changes, nothing to migrate"**. Migration
  `0001_breezy_vulture.sql` already captures the additive `playwright` column
  (`ALTER TABLE "plays" ADD COLUMN "playwright" text` + `plays_playwright_idx`
  btree index). Journal has exactly two entries (0000_init, 0001). No uncommitted drift.

### Smoke scripts (all present, all pass)
| Script | Assertions | Result |
|---|---|---|
| smoke:playwright | 14 | PASS |
| smoke | 40 | PASS |
| smoke:export | 27 | PASS |
| smoke:stats | 18 | PASS |

---

## Verification of "What done looks like" (change-brief)

**1. Self-sourced autocomplete on venue/director/actor/playwright.**
- `collectFieldValues` (src/lib/suggest.ts) returns distinct, non-blank prior values;
  `suggestValues` ranks prefix-first then substring (case-insensitive), capped at 6.
- The drawer (src/components/play-drawer.tsx) derives options for all four fields from
  the **full loaded archive** (`plays` from PlayLog state), not the filtered set —
  suggestions are available even while the log is filtered.
- Selecting fills the exact stored text; an **unmatched fragment yields no plane** and
  the typed value saves as-is (verified in suggest tests + smoke:playwright
  "unseen fragment returns nothing… no auto-correct"). Never forces an unseen value. ✔

**2. Playwright field — saved, shown, filtered, searched, exported.**
- Schema: one nullable `text` column + exact-match index (additive migration). ✔
- List row: rendered under a **"Written by"** band as a `PersonValue` consistent with
  Director — dotted click-to-filter value + boxed IMDb name-search link
  (`rel="noopener noreferrer"`). Live page shows 14 "Written by" bands and IMDb
  `find/?q=…&s=nm` links. ✔
- Filter: live `GET /?filter=playwright&value=Tennessee%20Williams` renders exactly
  **1 entry** (A Streetcar Named Desire); `filter=director&value=Sam Mendes` renders 3
  (unchanged from prior contract). ✔
- Search: free-text reaches the playwright (smoke:playwright "search 'tennessee'…"). ✔
- Export: live CSV header is `Name,Date seen,Venue,Playwright,Director,Cast` —
  Playwright sits **between Venue and Director**; XLSX exports as genuine OOXML
  (Microsoft Excel 2007+). ✔

**3. Existing plays render unchanged with playwright blank.**
- Migration is purely additive (nullable column, no backfill). smoke:playwright MIGRATE
  step creates a pre-existing row without a playwright, applies 0001, and confirms it
  **reads back blank**. Blank playwright is omitted from the row (no placeholder). ✔

**4. Add-to-Home-Screen identity.**
- `/manifest.webmanifest`: HTTP 200, `content-type: application/manifest+json`, valid
  JSON — `name: "Instant Re-Play"`, `short_name: "Re-Play"`, `display: "standalone"`,
  `start_url: "/"`, `background_color #F3EAD8`, `theme_color #E9DAC0`, 3 icons including
  a `maskable` 512. Served un-gated (200 without auth). ✔
- Icons all HTTP 200, `image/png`, real rasters: `apple-touch-icon.png` 180×180,
  `icon-192.png` 192×192, `icon-512.png` 512×512, `icon-maskable-512.png` 512×512. ✔
- `layout.tsx`: `appleWebApp.title "Instant Re-Play"`, `apple-touch-icon` link,
  `manifest` link, `applicationName`, `themeColor #E9DAC0`. ✔

**5. Stats view unchanged (no most-seen-playwrights aggregate).**
- Live `/stats` HTTP 200, shows Venues/Directors/Most seen; **0** "Playwright" mentions —
  no new aggregate this batch, as specified. smoke:stats 18/18 pass. ✔

---

## Edge cases exercised

- **Pre-existing playwright-less row** survives the additive migration and reads blank
  (smoke:playwright MIGRATE).
- **Autocomplete never invents / never auto-corrects:** unseen fragment → empty plane →
  value saved verbatim; already-fully-typed value dropped from suggestions
  (suggest tests + smoke).
- **Exact-match filter is case-sensitive:** a case variant of a playwright matches
  nothing (smoke:playwright), consistent with venue/director/actor semantics.
- **Playwright trimmed on write** and replaced correctly on edit (smoke:playwright).
- **Export blank playwright → empty cell**, values with commas/quotes/formulas still
  quoted/neutralized (smoke:export 27/27).
- **A11y:** autocomplete follows the ARIA combobox/listbox pattern (`role="combobox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="option"`,
  `aria-selected`); open transition removed under `prefers-reduced-motion`.
- **Filtering/search remain client-side over the full archive** — the full play set is
  serialized into the page so autocomplete has every prior value regardless of the
  active filter (confirmed in the filtered-view SSR payload).

## Known limitations (by design, not defects)

- Free-text **search is a client-side text box, not a URL parameter** — `GET /?q=…`
  is not addressable and renders the full log server-side; the search box filters in the
  browser. Search *logic* is covered by query tests + smoke. (Unchanged from prior behaviour.)
- **Playwright exact-match filter/search are case-sensitive** (parity with existing
  person fields); autocomplete is the mitigation for typo fragmentation, as intended.
- No import round-trip and no most-seen-playwrights stat this batch — both explicitly
  deferred in the change brief.
- iOS "Add to Home Screen" itself can only be exercised on a real device; verified here
  via the served manifest, icon assets, and `layout.tsx` meta (the machine-checkable surface).

---

**Conclusion:** All done-criteria met; all 104 unit tests, all 4 smoke scripts, typecheck,
build, and live checks pass; no schema drift; no regression to log / sort / search /
filter / export / stats / auth. **PASSED.**
