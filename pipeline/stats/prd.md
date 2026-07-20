# PRD — Theatregoing Stats
**Feature:** stats
**Date:** 2026-07-19
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A calm, dedicated stats view at its own route (`/stats`) that reflects the
user's theatregoing back to them, computed live from the current archive on
every load — nothing precomputed or stored, so the numbers stay true as the
log grows. It shows a small, curated set: headline tiles (total plays, the
span of years, and distinct venues / directors / actors seen), a restrained
plays-per-year breakdown, and three "most seen" lists (venues, directors,
actors — top five each). Every "most seen" item is a doorway: clicking it
lands on the Play Log already filtered, exact-match, to that value. Undated
entries and blank fields are handled honestly — excluded from the stats they'd
distort and surfaced as a plain count, never hidden. With zero plays the view
shows a warm, designed invitation rather than empty charts; with only a few
plays it states the small numbers plainly instead of pretending a trend
exists. The presentation is unmistakably Neutra — floating-plane tiles on warm
shadow and simple static bars/lists — never an analytics dashboard, and aloe
stays reserved for "Log a play".

It is purely additive: read-only aggregations over the existing `plays` and
`play_actors` tables, with no schema change and no migration.

---

## User Stories

> **US-01** — As a theatregoer, I want a single calm place that tells me how
> much I've logged — total plays, how many years it spans, and how many
> distinct venues, directors, and actors I've seen — so that I can grasp the
> shape of my theatregoing at a glance instead of scrolling and counting.

> **US-02** — As a theatregoer, I want to see how many plays I logged in each
> year, so that the rhythm of my theatregoing (a busy season, a quiet one)
> becomes visible.

> **US-03** — As a theatregoer, I want to see which venues, directors, and
> actors recur most across my archive, so that the connections the log is built
> around are legible without hunting for them.

> **US-04** — As a theatregoer, I want to click a most-seen venue, director, or
> actor and land in my log already filtered to it, so that a number becomes a
> doorway into the entries behind it.

> **US-05** — As a theatregoer, I want undated entries and blank fields handled
> honestly — excluded where they'd mislead and shown as a plain count — so that
> I trust every number on the page.

> **US-06** — As a theatregoer opening stats before I've logged much, I want a
> warm state that reflects my real (small) numbers or invites my first entry,
> rather than empty charts pretending at data.

> **US-07** — As a theatregoer, I want to reach stats from the log in one quiet
> action and return just as easily, without the accent action ("Log a play")
> ever being crowded.

---

## Functional Requirements

### Location and navigation

> **FR-01** — The app shall provide a dedicated stats view at its own route
> (`/stats`), reachable from the Play Log in a single action via a quiet,
> non-accent affordance (a plain link labelled "Stats", seated in the log's
> action cluster to the left of Export). The aloe accent shall remain reserved
> for the primary "Log a play" action; the stats affordance shall not be
> accent-filled.

> **FR-02** — The stats view shall provide a calm, non-accent route back to the
> Play Log (a plain "Back to the log" link near its heading), so the user can
> return in one action.

### Live recomputation

> **FR-03** — Every figure on the stats view shall be computed live from the
> current archive on each load, with nothing precomputed or stored: the route
> shall render dynamically (mirroring the log's dynamic read), read the full
> archive through the existing `listPlays` read, and derive all figures in a
> single pure aggregation module (one source of truth). Logging, editing, or
> deleting a play and revisiting `/stats` shall reflect the change.

> **FR-04** — All aggregation shall key on the exact stored text, matching the
> Play Log's filter semantics (case-sensitive, byte-for-byte): "Almeida" and
> "almeida" shall count as two distinct values, so that every count equals what
> the correspondingly filtered log would show.

### Headline tiles

> **FR-05** — The view shall present a row of headline stat tiles showing, each
> as its own figure: (a) total plays logged; (b) the span of years; (c)
> distinct venues seen; (d) distinct directors seen; (e) distinct actors seen.
> Distinct counts shall count each exact non-blank value once; blank values
> shall not contribute (a play with no venue does not affect the venue count).

> **FR-06** — The span tile shall show the range from the earliest dated year to
> the most recent dated year (e.g. "2019–2026") when two or more distinct dated
> years exist; shall show the single year when exactly one dated year exists;
> and shall state plainly that no dates are recorded yet when no play has a
> date, rather than showing a blank or a misleading range.

### Plays per year

> **FR-07** — The view shall present a plays-per-year breakdown as a restrained
> horizontal strip: one row per year that has at least one dated play, ordered
> newest year at top, each row showing the year, its play count, and a simple
> proportional bar whose length is relative to the highest single-year count.
> Undated plays shall be excluded from this breakdown.

> **FR-08** — When no play has a date, the plays-per-year section shall not
> render an empty strip; it shall instead state plainly that there is no year
> breakdown yet because no entries are dated.

### Most-seen lists

> **FR-09** — The view shall present three "most seen" lists — venues,
> directors, and actors — each showing up to the top five values by count, with
> each value's count displayed. Fewer than five items shall be shown when fewer
> distinct qualifying values exist.

> **FR-10** — Ordering within each list shall be deterministic: count
> descending, then value name ascending (locale compare) as the tiebreak. Equal
> counts shall be shown as equal (the same count displayed), with no visual that
> implies one tied value outranks another.

> **FR-11** — Most-seen counts shall count each qualifying entry once and shall
> exclude blanks: a play with no venue is not counted toward any venue; a play
> with no director is not counted toward any director; for actors, each play
> contributes each of its actor names at most once. Undated plays shall still
> count toward the most-seen lists (which are not time-scoped).

> **FR-12** — When a most-seen list has no qualifying values (e.g. no venue has
> been recorded on any play), that section shall show a plain "not enough logged
> yet" statement rather than an empty list.

### Click-through to the filtered log

> **FR-13** — Every most-seen item (venue, director, or actor) shall be a link
> that navigates to the Play Log pre-filtered, exact-match, to that value,
> reusing the log's existing single-filter mechanism and its exact,
> case-sensitive matching. Clicking "Almeida — 9" shall land on the log showing
> exactly those nine entries, with the active-filter banner naming the field and
> value, and the log's existing "Clear filter" control working normally.

> **FR-14** — Because the log's active filter is currently in-memory client
> state with no URL entry point, this feature shall add a small, additive
> integration: the log shall accept an initial filter from a URL query parameter
> on load (encoding the filter type — venue, director, or actor — and the exact,
> URL-encoded value) and initialise its single active filter from it, using the
> same `ActiveFilter` shape and exact-match logic already in place. An absent or
> malformed parameter shall load the log unfiltered, exactly as today.

### Honesty and read-only

> **FR-15** — The count of undated entries shall be surfaced on the view as an
> explicit, plainly worded caveat (e.g. "3 entries have no date, so they aren't
> in the year breakdown"), never hidden, so the per-year totals are honest.
> When no entries are undated, the caveat shall be omitted rather than shown as
> "0".

> **FR-16** — The stats view shall be strictly read-only: it shall offer no
> control to create, edit, or delete a play. The only interactions shall be the
> navigation links (FR-01, FR-02) and the most-seen click-throughs (FR-13).

### Empty and low-data states

> **FR-17** — When the archive contains zero plays, the stats view shall show a
> warm, designed empty state that invites logging the first play and offers a
> route back to the log to add it, rather than rendering empty tiles, a blank
> year strip, or empty lists.

> **FR-18** — When the archive contains at least one play, the full view shall
> render the real figures plainly, with each section degrading gracefully via
> its own rule (FR-06 span, FR-08 year strip, FR-12 most-seen sections) so that
> a small or lopsided archive (e.g. one play, or several all-undated plays)
> states its true small numbers and never fabricates a trend, bar, or ranking
> that the data doesn't support.

---

## Non-Functional Requirements

> **NFR-01 — Responsive / mobile:** The stats view shall be fully usable in a
> phone browser at a 360px-wide viewport with no horizontal scrolling of the
> page. Headline tiles shall reflow (e.g. to a stacked or two-column grid), and
> the plays-per-year bars and most-seen lists shall remain legible and their
> links tappable.

> **NFR-02 — Accessibility:** The view shall use a sensible heading hierarchy;
> all links (navigation and most-seen click-throughs) shall be keyboard-operable
> with a visible focus ring; each plays-per-year row and most-seen item shall
> convey its count as text, never by bar length or colour alone; and any
> entrance motion shall have a `prefers-reduced-motion: reduce` fallback. Text
> shall meet AA contrast (using the design system's inks, including the
> dedicated small-caps label ink).

> **NFR-03 — Performance:** Recomputing every figure from the full archive and
> rendering the view shall complete without perceptible delay at up to ~1,000
> plays (the product's realistic ceiling) on both the embedded local database
> and the hosted database.

> **NFR-04 — Calm Neutra presentation (not a dashboard):** The view shall
> inherit the existing design tokens and typography; stat tiles shall be
> floating planes on warm shadow (never nested cards or hard grey shadows); the
> plays-per-year visual shall be a restrained static bar built from existing
> tokens (aloe used only as a quiet quantity fill, if at all); and there shall
> be no heavy charting library, no animated or interactive charts, and no
> dashboard density. The masthead trust-stat is the presentational precedent.

> **NFR-05 — Correctness as trust:** Every displayed count shall exactly equal
> what the correspondingly filtered/sorted Play Log would show for the same
> archive (same exact-match, case-sensitive semantics), so a user who clicks
> through from a count never finds a different number of entries.

---

## Out of Scope

- Any schema change, migration, precomputed or stored aggregate, or new data
  source — stats are read-only aggregations over the existing tables.
- Editing, creating, or deleting data from the stats view (read-only).
- Goals, targets, streaks, or any "you should see more" nudging.
- Date-range filtering, custom queries, or "stats for the currently filtered
  log" — v1 stats always describe the whole archive.
- Exporting or sharing stats (export belongs to the Export feature).
- Heavy charting libraries and animated/interactive charts — restrained static
  bars and lists only.
- Deep per-person or per-venue pages beyond the click-to-filter the most-seen
  lists link into.
- Per-month heatmaps, genre/rating cuts, or any metric over data the model
  doesn't hold (no ratings, genres, run times, etc.).
- Multiple stacked filters on the log; the click-through uses the existing
  single-filter mechanism.

---

## Open Questions

None — all decisions are resolved in this document. Defaults chosen where the
brief left latitude, flagged to the user in the stage hand-back:

- **Stat set is fixed** at: five headline tiles (total, span, distinct venues,
  distinct directors, distinct actors), plays-per-year, and three top-five
  most-seen lists (FR-05, FR-07, FR-09).
- **Top N = 5** for each most-seen list (FR-09).
- **Tie tiebreak = value name ascending**, and a hard cut at five by that
  deterministic order (FR-10) — no expanding the list to include boundary ties.
- **Plays-per-year shows only years that have at least one dated play** (no
  zero-filled gap years), newest at top (FR-07).
- **Undated entries are surfaced as one explicit count** (FR-15); blank
  venue/director/actor values are silently excluded from their stats (FR-05,
  FR-11) rather than bucketed as a fake "Unknown".
- **Span is presented as a year range** (FR-06).
- **Empty state triggers at exactly zero plays** (FR-17); with one or more
  plays the view renders and each section degrades per its own rule (FR-18) —
  no separate numeric "low-data" threshold.
- **Navigation affordance** is a quiet "Stats" link in the log's action cluster
  to the left of Export, with a "Back to the log" link on `/stats` (FR-01,
  FR-02); the masthead trust-stat is unchanged. Exact wording is the Designer's
  to finalise within this placement.
- **Click-through is delivered via a URL query parameter** the log reads on
  load to seed its existing single filter (FR-13, FR-14); exact parameter names
  are the Architect's to finalise.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Route and entry link (FR-01) | `/stats` exists; the Play Log shows a quiet, non-accent "Stats" link (not aloe-filled) in the action cluster left of Export that reaches `/stats` in one action; aloe remains only on "Log a play". |
| QA-02 | Route back (FR-02) | `/stats` shows a calm non-accent link that returns to the Play Log in one action. |
| QA-03 | Live recomputation (FR-03) | Logging a new play (or editing/deleting one) and reloading `/stats` reflects the change in every affected figure; no value is served from a stored/cached aggregate. |
| QA-04 | Exact-match aggregation (FR-04, NFR-05) | An archive containing both "Almeida" and "almeida" counts them as two distinct venues; each most-seen count equals the number of entries the log shows when filtered to that exact value. |
| QA-05 | Headline tiles present (FR-05) | The view shows five tiles — total plays, span, distinct venues, distinct directors, distinct actors — with distinct counts ignoring blank values. |
| QA-06 | Span presentation (FR-06) | With dated plays across 2019–2026 the span reads "2019–2026"; with all dated plays in one year it reads that single year; with no dated plays it states plainly that no dates are recorded — never a blank or bogus range. |
| QA-07 | Plays per year (FR-07) | One row appears per year that has ≥1 dated play, newest at top, each showing the year, its count, and a bar proportional to the busiest year; undated plays are absent from the breakdown. |
| QA-08 | Year strip empty rule (FR-08) | With zero dated plays, the plays-per-year section shows a plain "no year breakdown yet" statement, not an empty or zero-height strip. |
| QA-09 | Most-seen lists (FR-09) | Venues, directors, and actors each list up to five values with counts; a category with only three distinct values shows three items, not five padded rows. |
| QA-10 | Deterministic order and ties (FR-10) | Items are ordered count-desc then name-asc; two venues each seen 4 times both display "4" and sit adjacent in name order with no visual ranking between them. |
| QA-11 | Blank exclusion and actor de-dup (FR-11) | Plays with no venue don't affect venue counts; an actor listed twice across the same single play (impossible per dedupe) or once counts once per play; undated plays still contribute to most-seen counts. |
| QA-12 | Most-seen empty rule (FR-12) | With no venue recorded on any play, the venues list shows a plain "not enough logged yet" line, not an empty list. |
| QA-13 | Click-through lands filtered (FR-13) | Clicking a most-seen venue/director/actor lands on the log showing exactly the matching entries, with the active-filter banner naming the field and value, and "Clear filter" restoring the full log. |
| QA-14 | URL-param filter integration (FR-14) | Navigating to the log with the filter query parameter seeds the single active filter (exact, case-sensitive) and shows the banner; an absent or malformed parameter loads the log unfiltered exactly as before. |
| QA-15 | Undated caveat (FR-15) | With some undated entries, an explicit count of them is shown plainly beside the year breakdown; with none undated, no "0 undated" caveat appears. |
| QA-16 | Read-only (FR-16) | The stats view offers no create/edit/delete control; its only interactions are the navigation links and the most-seen click-throughs. |
| QA-17 | Empty state (FR-17) | With zero plays, `/stats` shows a warm designed invitation with a route to add the first play — no empty tiles, blank year strip, or empty lists. |
| QA-18 | Low-data graceful degradation (FR-18) | With a single play (and with several all-undated plays), the view renders true small numbers; span, year strip, and most-seen sections each fall back per their rules with no fabricated trend, bar, or ranking. |
| QA-19 | Responsive / mobile (NFR-01) | At a 360px viewport the view has no horizontal page scroll; tiles reflow, and bars/lists stay legible with tappable links. |
| QA-20 | Accessibility (NFR-02) | Heading hierarchy is sensible; every link is keyboard-operable with a visible focus ring; each count is present as text (not conveyed by bar length/colour alone); any entrance motion honours reduced-motion; text meets AA contrast. |
| QA-21 | Performance (NFR-03) | With ~1,000 seeded plays, `/stats` computes and renders without perceptible delay. |
| QA-22 | Calm Neutra presentation (NFR-04) | Tiles are floating planes on warm shadow (no nested cards, no hard grey shadow); the year visual is a restrained static bar from existing tokens; no charting library, animation, or dashboard density is present; aloe appears only as a quiet quantity fill if at all. |
| QA-23 | No schema change (Out of Scope) | The feature ships with no migration and no new columns/tables; it reads only the existing `plays` and `play_actors` data. |
