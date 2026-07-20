# Strategic Brief — Theatregoing Stats

## What We're Building
A calm, dedicated **stats view** that reflects the user's theatregoing
back to them: how much they've logged, over how many years, and who and
where recurs across their archive. It lives at its own reachable route
(`/stats`), is linked from the Play Log by a quiet, non-accent
affordance, and is computed **live** from the current data on every
read — nothing precomputed or stored, so the numbers stay true as the
log grows. The "most seen" lists tie straight back to the log's
existing click-to-filter, turning a count into a doorway ("Almeida —
9 plays" opens those nine).

Recommended starter set (tasteful, not a dashboard):
- **Headline tiles:** total plays logged; the span (earliest dated year
  to most recent); distinct venues, directors, and actors seen.
- **Plays per year:** a restrained horizontal bar strip, one row per
  year, newest at top. This is the payoff that grows with the archive.
- **Three "most seen" lists (top ~5 each):** Venues, Directors, Actors,
  each item showing its count and linking back to the filtered log.
- **A quiet caveat:** the count of undated entries, stated plainly so
  the per-year totals are honest, never hidden.

## Why Now
The Play Log holds real, hand-entered data and Export has made that data
the user's to keep. The archive is now big enough to *say something* —
but the only way to see a pattern today is to scroll and count by hand.
The product's founding insight is that a theatre log's value is in its
connections (the same venue, director, actor recurring across a life of
theatregoing); stats is where those connections finally become
legible at a glance. This is the feature that turns the archive from a
record into a **reflection** — the reward for having logged.

## The User Problem
"I've logged a couple of seasons. How many plays is that really? Which
theatre do I keep going back to? Which actor have I seen the most —
and can I jump straight to every play they were in?" The list can answer
each of these only through manual effort. There's no single, calm place
that summarizes the shape of the user's theatregoing and lets them step
from a number into the entries behind it.

## Success Criteria
- From the Play Log, the user reaches the stats view in one action via
  a calm, non-accent affordance, and returns to the log just as easily.
- The view shows, all computed live from current data: total plays,
  years spanned, distinct venue / director / actor counts, a
  plays-per-year breakdown, and top-N most-seen venues, directors, and
  actors. Logging a new play and revisiting reflects the change.
- Every "most seen" item is a doorway: clicking it lands on the Play Log
  already filtered (exact match) to that venue, director, or actor.
- Blanks and undated entries are handled honestly: undated plays are
  excluded from per-year and surfaced as a quiet count; a play with no
  venue (or director) simply isn't counted toward that stat.
- Ties read gracefully — equal counts are shown as equal, ordering is
  deterministic (count desc, then name), and there are no broken or
  misleading visuals.
- With **zero** plays the view shows a warm, designed empty state that
  invites logging the first play, not empty charts; with only one or two
  plays it states the small numbers plainly rather than pretending a
  trend exists.
- The presentation is unmistakably calm and Neutra — floating-plane stat
  tiles and restrained bar/list visualizations — and reads as part of
  the archive, not an analytics dashboard. Aloe stays reserved for
  "Log a play".
- No schema change and no migration: stats are read-only aggregations
  over the existing `plays` and `play_actors` tables.

## Scope
- A dedicated **/stats** route (a Server Component, dynamic like the log
  so it recomputes on every request), with a calm link to it from the
  Play Log header/action area and a calm route back.
- Live aggregation over the full current archive: totals, distinct
  counts, plays-per-year, and top-N most-seen venues / directors /
  actors (from `play_actors` for actors).
- The "most seen" items link into the existing Play Log filter for that
  value (exact match, the same mechanism the list already uses).
- A restrained, horizontal, Neutra-native presentation: stat tiles as
  floating planes plus a simple bar/list, built with the existing design
  tokens and typography (the masthead trust-stat is the precedent).
- Two designed low-data states: an empty-archive invitation and a
  sensible very-few-plays reading.
- Graceful handling of ties, blanks, and undated entries.

## Out of Scope
- Editing, creating, or deleting data from the stats view (read-only).
- Goals, targets, streaks, or any "you should see more" nudging.
- Date-range filtering, custom queries, or a "stats for the filtered
  view" — v1 stats always describe the whole archive.
- Exporting stats (that belongs to the Export feature) or sharing them.
- Heavy charting libraries or animated/interactive charts — restrained
  static bars and lists only.
- Any schema change, migration, precomputed/stored aggregates, or new
  external data source.
- Deep per-person or per-venue pages beyond the existing click-to-filter
  the "most seen" lists link into.

## Key Decisions
- **Live on read, never stored.** Stats recompute from current data
  every time the view loads (the route is dynamic, mirroring the log).
  This is what "updated as the database gets bigger" means, and at the
  product's scale (≤ ~1,000 plays) it's effortless. Whether the counts
  come from SQL `GROUP BY` or in-app aggregation over the existing full
  read is the Architect's call; reusing the existing `listPlays` read
  and aggregating in one pure module keeps a single source of truth.
- **A dedicated route, not an inline panel.** `/stats` keeps the log
  fast and focused and gives reflection its own calm room. It is reached
  by a quiet, non-accent affordance (near the masthead stat or beside
  Export in the action cluster) so **aloe stays reserved for the one
  true action, "Log a play."**
- **Every "most seen" ties back to the log.** The payoff of a personal
  archive is the connection, so each ranked venue / director / actor
  links to the Play Log pre-filtered to that value, reusing the existing
  exact-match click-to-filter rather than inventing new filtering. This
  implies the log can accept an initial filter (e.g. via a URL param) —
  a small, additive integration flagged here for the Planner/Architect.
- **A curated set, deliberately small.** Totals, span, distinct counts,
  plays-per-year, and three top-N lists. Enough to feel insightful, far
  short of a dashboard. No per-month heatmaps, no genre/rating cuts
  (that data doesn't exist), no vanity metrics.
- **Honesty over completeness.** Undated plays are excluded from
  per-year and shown as an explicit count; missing venue/director simply
  doesn't count for that stat (never a fake "Unknown" bucket unless the
  Designer decides one reads more truthfully); ties are shown as ties.
  Correctness is part of the archive's aesthetic of trust.
- **Calm Neutra, reusing the established language.** Stat tiles are
  floating planes on warm shadow; the plays-per-year visual is a
  restrained horizontal bar built from existing tokens (aloe used only
  as a quiet quantity fill, if at all), typography and spacing inherited
  from the design system. The design doctrine's warning against
  dashboard-slop is a hard constraint, not a preference.
- **Ship after Export, before any import.** The archive is now the
  user's to keep; giving it back to them as reflection is the natural
  next reward, and it's purely additive — no data model risk.
