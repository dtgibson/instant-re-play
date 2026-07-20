# Schema — Theatregoing Stats

## Path

**Incremental — no new persistence.** Stats are **read-only aggregations** over
the two tables the Play Log already owns (`plays`, `play_actors`). This feature
adds **no new table, column, index, or constraint**, and requires **no
migration**. Nothing about the data model, entry flow, or list behaviour
changes (PRD "Out of Scope", QA-23). The only new artefacts are a pure
aggregation module, a Server Component route, and a small additive integration
that lets the log seed its existing filter from a URL param — the database is
untouched.

> **Migration status: NONE.** `drizzle/0000_init.sql` remains the whole schema.
> `npm run db:generate` should produce **no** new migration for this feature; if
> it does, something has drifted and the diff must be rejected (QA-23).

## Overview

The stats view reads the **entire** archive — every `plays` row with its
ordered `play_actors` — and derives a small, curated set of figures from it on
every request: five headline tiles (total, span of years, distinct venues /
directors / actors), a plays-per-year strip, three top-five "most seen" lists,
and an undated-entries caveat. Nothing is precomputed or stored; the figures are
recomputed live on each load, so they stay true as the log grows (FR-03).

Because the shape the aggregation needs is exactly what `listPlays(db)` already
returns — `Play[]` with each play's actors in order and NULLs surfaced as `""` —
this feature **reuses the existing repository read** rather than adding queries,
and derives every figure in **one pure module** (`src/lib/stats.ts`). That is
the single most important architectural decision, and it is driven by a hard
requirement: **every displayed count must exactly equal what the correspondingly
filtered Play Log would show** (FR-04, NFR-05, QA-04). The only way to guarantee
that byte-for-byte is to aggregate over the **same** `Play[]` objects using the
**same** exact-match semantics (`matchesFilter` in `src/lib/query.ts`) that the
log already filters by — see the decision below.

## No Schema Change — Why

| Question | Answer |
|---|---|
| New tables? | No. |
| New columns? | No. |
| New indexes? | No — `listPlays` reads the full archive; the existing `plays_date_seen_idx` already serves its order. At ≤1,000 plays no aggregate index is warranted (NFR-03). |
| New constraints? | No. |
| Precomputed / stored aggregate? | No — explicitly out of scope. Every figure is recomputed on read (FR-03). |
| Data migration / backfill? | No. |
| Destructive steps? | No — stats never write. The view is strictly read-only (FR-16, QA-16); it issues only the `SELECT`s `listPlays` already runs. |

The `play_actors` child-table design pays off again here: distinct-actor counts
and the most-seen-actors list are a plain union/tally over each play's ordered,
already-deduplicated `actors: string[]` — no array-column unnesting, no join to
write.

## Aggregation Approach — Decision

**Chosen: compute every figure in a pure, unit-testable module
(`src/lib/stats.ts`) from the existing `listPlays(db)` result.** Not dedicated
Drizzle `GROUP BY` queries.

**Why (this is a correctness decision, not just a convenience one):**

- **One source of truth ⇒ counts that provably match the log (NFR-05, QA-04).**
  The log filters in memory over `Play[]` with `matchesFilter`: exact,
  case-sensitive equality (`play.venue === value`, `play.director === value`,
  `play.actors.includes(value)`). If stats counted via SQL `GROUP BY` instead,
  the two paths could silently diverge — Postgres collation/`GROUP BY` folding,
  `NULL`-vs-`""` handling, `date_trunc`/`EXTRACT(YEAR ...)` semantics, and
  string equality would each have to be kept *exactly* consistent with the
  in-memory comparator by hand. Aggregating over the very same `Play[]` with the
  very same helpers makes "a click-through from a count never finds a different
  number of entries" (NFR-05) true **by construction**, not by vigilance.
- **Blank handling is already normalized in the domain object.** `rowToPlay`
  maps `NULL` date/venue/director to `""`, so "blank" is uniformly `value === ""`
  and a play with no venue is simply not counted — no `WHERE venue IS NOT NULL`,
  no `NULL`-vs-empty-string special case that a SQL path would need (FR-05,
  FR-11).
- **Single source of truth across three features.** The log, Export, and now
  Stats all read through `listPlays` → `Play[]`. Aggregation logic lives in one
  pure function with no DB or HTTP dependency, unit-testable in isolation with
  Vitest — mirroring the established `src/lib/export.ts` precedent (pure helpers
  in `src/lib`, thin route/page adapters).
- **Performance is a non-issue at this scale (NFR-03, QA-21).** `computeStats`
  is a single O(n) pass over ≤1,000 plays building a few `Map`s — imperceptible.
  The read is the same two-statement `listPlays` the log already performs on
  every load; stats add **no** extra DB round trips.

**Alternative considered and rejected for v1: dedicated Drizzle aggregate
queries** (`COUNT(*) … GROUP BY venue`; `GROUP BY director`; a `play_actors`
tally joined to `plays`; `GROUP BY EXTRACT(YEAR FROM date_seen)`; `MIN/MAX`
year; distinct counts). This is the textbook approach and would push the tally
into Postgres — but at ≤1,000 rows it buys no measurable speed, adds a **second**
aggregation path that must be kept perfectly consistent with the log's
exact-match comparator (the exact risk NFR-05 forbids), and needs careful
`NULLS`/collation/year-extraction handling to match the domain object. It is the
wrong trade here: correctness-as-trust and one-source-of-truth outweigh a
theoretical efficiency gain the scale doesn't need. (Should the archive ever
grow orders of magnitude beyond the 1,000-play ceiling, revisit — but that is
explicitly out of the product's scope.)

## The Read (reuse `listPlays`, add no query)

`src/app/stats/page.tsx` calls `listPlays(db)` **verbatim** — the same read the
log page uses. It issues the two statements `listPlays` already owns and stitches
them in memory into `Play[]` (default order is irrelevant to aggregation, which
is order-independent):

```sql
-- every play:
SELECT id, name, date_seen, venue, director, created_at, updated_at
FROM   plays
ORDER  BY date_seen DESC NULLS LAST, created_at DESC;

-- every actor, grouped by play in stored position order:
SELECT id, play_id, name, position
FROM   play_actors
ORDER  BY play_id, position;
```

Each play arrives as the domain object, with blanks already `""`:

```ts
interface Play { id; name; date /* "YYYY-MM-DD" | "" */; venue; director; actors: string[] }
```

No new repository function is required.

## The Aggregation Module (`src/lib/stats.ts`, pure, unit-tested)

A single pure function `computeStats(plays: Play[]): Stats` — no DB, no HTTP, no
React — returning a fully-derived, render-ready shape. Proposed types:

```ts
export interface RankedValue { value: string; count: number } // count desc, then value asc
export interface YearCount   { year: number;  count: number } // newest year first

export interface Stats {
  total: number;                              // FR-05a
  span: { from: number; to: number } | null;  // FR-06; null when no dated play
  distinctVenues: number;                     // FR-05c
  distinctDirectors: number;                  // FR-05d
  distinctActors: number;                     // FR-05e
  perYear: YearCount[];                        // FR-07; [] when no dated play
  undatedCount: number;                        // FR-15
  topVenues: RankedValue[];                    // FR-09; length 0..5
  topDirectors: RankedValue[];                 // FR-09; length 0..5
  topActors: RankedValue[];                    // FR-09; length 0..5
}
```

### Precise definition of each figure (and how ties, blanks, undated are handled)

Throughout, a play is **dated** iff `play.date !== ""`, and its year is
`Number(play.date.slice(0, 4))` (the stored value is a validated `YYYY-MM-DD`;
guard with `Number.isNaN` defensively, mirroring the masthead trust-stat). All
value keys are the **exact stored strings** — case-sensitive, byte-for-byte — so
"Almeida" and "almeida" are two distinct keys, matching the log's filter
(FR-04, QA-04).

- **total** (FR-05a) — `plays.length`. Every entry counts, dated or not, blank
  fields or not.
- **span** (FR-06, QA-06) — over the *dated* plays' years:
  `from = min(years)`, `to = max(years)`; `null` when zero plays are dated.
  Presentation rule (for the tile): `from === to` → a single year (`"2024"`);
  `from !== to` → an en-dash range (`"2019–2026"`); `null` → a plain "no dates
  recorded yet" statement, never a blank or bogus range.
- **distinctVenues / distinctDirectors** (FR-05c/d) — size of the `Set` of
  **non-blank** exact `venue` / `director` values. `""` is excluded, so a play
  with no venue does not contribute to the venue count.
- **distinctActors** (FR-05e) — size of the `Set` formed by unioning every
  play's `actors`. Actor names are already trimmed, non-blank, and per-entry
  deduplicated on write; a defensive `if (name)` guard is cheap but not needed
  for data written through the app.
- **perYear** (FR-07, FR-08, QA-07/08) — a `Map<year, count>` over **dated**
  plays only (each dated play adds 1 to its year), emitted as an array **sorted
  by year descending** (newest at top). Only years with ≥1 dated play appear —
  **no zero-filled gap years**. `[]` when no play is dated → the view shows the
  plain "no year breakdown yet" statement (FR-08), never an empty/zero-height
  strip. The proportional bar length a row renders is `count / maxYearCount`
  (relative to the busiest single year); the **count is always shown as text**
  so nothing is conveyed by bar length alone (NFR-02).
- **undatedCount** (FR-15, QA-15) — number of plays with `play.date === ""`.
  Surfaced as an explicit, plainly-worded caveat **only when `> 0`**; omitted
  entirely (never shown as "0 undated") when every play is dated.
- **topVenues / topDirectors** (FR-09/10/11, QA-09/10) — tally occurrences of
  each **non-blank** exact `venue` / `director` (one play adds 1 to its value),
  then rank **count descending, then `value` ascending** as the tiebreak
  (`a.value.localeCompare(b.value, "en")`), then `slice(0, 5)`. Fewer than five
  qualifying values → fewer rows (never padded). A **hard cut at five** by this
  deterministic order — boundary ties beyond the fifth slot are dropped, the
  list is not expanded to include them (PRD Open Questions, FR-10). Equal counts
  are returned adjacent in name order and display the same number, with no
  ordering implied between them (the Designer must not add a rank visual that
  distinguishes ties — QA-10).
- **topActors** (FR-09/11, QA-11) — same tally/rank/slice, counting each actor
  name once per play (guaranteed by the per-entry dedupe: for each play, for each
  `name` in `play.actors`, increment). **Undated plays still count** toward
  most-seen — these lists are not time-scoped (FR-11).
- **Empty most-seen list** (FR-12, QA-12) — when a category has zero qualifying
  (non-blank) values, its `top*` array is `[]`; the view renders a plain "not
  enough logged yet" line, not an empty list.

### Empty archive (FR-17, QA-17)

`computeStats([])` returns a well-formed zero shape (`total: 0`, `span: null`,
distinct counts `0`, `perYear: []`, `undatedCount: 0`, all `top*: []`). The
**page** branches on `stats.total === 0` to render the warm, designed empty-state
invitation (with a route back to the log to add the first play) instead of tiles,
strip, and lists. The module stays pure; the empty state is a rendering concern.
With ≥1 play the full view renders and each section degrades via its own rule
above — span, year strip, and each most-seen list — so a one-play or all-undated
archive states its true small numbers and fabricates no trend (FR-18, QA-18).

## Rendering the View (`src/app/stats/page.tsx`)

A **Server Component** page, dynamic on every request exactly like the log page
and export route, so figures always reflect current data (FR-03, QA-03):

```ts
export const dynamic = "force-dynamic"; // recompute live; keep PGlite out of the build

export default async function StatsPage() {
  const db = await getDb();
  const plays = await listPlays(db);   // same single source of truth as log + export
  const stats = computeStats(plays);   // pure derivation
  return /* tiles + year strip + most-seen lists, or the empty state */;
}
```

The view is static, server-rendered markup (tiles, static bars, lists, links)
built from the existing design tokens and typography — floating planes on warm
shadow, restrained bars, aloe reserved for "Log a play" (NFR-04). It needs **no
client JS** except any optional entrance motion, which — if the Designer adds it
— goes in a small `"use client"` wrapper that honours `prefers-reduced-motion`
(the design system's motion rule); it is not required by the data layer. The
page carries the quiet non-accent nav both ways: a "Stats" link seated in the
log's action cluster to the left of Export (FR-01) and a "Back to the log" link
on `/stats` (FR-02) — placement fixed, exact wording the Designer's.

## Click-through to the Filtered Log (FR-13/FR-14)

Each most-seen item is a link into the log **pre-seeded** with the log's
**existing** single filter — no new filtering mechanism, the same `ActiveFilter`
shape and exact-match `matchesFilter` already in place.

**URL contract (Architect's to finalise — chosen):** two query params on the log
route, `/?filter=<type>&value=<exact-value>`, where `<type>` ∈ `{venue,
director, actor}` (the `FilterType` union) and `<value>` is the URL-encoded exact
stored string. A tiny pure helper in `src/lib/query.ts`:

```ts
export function filterHref(type: FilterType, value: string): string {
  return `/?filter=${type}&value=${encodeURIComponent(value)}`;
}
export function parseFilter(params: {
  filter?: string; value?: string;
}): ActiveFilter | null {
  const { filter, value } = params;
  if ((filter === "venue" || filter === "director" || filter === "actor") && value)
    return { type: filter, value };
  return null; // absent or malformed → unfiltered, exactly as today
}
```

*Why two explicit params over `?venue=…`:* the type lives in one place with a
trivial allow-list validation, there is no ambiguity if a stray key appears, and
`parseFilter` is a two-line pure function that is easy to unit-test against the
malformed cases FR-14/QA-14 require.

**Seeding (minimal, additive):** the **server** page `src/app/page.tsx` reads
the route's `searchParams` (awaiting it — Next 15 App Router), runs
`parseFilter`, and passes the result to the client component as a new optional
prop:

```ts
export default async function Home({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialFilter = parseFilter({
    filter: typeof sp.filter === "string" ? sp.filter : undefined,
    value:  typeof sp.value  === "string" ? sp.value  : undefined,
  });
  const plays = await listPlays(await getDb());
  return <PlayLog initialPlays={plays} initialFilter={initialFilter} />;
}
```

`PlayLog` seeds its existing state from it —
`useState<ActiveFilter | null>(initialFilter ?? null)` — changing one line
(`src/components/play-log.tsx`, currently `useState<ActiveFilter | null>(null)`).
Everything downstream is unchanged: the active-filter banner names the field and
value (FR-13), `matchesFilter` applies the exact, case-sensitive match, and the
existing "Clear filter" control restores the full log. An absent or malformed
param yields `null` and the log loads unfiltered exactly as before (FR-14,
QA-14). Reading `searchParams` keeps the log dynamic, which it already is
(`force-dynamic`) — no behavioural change for the un-parameterised case.

Note: a linked value that happens to match **zero** plays would simply show the
log's existing no-results state — honest and consistent. In practice the
most-seen lists only ever link values that exist in the archive, so this is a
defensive edge, not a normal path; `parseFilter` deliberately does **not**
validate the value against the archive (exact-match semantics mean the value is
taken as-is).

## New Artefacts (none in the data layer)

| Artefact | Kind | DB impact |
|---|---|---|
| `src/lib/stats.ts` | Pure `computeStats(plays)` + `Stats`/`RankedValue`/`YearCount` types (unit-tested) | None. |
| `src/app/stats/page.tsx` | Server Component route (`force-dynamic`) | Read-only via `listPlays`. |
| `src/lib/query.ts` (edit) | Add pure `filterHref` + `parseFilter` helpers (unit-testable) | None. |
| `src/app/page.tsx` (edit) | Read `searchParams`, pass `initialFilter` | None (same `listPlays` read). |
| `src/components/play-log.tsx` (edit) | Accept `initialFilter` prop; seed the existing filter state | None. |
| Stats view components / nav links | Presentation (Designer/Builder) | None. |

No new dependency. No `package.json` change. No migration.

## Design Decisions

- **Aggregate in one pure module over `listPlays`, not in SQL.** The binding
  requirement (NFR-05) is that every count equals the filtered log's count;
  deriving stats from the same `Play[]` with the same exact-match helpers makes
  that true by construction and keeps a single source of truth across log,
  export, and stats. SQL `GROUP BY` would add a second path to keep consistent
  for no benefit at ≤1,000 plays.
- **No schema change is the correct answer, stated loudly.** Stats are pure
  read-only derivation; the `play_actors` child table already gives distinct- and
  top-actor tallies for free. `npm run db:generate` producing a migration is a
  signal of drift, not progress (QA-23).
- **Blank/undated honesty is mechanical, not special-cased.** Because the domain
  object surfaces NULLs as `""`, "not counted" is just `value === ""`, and
  "undated" is `date === ""` — the FR-05/FR-11/FR-15 rules fall out of one
  comparison each, with no NULL plumbing.
- **Deterministic ordering lives in the module.** Count-desc then
  locale-name-asc, hard-cut at five, ties returned adjacent and equal — so the
  view never has to invent ranking logic and ties can't be rendered as an
  ordering (FR-10).
- **The view is a dynamic Server Component, mirroring the log.** Live recompute
  on read is the whole point of "updated as the database gets bigger"; reusing
  `force-dynamic` + `listPlays` keeps the embedded PGlite database out of the
  build and the read path identical to the log's.
- **Click-through reuses the existing filter, seeded by a URL param.** The only
  new integration is `parseFilter`/`filterHref` + one seeded `useState`; the
  `ActiveFilter` shape, exact-match comparator, banner, and clear control are all
  unchanged, so the connection the archive is built around is delivered with the
  smallest possible surface (FR-13/FR-14).

## Assumptions

- One deployment = one user; stats reflect the archive at request time with no
  isolation/locking concern beyond the single writer.
- ≤1,000 plays with typical casts (NFR-03) — a single in-memory O(n) pass is
  comfortably imperceptible on both PGlite (local) and Neon (production); no
  aggregate index, materialization, or caching is warranted in v1.
- "Exact match" is byte-for-byte equality on stored (trimmed) text including
  case — the same definition the log and its filter already use, so every stat
  key and every click-through resolves to precisely the log's filtered set.
- Stored `date_seen` is a validated `YYYY-MM-DD`, so `slice(0, 4)` yields the
  year; the `Number.isNaN` guard is defensive against any legacy/edge value.
