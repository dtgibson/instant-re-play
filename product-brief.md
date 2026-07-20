# Product Brief — Instant Re-Play

## What This Is
Instant Re-Play is a personal theatregoing log: a web app where one
person records every play they've seen and browses that history as a
sortable, searchable, filterable list.

## The Problem
People who go to the theatre regularly accumulate years of
performances — and lose them. Programmes get thrown out, ticket stubs
fade, and questions like "when did I see that production of Hamlet?"
or "have I seen this actor before?" become unanswerable. General-
purpose tools (spreadsheets, notes apps) can hold the data but make
entry tedious and offer no way to explore it — no sorting by date, no
filtering by venue, no tracing an actor across productions.

## Who It's For
A committed theatregoer — someone who sees a dozen or more shows a
year, keeps programmes in a drawer, and wishes they had the equivalent
of a film-watching log for the stage. They're logging for themselves:
to remember, to look things up, and to notice patterns in their own
theatregoing. They are not looking for a social network or a review
platform.

## Why It Should Exist
Film watchers have polished logging tools; theatregoers don't, and
theatre is *more* ephemeral — a production exists only in the memory of
the people who saw it. The unique insight is that a theatre log's value
comes from its connections: the same venue, director, or actor recurs
across a life of theatregoing, and clicking through those connections
("what else have I seen her in?") turns a flat list into a personal
history. Instant Re-Play is built around fast entry and those
click-to-filter connections.

## What Success Looks Like
Logging a play takes under a minute, so it actually happens after every
show. The list answers real memory questions instantly: when a play was
seen, everything seen at a given venue, every production featuring a
given actor or director. After a season of use, the log feels like a
personal archive the user trusts more than their own recall — and
links out let them jump from a name in their log to more information
about that person.

## Founding Decisions
- **Personal, single-user log** — one person's history, no social
  features, sharing, or public profiles.
- **Web app** with the entry screen and the list as the two core
  surfaces; entry speed is a first-class requirement.
- **Play entry fields:** name, date seen, venue, director, actors
  (multiple). That's the v1 data model.
- **Click-to-filter:** venue, director, and actor names in the list are
  clickable and filter the list to matching entries.
- **External links:** IMDb is film/TV-centric and many stage
  productions and theatre people aren't reliably on it, so entries link
  people (actors, directors) to IMDb *search* links (always resolve,
  never break) rather than guessed deep links. Venues and productions
  get no IMDb link in v1.
- **Free-text fields, exact-match filtering** in v1 — no canonical
  people/venue database or autocomplete-backed entity store yet.

## Out of Scope
- Social features: sharing, following, public lists, comments.
- Reviews, star ratings, or long-form notes (candidate for later).
- Importing from ticket vendors or scanning programmes/tickets.
- Native mobile apps — the web app should work on a phone, but that's
  the extent of v1 mobile.
- A curated database of plays, venues, or theatre people; all data is
  user-entered in v1.
