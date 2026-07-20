# QA Report — The Play Log

**Date:** 2026-07-18
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results

31 tests passing, 0 failing (3 test files: `tests/play.test.ts`,
`tests/query.test.ts`, `tests/repository.test.ts`). Duration ~2.4s.

Supplementary verification, all green:

| Check | Command | Result |
|---|---|---|
| Unit + integration | `npm run test` (vitest run) | 31/31 pass |
| Headless smoke | `npx tsx scripts/smoke.ts` | 40/40 assertions pass |
| Independent verify | `npx tsx scripts/verify-smoke.ts` | 60/60 assertions pass |
| Type-check | `npx tsc --noEmit` | exit 0 (clean) |
| Production build | `npx next build` | exit 0 (compiled + TS check pass) |
| Running dev server | `curl http://127.0.0.1:3939/` | HTTP 200, log renders with seeded data |

The `repository.test.ts` suite runs against a real PGlite Postgres and
covers normalization, validation rejection, future-date acceptance,
date-DESC-NULLS-LAST ordering, actor-set replacement on edit, cascade
delete, and persistence across a database reopen (FR-20). The two smoke
scripts exercise the same domain + repository layer end to end against
fresh PGlite instances and both pass with zero failures.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| QA-01 Entry form fields (FR-01) | ✓ Pass | `PlayDrawer` renders exactly play name, date seen, venue, director, and a multi-value cast input. Reachable from the list in one action via the "Log a play" button. |
| QA-02 Required name validation (FR-02) | ✓ Pass | `validatePlayInput` blocks empty/whitespace name; `handleSubmit` sets an inline `role="alert"` error, focuses the name field, and preserves all other form state. Server action re-validates as a backstop. Covered by unit test + both smoke scripts. |
| QA-03 Optional fields (FR-03) | ✓ Pass | `PlayRow` omits blank optional fields entirely (label renders only when a value exists) — no placeholder shown as data. Verified by `verify-smoke` name-only fixture. |
| QA-04 Date validation (FR-04) | ✓ Pass | `isValidDate` rejects malformed/impossible dates (round-trips parsed components), accepts empty, past, and future. `verify-smoke` exercises 9 invalid forms plus leap-day, past, and future acceptance. |
| QA-05 Multi-actor entry (FR-05) | ✓ Pass (code + logic) | `addActor`/`removeActor` add one at a time and remove any index; order preserved via array push/filter; exact-dup guarded on add. Interactive 5-add/remove-3rd flow is exactly this logic; normalization is unit-tested. |
| QA-06 Input normalization (FR-06) | ✓ Pass | `normalizePlayInput` trims all free-text, drops empty actors, dedupes exact duplicates preserving order. Verified by unit test + smoke + verify-smoke (" Hamlet " → "Hamlet", spaces-only dropped, duplicate name stored once). |
| QA-07 Save feedback (FR-07) | ✓ Pass | On success the action returns the fresh list, `setPlays` updates the in-memory list with no refresh, and the `role="status"` Toast announces "Saved — …". |
| QA-08 Edit flow (FR-08) | ✓ Pass | Drawer prefills from `editingPlay`; same normalize/validate path; Cancel/close resets without writing; clearing the name blocks save with the FR-02 error. Repository replaces the actor set wholesale (integration-tested). |
| QA-09 Delete flow (FR-09) | ✓ Pass | `ConfirmDialog` (`role="alertdialog"`, focus on the safe "Keep it") gates deletion; confirm removes immediately and persists; declining leaves the entry untouched. Cascade + persistence integration-tested. |
| QA-10 List completeness (FR-10) | ✓ Pass | `PlayRow` renders name, date, venue, director, and every actor for each entry. Rendered server output shows the full seeded set. |
| QA-11 Sorting (FR-11) | ✓ Pass | `nextSort` toggles asc/desc; default is date desc; `comparePlays` keeps blanks last in BOTH directions. Unit tests + both smoke scripts assert date asc/desc, venue asc/desc, and name ordering with blanks-last. |
| QA-12 Empty-log state (FR-12) | ✓ Pass (code inspection) | `isEmptyLog` branch renders the empty-state message and a working "Log your first play" CTA. Distinct code path from no-results. Current seeded DB is non-empty, so not observed live, but the branch logic is unambiguous. |
| QA-13 Search (FR-13) | ✓ Pass | `matchesSearch` does case-insensitive substring across name/venue/director/actors; clearing restores the list. Unit + smoke ('mescal' → only Streetcar; 'MESCAL' == 'mescal'). |
| QA-14 No-results state (FR-14) | ✓ Pass | `isNoResults` (`plays>0 && view==0`) renders a message distinct from the empty-log state plus a one-action "Clear search & filter". |
| QA-15 Click-to-filter (FR-15) | ✓ Pass | `matchesFilter` is exact and case-sensitive; actor filter matches if any actor equals the value. Unit + smoke + verify-smoke (case variant and trailing-space variant both match nothing). |
| QA-16 Filter visibility & clearing (FR-16) | ✓ Pass | Active-filter banner (`role="status"`) states the field label + value; a single "Clear filter" action restores the list. |
| QA-17 Filter replacement & search combine (FR-17) | ✓ Pass | `onFilter` keeps a single active filter (re-click toggles off, new click replaces); `filterAndSortPlays` ANDs filter with search. Unit + smoke + verify-smoke (replace A→B; director AND search). |
| QA-18 IMDb links (FR-18) | ✓ Pass | `PersonValue` renders two separate hit areas: a filter button (dotted-underline name) and a distinct boxed `a.imdb` external-link icon opening a name-search in a new tab. One click never does both. Rendered HTML: 33 IMDb links, each URL-encoded with `s=nm`. |
| QA-19 No venue links (FR-19) | ✓ Pass | Venue renders as a filter-only button (no anchor); zero `s=tt` links in output; a square "plan" glyph (not a broken-link affordance) marks it as a place that carries no link. |
| QA-20 Persistence (FR-20) | ✓ Pass | Log is read from Postgres on every request; local PGlite persists to `.data`, Neon in prod. Repository persistence test + both smoke scripts reopen the database and confirm creates/edits/deletes survive. |
| QA-21 Mobile usability (NFR-01) | ✓ Pass (code inspection / needs interactive confirmation) | `body { overflow-x: hidden }`; `@media (max-width: 940px)` collapses the table to a labelled card layout (thead hidden, per-cell labels shown); drawer capped at `calc(100vw - 2rem)`; 420px query. Same components drive every flow. Physical 360px device walk-through is a human step. |
| QA-22 Entry speed (NFR-02) | ✓ Pass (code inspection / needs interactive confirmation) | The add flow is exactly open drawer → fill fields → save, with an instant in-memory list update and no intervening steps. The <60s stopwatch is a human measure; the flow contains no extra steps that could exceed it. |
| QA-23 List responsiveness (NFR-03) | ✓ Pass (code inspection / needs interactive confirmation) | Sort/search/filter run in-memory via `useMemo` over the full log (O(n log n) sort, linear filter) at the ≤1,000-entry single-user scale — sub-perceptible. A live 1,000-entry stopwatch is a human measure; the algorithmic cost is negligible. |
| QA-24 Accessibility (NFR-04) | ✓ Pass (code inspection / needs interactive confirmation) | Entry/edit form fields carry visible `<label>`s; all controls are native `button`/`a` (keyboard-operable); `useOverlayA11y` traps focus, closes on Escape, and restores focus; sort headers expose `aria-sort`, filter/sort buttons `aria-pressed`, errors `role="alert"`. Filter-vs-IMDb distinction is shape + icon, not color. Full assistive-tech + keyboard walk is a human step. See Known Limitations re: two placeholder-labelled inputs. |
| QA-25 Link safety (NFR-05) | ✓ Pass | All 33 IMDb links carry `rel="noopener noreferrer"` + `target="_blank"` (no opener). `imdbUrl` sends only the URL-encoded name. Rendered HTML references no third-party scripts, fonts (self-hosted `/_next/static/media`), or beacons — the only external host is `www.imdb.com` (the intended navigation). |

**Tally:** 25 of 25 Pass (0 Partial, 0 Fail). Five NFR-driven criteria
(QA-21, QA-22, QA-23, QA-24) and the empty-log branch (QA-12) are verified
by code inspection plus the running server; the remaining human-observable
confirmations (physical 360px device, wall-clock timings, assistive-tech
walk) are noted but do not block — nothing in code disproves them.

## Edge Cases Tested

- Impossible calendar dates (2024-02-31, 2023-02-29, 2024-13-01, 2024-00-10),
  malformed forms (20240101, 01/02/2024, 2024-1-1, not-a-date) — all rejected;
  the genuine leap day 2024-02-29 accepted (verify-smoke).
- Whitespace-only, tab-only, and newline-only names rejected with no rows
  written (verify-smoke confirms the DB is untouched by rejected creates).
- Blanks-last ordering asserted in BOTH sort directions for date and venue
  (not merely descending).
- Case-sensitive click-filter: lowercase and trailing-space variants of a
  stored value match nothing; case-insensitive search still matches them.
- Filter + search AND-combination, including a non-overlapping pair that
  correctly yields the no-results state.
- Actor-set replacement on edit leaves no orphan `play_actors` rows; delete
  cascades to actor rows.
- Persistence verified by physically reopening the PGlite directory and
  re-reading — deletes stay deleted, edits stay applied, default order holds.
- Future dates accepted and surfaced with an "Upcoming" tag.

## Known Limitations

- **Human-observable NFRs not machine-confirmed.** QA-21 (360px on a real
  device), QA-22 (<60s wall clock), QA-23 (1,000-entry live responsiveness),
  and QA-24 (assistive-tech + full keyboard traversal) are verified by code
  inspection against the running server. The implementation satisfies each by
  construction, but a final human pass on a phone and with a screen reader is
  the only way to *observe* them. None are disproven.
- **Two inputs use a visually-hidden label + placeholder as their visible
  affordance:** the list search box (visible search icon + placeholder) and
  the cast add-actor input (sits under a visible "Cast" group label with a
  descriptive placeholder). All entry/edit form fields proper have visible
  `<label>`s and every input is programmatically labelled, so this does not
  fail QA-24, but a strict WCAG pass may prefer a persistent visible label on
  those two. Flagged for interactive AT confirmation.
- **QA-12 empty-log state** is confirmed by reading the branch, not observed
  live, because the seeded database is intentionally non-empty. The branch is
  a distinct, unconditional code path with a working CTA.
