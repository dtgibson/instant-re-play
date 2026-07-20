# Change Brief — Entry Polish & App Icon

## What is changing
Three related, additive polish items on the shipped Play Log.
1. **Self-sourced autocomplete** on the entry/edit form's venue, director,
   actor, and the new playwright fields — as you type, suggest values already
   in the log, derived client-side from the archive already loaded in the page
   (no new endpoint, no extra read). Free typing still works.
2. **A new optional `playwright` field** on each play: one nullable text column
   on `plays`, saved on the entry/edit form, shown in the list as a person-value
   consistent with director (click-to-filter + IMDb search link), included in
   search, and carried into the CSV/XLSX export.
3. **A home-screen app icon**: a designed icon, a web app manifest, a
   theme-color, and an app title so iOS/iPadOS "Add to Home Screen" shows a
   proper icon and name, not a generic screenshot.

## Why now
The exact-match filter/stats/export contract silently fragments on typos;
autocomplete off the user's own prior values fixes that at the source and speeds
logging. Playwright is the one obvious missing person on a theatre record.
The install identity is unfinished PWA polish — today the home-screen icon is a
generic screenshot.

## User-facing impact
Additive only. A new playwright field appears in the form and list; existing
entries show it blank (never placeholder) until edited. Autocomplete is a new
affordance on existing fields; typing and free entry are unchanged. Export gains
a Playwright column. No change to auth, sort, delete, or the exact-match
filter/search semantics.

## Design pass
Needed. Surfaces refined:
- **Entry/edit drawer** — the self-sourced autocomplete dropdown (keyboard nav,
  select-vs-free-type, reduced-motion) and where the playwright field sits among
  name / date / venue / director / cast.
- **Play rows / list** — playwright shown as a person-value consistent with
  director (a new labeled band/column, sill-underline filter value + distinct
  boxed IMDb icon).
- **Home-screen app icon** — a designed mark in the Neutra language, plus the
  manifest name and theme-color.
The autocomplete UI and the icon are real design work.

## Decisions touched
- **Schema** — adds one nullable `playwright` text column to `plays` (small
  additive migration, no data loss) plus its exact-match filter index; extends
  the play-log schema.
- **Export contract** (DECISIONS.md, "capture everything") — the fixed export
  column shape gains a Playwright column so the backup stays complete; deferred
  import round-trips it.
- **Design system** — the app icon + manifest establish the product's
  install/home-screen identity, extending the design system to a new surface.
- The play-log PRD deferred autocomplete as out-of-scope; this reverses that for
  self-sourced suggestions only (no canonical entities, still exact-match).

## What done looks like
- Typing in venue/director/actor/playwright suggests matching prior values;
  selecting one fills the exact stored text; free entry still works.
- A play saves/edits with a playwright that shows in the list as click-to-filter
  with an IMDb link, is found by search, and appears in the export.
- Existing plays render unchanged with playwright blank.
- Add-to-Home-Screen on iOS shows the designed icon, app name, and theme color.
- Stats view is unchanged (no most-seen-playwrights aggregate this batch).
