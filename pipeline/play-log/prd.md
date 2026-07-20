# PRD — The Play Log
**Feature:** play-log
**Date:** 2026-07-18
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A play-logging surface with two parts: an entry form for recording a
play (name, date seen, venue, director, and any number of actors) and a
persistent, sortable, searchable list of every play entered, where
venue, director, and actor values act as click-to-filter controls and
people's names carry IMDb search links. Entries can be edited and
deleted.

---

## User Stories

> **US-01** — As a theatregoer, I want to record a play I've just seen —
> its name, the date, the venue, the director, and the actors — in under
> a minute, so that logging actually happens after every show.

> **US-02** — As a theatregoer, I want to browse every play I've logged
> in a list I can sort by name, date, or venue, so that I can answer
> "when did I see that?" at a glance.

> **US-03** — As a theatregoer, I want to search my log by free text, so
> that I can find a play when I only remember a fragment — part of a
> title, an actor's surname, a venue.

> **US-04** — As a theatregoer, I want to click a venue, director, or
> actor anywhere in the list and see every other play sharing that
> value, so that my log surfaces the connections across my theatregoing.

> **US-05** — As a theatregoer, I want to edit or delete an entry I got
> wrong, so that the log stays accurate enough to trust over my own
> memory.

> **US-06** — As a theatregoer, I want an IMDb link on each actor and
> director name, so that I can jump from a name in my log to more
> information about that person without the link ever being broken.

---

## Functional Requirements

### Entry

> **FR-01** — The app shall provide a play entry form with exactly these
> fields: play name (free text), date seen (calendar date), venue (free
> text), director (free text), and actors (multi-value free text). The
> form shall be reachable from the list view in a single action.

> **FR-02** — Play name shall be required. Submitting the form without a
> non-empty play name shall not save an entry; the app shall show an
> inline error identifying the missing field and shall preserve all
> other values the user has entered.

> **FR-03** — Date seen, venue, director, and actors shall all be
> optional. An entry saved with any of them empty shall display that
> field as blank in the list, with no placeholder text that could be
> mistaken for data.

> **FR-04** — Date seen shall accept only a valid calendar date. An
> invalid date shall be rejected with an inline error before save; any
> valid date, past or future, shall be accepted.

> **FR-05** — The actors field shall accept any number of actor names
> added one at a time, and shall allow removing any individual actor
> before saving. Order of entry shall be preserved.

> **FR-06** — On save, the app shall trim leading and trailing
> whitespace from every free-text value, discard actor values that are
> empty after trimming, and store at most one copy of an exact-duplicate
> actor name within a single entry.

> **FR-07** — On successful save, the new entry shall appear in the list
> immediately and the app shall give visible confirmation that the save
> happened.

### Edit and delete

> **FR-08** — The app shall allow editing any existing entry. The edit
> form shall be pre-filled with the entry's current values, shall apply
> the same validation as creation (FR-02, FR-04, FR-06), and shall
> update the entry on save. Cancelling an edit shall discard all changes
> and leave the entry untouched.

> **FR-09** — The app shall allow deleting any existing entry. Deletion
> shall require an explicit confirmation step; on confirmation the entry
> shall be removed from the list immediately and permanently. Declining
> the confirmation shall leave the entry untouched.

### List and sort

> **FR-10** — The list shall show every saved entry, and for each entry
> shall display its play name, date seen, venue, director, and all
> actors.

> **FR-11** — The list shall be sortable by play name, date seen, and
> venue, each toggling between ascending and descending. The default
> order shall be date seen, most recent first. Entries with an empty
> value in the active sort field shall appear after all entries with
> values, in both directions.

> **FR-12** — When the log contains no entries, the list view shall show
> an empty state that says the log is empty and offers a direct route to
> adding the first play.

### Search

> **FR-13** — The list view shall provide a free-text search that
> filters entries to those where the query appears as a case-insensitive
> substring in the play name, venue, director, or any actor name.
> Clearing the search shall restore the full list.

> **FR-14** — When a search or an active filter matches no entries, the
> app shall show a no-results state that distinguishes "no matches" from
> "empty log" and offers a one-action way to clear the search and/or
> filter.

### Click-to-filter

> **FR-15** — Every venue, director, and actor value displayed in the
> list shall be clickable. Clicking a value shall filter the list to
> entries whose stored text in that field exactly matches the clicked
> value; for actors, an entry matches if any one of its actors matches.

> **FR-16** — While a filter is active, the app shall visibly show which
> field and value the list is filtered by, and shall provide a
> single-action control to clear the filter and restore the full list.

> **FR-17** — At most one click-filter shall be active at a time;
> clicking a different value shall replace the current filter. An active
> filter and a search query shall combine — the list shows only entries
> matching both.

### External links

> **FR-18** — Every actor and director name displayed in the list shall
> carry an IMDb search link that opens IMDb's name-search results for
> the URL-encoded stored name in a new tab. The IMDb link shall be a
> visually distinct affordance from the click-to-filter action on the
> same name, so that one click never does both.

> **FR-19** — Venue values shall have no external link, and their
> presentation shall not imply a missing or broken one.

### Persistence

> **FR-20** — Saved entries shall persist across browser sessions:
> closing and reopening the app shall show the same log, with all
> creates, edits, and deletes retained.

---

## Non-Functional Requirements

> **NFR-01 — Mobile usability:** Every flow in this PRD — add, edit,
> delete, sort, search, filter, link out — shall be usable in a phone
> browser at a 360px-wide viewport with no horizontal scrolling of the
> page.

> **NFR-02 — Entry speed:** A user with the app open shall be able to
> complete the add-a-play flow (FR-01 through FR-07) for a typical entry
> in under one minute, with no steps beyond opening the form, filling
> fields, and saving.

> **NFR-03 — List responsiveness:** Sorting, searching, and filtering
> shall respond without perceptible delay with a log of up to 1,000
> entries.

> **NFR-04 — Accessibility:** All form fields shall have visible labels;
> all interactive elements (sort controls, filter values, IMDb links,
> edit/delete actions) shall be keyboard-operable; the distinction
> between the filter affordance and the IMDb link affordance shall not
> rely on color alone.

> **NFR-05 — External link safety:** IMDb links shall open in a new
> browsing context without giving the destination page access to the app
> (e.g. no opener reference). No user data other than the clicked name
> in the IMDb search URL shall be sent to any third party.

---

## Out of Scope

- Accounts, multi-user support, sharing, or any social surface.
- Ratings, reviews, notes, or photo attachments.
- Import or export in any format (CSV import is the next roadmap item).
- Autocomplete, canonical entity records, or fuzzy/case-insensitive
  matching for click-to-filter — filtering is exact match on stored
  text; name consistency is the user's responsibility in v1.
- IMDb deep links (direct person/title pages), and any external links on
  venues or productions; theatre-specific data sources.
- Stats, charts, or summaries.
- Native mobile apps — mobile support is the responsive web app only.
- Multiple simultaneous click-filters (e.g. venue AND actor stacked).
- Undo after a confirmed delete.
- Duplicate-entry detection across the log (the same play may be logged
  twice — legitimately, for repeat viewings).
- Pagination or virtualized lists beyond what NFR-03 requires.

---

## Open Questions

None — all decisions are resolved in this document. Defaults chosen
where the brief was silent: only play name is required (FR-02/FR-03);
default sort is date seen, most recent first, blanks last (FR-11); one
click-filter at a time, combining with search (FR-17); delete requires
confirmation with no undo (FR-09); future dates are accepted (FR-04).
These are flagged to the user in the stage hand-back.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Entry form fields (FR-01) | The form shows exactly play name, date seen, venue, director, and a multi-value actors input, and is reachable from the list in one action. |
| QA-02 | Required name validation (FR-02) | Submitting with an empty/whitespace name saves nothing, shows an inline error naming the field, and all other entered values remain in the form. |
| QA-03 | Optional fields (FR-03) | An entry saved with only a name appears in the list with date, venue, director, and actors blank — no placeholder text shown as data. |
| QA-04 | Date validation (FR-04) | An invalid date is rejected with an inline error before save; a valid past date and a valid future date both save successfully. |
| QA-05 | Multi-actor entry (FR-05) | Five actors can be added to one entry; removing the third before save leaves the other four, in entry order. |
| QA-06 | Input normalization (FR-06) | " Hamlet " saves as "Hamlet"; an actor entry of only spaces is discarded; adding "Ian McKellen" twice to one entry stores it once. |
| QA-07 | Save feedback (FR-07) | After saving, the new entry is visible in the list without a manual refresh and a save confirmation is shown. |
| QA-08 | Edit flow (FR-08) | Opening edit shows current values pre-filled; changing the venue and saving updates the list; re-opening edit, changing a value, and cancelling leaves the entry unchanged; clearing the name in edit blocks the save with the FR-02 error. |
| QA-09 | Delete flow (FR-09) | Delete prompts for confirmation; confirming removes the entry from the list immediately and it stays gone after reload; declining leaves the entry present. |
| QA-10 | List completeness (FR-10) | With three saved entries, the list shows all three with name, date, venue, director, and every actor visible for each. |
| QA-11 | Sorting (FR-11) | Name, date, and venue sorts each toggle asc/desc correctly; on first load the newest-dated entry is first; an entry with no date appears last under date sort in both directions. |
| QA-12 | Empty-log state (FR-12) | With zero entries, the list shows an empty-state message and a working route to the add form. |
| QA-13 | Search (FR-13) | Searching a lowercase fragment of an actor's surname returns every entry featuring that actor and no others; clearing the search restores the full list. |
| QA-14 | No-results state (FR-14) | A search with no matches shows a no-results message (distinct from the empty-log state) and a one-action control that clears it and restores the list. |
| QA-15 | Click-to-filter (FR-15) | Clicking an actor name shows exactly the entries listing that exact actor; clicking a venue shows exactly the entries with that exact venue; a case-variant of the same name does not match. |
| QA-16 | Filter visibility and clearing (FR-16) | While filtered, the UI states the filtered field and value; one action clears the filter and restores the full list. |
| QA-17 | Filter replacement and search combination (FR-17) | Clicking a second value replaces the first filter (results reflect only the new one); with a filter active, typing a search query narrows results to entries matching both. |
| QA-18 | IMDb links (FR-18) | Each actor and director name offers an IMDb link, visually distinct from the filter affordance, that opens IMDb name-search results for that exact name in a new tab; clicking the filter affordance does not open IMDb and vice versa. |
| QA-19 | No venue links (FR-19) | Venue values render with no external link and no broken-link affordance. |
| QA-20 | Persistence (FR-20) | After adding, editing, and deleting entries, fully closing and reopening the browser shows the log in its exact post-change state. |
| QA-21 | Mobile usability (NFR-01) | At a 360px-wide viewport, a play can be added, edited, deleted, sorted, searched, filtered, and linked out with no horizontal page scrolling. |
| QA-22 | Entry speed (NFR-02) | A tester starting from the list logs a typical play (name, date, venue, director, three actors) in under 60 seconds. |
| QA-23 | List responsiveness (NFR-03) | With 1,000 seeded entries, sort, search, and filter each respond without perceptible delay. |
| QA-24 | Accessibility (NFR-04) | All form fields have visible labels; sort, filter, IMDb, edit, and delete controls are operable by keyboard alone; filter vs IMDb affordances are distinguishable without color. |
| QA-25 | Link safety (NFR-05) | IMDb links open without an opener reference to the app, and no requests to third parties occur except the IMDb navigation itself. |
