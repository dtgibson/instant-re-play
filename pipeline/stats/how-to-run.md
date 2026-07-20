# How to run — Theatregoing Stats

The stats view is a live, read-only reflection of your archive at `/stats`. It
adds no schema and no migration; every figure is recomputed from the existing
`listPlays()` read on each load.

## Run it

```bash
npm install
npm run seed     # optional: load ~14 sample plays so the view has data to show
npm run dev      # http://localhost:3000
```

Then open **http://localhost:3000/stats** (or click the quiet **Stats** link in
the log's action cluster, seated to the left of Export).

## What to expect

- **Header** — the masthead shell with a dotted "Back to the log" link and the
  title "The shape of your theatregoing".
- **Five headline tiles** — total plays (lead cantilever), years spanned
  (e.g. `2019–2026`, en dash), and distinct venues / directors / actors. Blank
  fields never contribute to a distinct count.
- **Plays per year** — one static wooden bar per year that has at least one
  dated play, newest at top, each bar proportional to your busiest year with the
  count written out as text. A caption names how many undated plays are excluded
  (shown only when there are any).
- **Three "most seen" lists** — venues, directors, actors, top five each,
  ordered count-desc then name-asc (ties shown equal, hard cut at five).

Edge states degrade honestly: with **zero plays** you get a warm invitation
("Nothing to count yet") instead of empty tiles; with **no dated plays** the year
section states there is no breakdown yet; a **most-seen category with nothing
logged** shows "Not enough logged yet." rather than an empty list.

## Click through to the filtered log

Each most-seen name is a keyboard-operable link to
`/?filter=<type>&value=<exact value>` (`type` ∈ `venue | director | actor`).
Clicking, say, **Almeida Theatre** lands on the log pre-filtered to exactly those
entries: the active-filter banner reads "Showing plays at Almeida Theatre" and
the existing **Clear filter** control restores the full log. The match is exact
and case-sensitive, so a most-seen count always equals the number of entries the
filtered log shows. An absent or malformed query param loads the log unfiltered,
exactly as before.

## Verify

```bash
npx tsc --noEmit          # 0 errors
npm run build             # succeeds; /stats present as a route
npm run test              # vitest: stats + filterHref/parseFilter + all existing suites
npm run smoke:stats       # end-to-end: seed → computeStats → assert exact figures
npm run db:generate       # "No schema changes, nothing to migrate" (QA-23)
~/.weft/bin/weft-design-lint check src/app src/components src/app/globals.css
```

## Conventions established (for The Chronicler)

- **One pure aggregation module.** `src/lib/stats.ts` (`computeStats(plays)`)
  derives every figure from the same `Play[]` the log and export read, using the
  same exact, case-sensitive keys the log filters by — mirroring the pure-helper
  precedent of `src/lib/export.ts`. No SQL `GROUP BY`, no second aggregation path.
- **URL filter contract.** `filterHref(type, value)` and `parseFilter(params)`
  in `src/lib/query.ts` are the additive click-through: the log seeds its
  existing single `ActiveFilter` from `/?filter=&value=` on load. No second
  filter mechanism was introduced.
- **Three reusable presentation patterns** now live in the design system (via
  new `globals.css` classes, no new tokens): the **headline stat tile**, the
  **static proportional bar strip** (teak/walnut fill on a recessed track, no
  charting library), and the **top-N most-seen list** (reusing the log's dotted
  "sill" filter affordance and the square "plan" glyph for venues).
- **Copy is em-dash-free** in all user-facing stats strings (en dashes in year
  ranges are fine); aloe stays reserved for "Log a play".
