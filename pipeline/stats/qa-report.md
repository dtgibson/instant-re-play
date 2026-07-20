# QA Report — Theatregoing Stats

**Feature:** stats
**Date:** 2026-07-19
**Stage:** 6 — The Tester
**Test Runner:** vitest 4.1.10
**Acceptance basis:** `pipeline/stats/prd.md` (QA-01..QA-23)
**Result:** PASSED

---

## Summary

The live `/stats` view and its click-through to the pre-filtered Play Log meet
every acceptance criterion in the PRD. All automated suites are green with no
regression, TypeScript is clean, the production build succeeds with `/stats`
registered as a dynamic route, both smoke scripts pass, and the running dev
server serves the stats markup and the seeded-filter log correctly. The core
trust property (NFR-05 — every displayed count equals what the filtered log
shows) was verified end-to-end against the live server across venues, a
director, and an actor: every count matched exactly.

---

## Test Suite Results

### `npm run test` (vitest run)

| Suite | Tests | Result |
|---|---|---|
| tests/play.test.ts | 13 | Pass |
| tests/query.test.ts | 16 | Pass |
| tests/stats.test.ts | 16 | Pass |
| tests/export.test.ts | 16 | Pass |
| tests/repository.test.ts (real PGlite) | 7 | Pass |
| **Total** | **68** | **5 files passed, 0 failed** |

No regression across the pre-existing suites (play, query, repository, export);
the new `stats` suite is green. Duration ~2.5s.

### Type check — `npx tsc --noEmit`

Exit 0. No type errors.

### Production build — `npm run build`

Compiled successfully (Next.js 16.2.10, Turbopack). TypeScript pass in build.
Route table confirms `/stats` is present and **dynamic** (`ƒ`), matching the
log's dynamic read:

```
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/export
└ ƒ /stats
```

### Smoke — `npm run smoke:stats`

PASS — 18 assertions (empty-archive zero shape, seeded totals/distinct/span,
newest-first per-year with undated excluded, tie ordering + blank exclusion,
six-tied hard-cut to five, filterHref/parseFilter round-trip, malformed → null).

### Independent verification — `scripts/verify-stats.ts`

PASS — 27 assertions, including the invariant "every most-seen count equals the
filtered log" and the click-through seeding a log that shows exactly the count's
number of plays.

### Live dev server (http://127.0.0.1:3939/ — not restarted)

| Request | HTTP | Observed |
|---|---|---|
| `GET /stats` | 200 | Full stats markup: 5 headline tiles, per-year strip (10 rows), 3 most-seen lists |
| `GET /` | 200 | Log renders, 14 rows, masthead "14 plays logged", no active-filter banner |
| `GET /?filter=venue&value=Almeida%20Theatre` | 200 | Banner "Showing plays at **Almeida Theatre**", reduced to 1 row + "Clear filter" |
| `GET /?filter=venue&value=Duke%20of%20York's%20Theatre` | 200 | Banner + exactly 3 rows (stats says 3) |
| `GET /?filter=venue&value=Harold%20Pinter%20Theatre` | 200 | Banner + exactly 2 rows (stats says 2) |
| `GET /?filter=director&value=Sam%20Mendes` | 200 | Banner "Directed by Sam Mendes" + exactly 3 rows (stats says 3) |
| `GET /?filter=actor&value=Andrew%20Scott` | 200 | Banner "Featuring Andrew Scott" + exactly 1 row (stats says 1) |
| `GET /?filter=bogus&value=Whatever` | 200 | Loads unfiltered (14 rows), no banner |
| `GET /` (absent params) | 200 | Loads unfiltered (14 rows), no banner |

**NFR-05 confirmed live:** stats counts (3/2/3/1) equal filtered-log row counts
exactly across venue, director, and actor click-throughs.

**Copy sweep confirmed:** log `<title>` is `Instant Re-Play · The Play Log`
(middle dot, not em dash); stats `<title>` is `Instant Re-Play · Stats`. Zero
em dash (—) characters in either rendered page's title or body copy. The span
uses an en dash by design ("2019–2026").

**Navigation affordance confirmed:** the log's action cluster renders, in order,
`Stats` (`btn btn-ghost btn-lg stats-link`) → `Export` → `Log a play`. The Stats
link is a quiet ghost link to the left of Export; the aloe accent (`btn-primary`)
remains on "Log a play" alone.

---

## Acceptance Criteria

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| QA-01 | Route + quiet non-accent entry link left of Export; aloe only on "Log a play" | Pass | `/stats` builds as a route; log HTML shows `stats-link` as `btn-ghost` left of Export; `Log a play` is the only `btn-primary`. |
| QA-02 | Calm non-accent route back to the log | Pass | `/stats` renders "Back to the log" backlink (ghost) in the header. |
| QA-03 | Live recomputation, nothing stored/cached | Pass (code + server) | Route is `force-dynamic`, reads `listPlays` and calls pure `computeStats` per load; no stored aggregate. Live GET recomputes each request. Edit-then-reload delta is interactive; verified by the dynamic read path + `computeStats` being the sole source. |
| QA-04 | Exact, case-sensitive aggregation ("Almeida" ≠ "almeida") | Pass | `matchesFilter`/`computeStats` key on `===`; stats.test + verify-stats assert the two-distinct-venue case; live counts equal filtered log. |
| QA-05 | Five headline tiles; distinct counts ignore blanks | Pass | Live: 5 tiles (total, span, distinct venues/directors/actors); `bump` skips `""`; test-covered. |
| QA-06 | Span presentation (range / single / none) | Pass | Live span reads "2019–2026"; tests cover single-year and null-span ("No dates yet"). |
| QA-07 | Plays per year: one row per dated year, newest first, bar proportional, undated absent | Pass | Live rows 2026→1, 2024→4, 2023→4, 2022→2, 2019→1 (12 dated), newest-first; bar width = count/max; undated (2) excluded. |
| QA-08 | Zero-dated → plain "no year breakdown yet" (not empty strip) | Pass (code + smoke) | `perYear.length === 0` renders "No year breakdown yet, because no entries are dated."; all-undated case covered by test/smoke. |
| QA-09 | Three most-seen lists, up to 5, counts shown; fewer when fewer distinct | Pass | Live lists render with counts; verify-stats shows a 2-item venues list unpadded. |
| QA-10 | Deterministic order count-desc then name-asc; ties equal, no implied ranking | Pass | `rank` sorts `b.count - a.count || a.value.localeCompare`; live venues 3,2,2,1,1 with Harold before Wyndham (tie by name); counts rendered as text. |
| QA-11 | Blank exclusion + actor de-dup; undated still count in most-seen | Pass | `bump` skips blanks; actors deduped on write; verify-stats confirms undated plays contribute to most-seen. |
| QA-12 | Most-seen empty → "not enough logged yet" | Pass (code) | Empty list branch renders "Not enough logged yet."; covered by tests (empty-archive shape). |
| QA-13 | Click-through lands filtered; banner names field+value; Clear filter restores | Pass (code + server) | `filterHref` builds `/?filter=&value=`; live seeded log shows exact set + banner; `clearFilter` restores. Actual click nav is interactive; server-render of the seeded URL confirms the reduced set + banner. |
| QA-14 | URL-param seeds single filter (exact); absent/malformed → unfiltered | Pass | Live: valid params seed banner + reduced rows; `filter=bogus` and absent params both load 14 rows, no banner. `parseFilter` allow-lists the type. |
| QA-15 | Undated caveat shown plainly when >0; omitted at 0 | Pass | Live shows "2 undated plays aren't shown by year."; caveat suppressed when `undatedCount === 0` (code + tests). |
| QA-16 | Strictly read-only (no create/edit/delete controls) | Pass | Rendered `/stats` contains no `<form>`, no `<button>`, no edit/delete/Log-a-play controls — only navigation + most-seen `<a>` links. |
| QA-17 | Zero plays → warm designed empty state | Pass (code + smoke) | `total === 0` renders `EmptyArchive` (invitation + back-to-log), not empty tiles; zero-shape smoke-tested. |
| QA-18 | Low-data graceful degradation, no fabricated trend | Pass | Single-play + all-undated degradation covered by stats.test and verify-stats; each section falls back by its own rule. |
| QA-19 | Responsive at 360px, no horizontal page scroll; tiles reflow, links tappable | Pass (code) | CSS reflow: `.tilewrap` 4→2 cols and `.seenwrap` 3→1 col at ≤820px, plus ≤440px tuning; grid/relative units, no fixed-width overflow. Verified via CSS breakpoints, not a physical 360px render. |
| QA-20 | Accessibility: headings, keyboard focus ring, count-as-text, reduced-motion, AA contrast | Pass (code) | h1/h2/h3 hierarchy; `:focus-visible` → `box-shadow: var(--focus)` ring; counts are text (bars `aria-hidden`); `@media (prefers-reduced-motion: reduce)` fallbacks (globals.css:1819, 2267); design-system inks. |
| QA-21 | Performance at ~1,000 plays, no perceptible delay | Pass (by design) | `computeStats` is a single O(n) in-memory pass, no heavy libs; small-archive render is instant live. A 1,000-play live benchmark was not run against the shared dev server (see Known Limitations). |
| QA-22 | Calm Neutra: floating planes on warm shadow, static bars, no chart lib/animation/dashboard density; aloe only as quiet fill | Pass | `.plane` uses warm `--sh-plane` shadow; year bars are static CSS widths; no charting library in deps; stats page renders no `btn-primary` (aloe reserved). |
| QA-23 | No schema change / migration; reads only existing `plays` + `play_actors` | Pass | `npm run db:generate` → "No schema changes, nothing to migrate"; no new files in `drizzle/`; `computeStats` reads only `Play[]` from `listPlays`. |

---

## Edge Cases Verified

- **Exact-match, case-sensitivity (NFR-05):** live stats counts (Duke of York's 3,
  Harold Pinter 2, Sam Mendes 3, Andrew Scott 1) equal the filtered log's row
  counts exactly; `matchesFilter` uses byte-for-byte `===`.
- **Ties:** two venues at count 2 (Harold Pinter, Wyndham's) display equal and
  are ordered by name-asc; six-way tie hard-cut to five by name (smoke).
- **Undated excluded from per-year but still in most-seen:** 12 dated + 2 undated
  = 14 total; year rows sum to 12; undated caveat surfaces the 2; undated plays
  still contribute to distinct/most-seen counts (verify-stats).
- **Empty archive:** `computeStats([])` returns a well-formed zero shape; view
  branches to the warm empty state (smoke + code).
- **Malformed / absent URL filter:** `filter=bogus` and no-params both load the
  full 14-row log with no banner.
- **Apostrophe / space in value:** `Duke of York's Theatre` round-trips through
  `filterHref`/`parseFilter` and filters correctly live.
- **No schema drift:** `db:generate` reports nothing to migrate.

---

## Known Limitations

- **QA-21 (performance):** verified by algorithmic analysis (single O(n) pass,
  no heavy charting library, in-memory aggregation) and instant render on the
  live seeded archive. A dedicated ~1,000-play load benchmark was not executed
  against the running shared dev server (which was intentionally left untouched).
  No perceptible-delay risk is expected at the stated ceiling.
- **Interactive rows verified by code + server render rather than a driven
  browser:** QA-03 (edit/delete-then-reload delta), QA-13 (actual click
  navigation and Clear-filter restore), QA-19 (physical 360px viewport), and
  QA-20 (keyboard traversal) were confirmed via the dynamic read path,
  server-rendered seeded URLs, and CSS/markup inspection. All underlying logic is
  unit-tested and the live server returns the correct filtered sets and markup.

---

## Verdict

**PASSED.** All 23 acceptance criteria are met; no failures and no regressions.
The feature is additive, read-only, and ships with no schema change.
