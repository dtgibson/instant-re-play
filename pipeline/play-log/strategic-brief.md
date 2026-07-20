# Strategic Brief — The Play Log

## What We're Building
The core of Instant Re-Play: an entry screen for recording a play
(name, date seen, venue, director, actors) and a sortable, searchable
list of every play entered, with click-to-filter on venues, directors,
and actors, and IMDb search links for people.

## Why Now
This *is* the product's founding idea — nothing else on the roadmap
means anything until a user can enter plays and browse them. Shipping
the log first also generates the real data that later features (import,
stats) will operate on, so any modelling mistakes surface immediately.

## The User Problem
A regular theatregoer has no reliable record of what they've seen.
They can't answer "when did I see that?", "what else have I seen at
this venue?", or "have I seen this actor before?" — the memories exist
but aren't queryable. This feature gives them a fast way to capture
each play and a list that answers those questions directly.

## Success Criteria
- The user can add a play — name, date, venue, director, any number of
  actors — in under a minute, and edit or delete an entry later.
- The list shows every entered play and can be sorted (at minimum by
  play name and date seen) and searched by free text across its fields.
- Clicking a venue, director, or actor anywhere in the list filters the
  list to other plays sharing that value, with an obvious way to clear
  the filter.
- Actor and director names offer an IMDb link that always resolves
  (search link), and its absence on venues doesn't feel like a bug.
- The app is usable on a phone browser well enough to log a play on
  the way home from the theatre.

## Scope
- Play entry screen: name (required), date seen, venue, director, and
  a multi-value actors field; all people/venue fields free text.
- Edit and delete for existing entries — a log you can't correct
  isn't trustworthy.
- The list view: all entries, sortable columns (name, date, venue),
  free-text search across name, venue, director, and actors.
- Click-to-filter: venue, director, and actor values act as filters on
  the list (exact match on the stored text); active filter is visible
  and clearable.
- External links: IMDb *search* links (e.g. IMDb find URL with the
  person's name) on actor and director names.
- Persistent storage of the user's entries — the log survives closing
  the browser.

## Out of Scope
- Accounts for multiple users, sharing, or any social surface.
- Ratings, reviews, notes, or photo attachments.
- CSV or any other import/export (next roadmap item).
- Autocomplete, canonical entity records, or fuzzy matching of names —
  filtering is exact-match on entered text in v1.
- Guessed IMDb deep links or links for venues/productions; theatre-
  specific data sources.
- Stats, charts, or summaries.

## Key Decisions
- **IMDb links are search links, not deep links:** theatre people and
  productions are unreliably represented on IMDb, so people-name links
  go to IMDb search results — honoring the "link out to more info"
  intent without ever producing a broken or wrong-person link. Venues
  get no IMDb link.
- **Actors are a multi-value field** on each play entry, and each actor
  is individually clickable/filterable and individually linked.
- **Free text + exact-match filtering** in v1; consistency of names is
  the user's responsibility until autocomplete arrives (On the
  Horizon).
- **Edit/delete is in scope** even though the founding idea only
  mentions saving — an uncorrectable log fails the trust requirement.
- **Sort and search are table-stakes**, not enhancements: date and name
  sorting plus cross-field search ship with the first version of the
  list.
