# PRD — Data Export
**Feature:** data-export
**Date:** 2026-07-19
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A one-action way to export the entire Play Log to a downloadable file, in
two formats — CSV (`.csv`) and Excel (`.xlsx`) — offered from a small,
calm Export control in the existing Play Log list view. Each file has one
row per play with a fixed column set (Name, Date seen, Venue, Director,
Cast), the ordered cast joined into a single Cast cell. Export is a full
backup: it always writes the whole archive, ignoring any active search,
filter, or sort. Files are generated server-side and streamed to the
browser as a download with a dated filename, correct `Content-Type`, and
`Content-Disposition: attachment`. Output is safe by construction —
proper CSV quoting/escaping and spreadsheet formula-injection
neutralization on every cell in both formats — and an empty log still
produces a valid header-only file, never an error. Import is explicitly a
later, separate feature.

---

## User Stories

> **US-01** — As a theatregoer, I want to export my whole Play Log to a
> file in one action, so that I own a copy of my history and it is not
> stranded inside a single app or deployment.

> **US-02** — As a theatregoer, I want to choose CSV or Excel, so that I
> can open my log in whatever tool I use (Excel, Google Sheets, Numbers)
> or keep a plain, universal backup.

> **US-03** — As a theatregoer, I want each play on one row with its
> cast in a single clearly-delimited cell and blank fields left blank, so
> that the exported file reads as a clean, faithful table of my archive.

> **US-04** — As a theatregoer, I want the exported file to open cleanly
> with correctly separated columns — even when a title, venue, or name
> contains a comma, quote, or unusual leading character — and never to
> run a formula when I open it, so that I can trust the export as a real
> backup.

> **US-05** — As a theatregoer with an empty or nearly-empty log, I want
> exporting to still give me a valid file rather than an error, so that
> the feature behaves predictably from day one.

---

## Functional Requirements

### Export control (UI)

> **FR-01** — The Play Log list view shall present an Export control that
> offers two clearly-labeled format choices, CSV and Excel (`.xlsx`),
> each individually activatable. The control shall live in the existing
> control bar alongside "Log a play" and shall be present regardless of
> how many plays the log contains.

> **FR-02** — Activating either format choice shall initiate a browser
> file download for that format without navigating away from the list or
> discarding the user's current search, filter, or sort state in the UI.

### Data and columns

> **FR-03** — An export shall contain the **entire** archive — every
> saved play — regardless of any active search, filter, or sort in the
> UI. The export shall write one row per play. Data rows shall be ordered
> by the log's default list order (date seen descending, entries with no
> date last, `created_at` breaking ties) so the file order is stable and
> meaningful.

> **FR-04** — Each file shall have exactly these columns, in this order:
> **Name, Date seen, Venue, Director, Cast**. The first row of every file
> shall be a header row carrying these column titles.

> **FR-05** — The Cast cell for a play shall be that play's actor names
> in their stored position order, joined into a single cell with a clear,
> consistent delimiter (`"; "` — semicolon then space). A play with no
> actors shall produce an empty Cast cell.

> **FR-06** — Blank optional fields (date seen, venue, director) shall
> export as empty cells, with no placeholder text or filler glyph that
> could be mistaken for data. When present, Date seen shall be written in
> the stored ISO `YYYY-MM-DD` form (unambiguous and sortable).

### Output safety and correctness

> **FR-07** — CSV output shall conform to RFC 4180: any field containing
> a comma, double-quote, carriage return, or line feed shall be wrapped
> in double-quotes, and any embedded double-quote shall be escaped by
> doubling it. Rows shall be terminated with CRLF. The file shall be
> UTF-8 encoded and shall begin with a UTF-8 byte-order mark so that
> Excel opens non-ASCII names (accents, diacritics) correctly.

> **FR-08** — Formula-injection shall be neutralized on **every** cell of
> **both** formats: any cell value that begins with `=`, `+`, `-`, `@`,
> a tab (U+0009), or a carriage return (U+000D) shall be prefixed with a
> single leading apostrophe so it cannot be interpreted as a formula when
> the file is opened in Excel, Google Sheets, or Numbers. For CSV this
> neutralization shall be applied to the raw value **before** RFC 4180
> quoting/escaping (FR-07). No exported cell shall be executable as a
> formula.

> **FR-09** — The `.xlsx` output shall be a genuine OOXML spreadsheet
> that opens natively in Excel as a single worksheet. Every cell shall be
> written as a text (string) cell, preserving the exact value and the
> FR-08 neutralization, so that no value is silently re-typed or
> re-interpreted by the spreadsheet application.

### Delivery

> **FR-10** — Each format shall be delivered as a download with the
> correct `Content-Type` (`text/csv; charset=utf-8` for CSV; the OOXML
> spreadsheet media type
> `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for
> Excel) and a `Content-Disposition: attachment` header carrying the
> filename.

> **FR-11** — The download filename shall be
> `instant-re-play-YYYY-MM-DD.csv` / `instant-re-play-YYYY-MM-DD.xlsx`,
> where `YYYY-MM-DD` is the date the export is generated.

> **FR-12** — Exporting an empty log shall produce a valid file
> containing only the header row and no data rows — for both formats —
> and shall never return an error or an empty/corrupt file.

> **FR-13** — Export files shall be generated server-side (a Next.js
> Route Handler that reads the archive with the existing repository) and
> shall reflect the archive as of the moment of the request.

---

## Non-Functional Requirements

> **NFR-01 — Performance:** Exporting a log of up to 1,000 plays (each
> with a typical cast) shall be prompt — generation and the start of the
> download shall complete within a couple of seconds on the deployed app,
> with no perceptible hang of the list UI.

> **NFR-02 — No third party receives data:** The entire export
> pipeline — reading the archive, generating the CSV/`.xlsx`, and
> streaming the download — shall run inside the app's own server runtime
> and its own Postgres. No external service, API, or CDN shall receive
> any play data. This preserves the single-user, deployment-level privacy
> model of the product.

> **NFR-03 — Mobile usability:** The Export control and the download
> shall be usable in a phone browser at a 360px-wide viewport with no
> horizontal scrolling of the page; the control shall fit the control
> bar's responsive stacking.

> **NFR-04 — Accessibility:** The Export control and its format choices
> shall have visible text labels, shall be fully keyboard operable with a
> visible `:focus-visible` ring, and shall be distinguishable from one
> another and from surrounding controls without relying on color alone.

> **NFR-05 — Design fidelity:** The Export control shall use the existing
> Neutra design vocabulary (floating-plane / ghost-button / uppercase
> label tokens) as a calm, secondary affordance. It shall not use the
> aloe accent surface, which stays reserved for the single primary action
> ("Log a play"); export sits quietly beside it.

> **NFR-06 — Round-trip fidelity of values:** Files shall open in Excel,
> Google Sheets, and Numbers with correctly separated columns and no
> broken rows; values containing commas, double-quotes, newlines, or
> leading formula characters shall survive intact (modulo the FR-08
> apostrophe prefix), with no data loss or column drift.

---

## Out of Scope

- **Import** in any format — deferred to its own later feature. Precise,
  loss-free round-trip parsing of the joined Cast cell is that feature's
  concern, not this one.
- Choosing which columns to export, or exporting only the filtered /
  searched / sorted view — v1 is always the full archive with the fixed
  column set.
- Scheduled or automated exports, cloud backup, or emailing the file.
- Stats, summaries, or charts — the next, separate feature.
- Styled, multi-sheet, or richly-typed `.xlsx` (typed date/number cells,
  colors, frozen headers); v1 is a single plain worksheet of text cells.
- PDF or any format beyond CSV and `.xlsx`.
- Any change to the data model, entry flow, or list behaviour.

---

## Open Questions

None — all decisions are resolved in this document. Defaults chosen where
the brief was silent, and flagged to the user in the stage hand-back:

- **Full archive, always** — export ignores active search/filter/sort;
  rows follow the default list order (date desc, blanks last) (FR-03).
- **Fixed columns, cast in one cell** joined by `"; "` (FR-04/FR-05);
  no column picker in v1.
- **Date exported as ISO `YYYY-MM-DD`**; blanks stay blank (FR-06).
- **CSV = UTF-8 with BOM, CRLF rows, RFC 4180 quoting** (FR-07);
  **`.xlsx` = one plain worksheet, all cells as text** (FR-09).
- **Formula neutralization via a visible leading apostrophe** on any cell
  starting with `= + - @` / tab / CR, in both formats (FR-08); the
  visible apostrophe is the accepted, standard trade-off for safety.
- **Filename uses the generation date**: `instant-re-play-YYYY-MM-DD.ext`
  (FR-11).
- **Server-side generation via a Route Handler** returning the file with
  attachment headers (FR-10/FR-13); no third party involved (NFR-02).
- **The control is a persistent, calm secondary affordance** in the
  control bar, available even on an empty log (FR-01/FR-12).

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Export control presence (FR-01) | The list view shows an Export control in the control bar offering two labeled choices — CSV and Excel — each activatable; it is present with a full log and with an empty log. |
| QA-02 | Non-disruptive download (FR-02) | Activating CSV, then Excel, each starts a file download; the list's current search text, active filter, and sort are unchanged and the page does not navigate away. |
| QA-03 | Full archive, default order (FR-03) | With a search and a click-filter both active in the UI, an export still contains every saved play (not just the visible ones), one row each, ordered newest-date-first with undated entries last. |
| QA-04 | Columns and header (FR-04) | Both files' first row is exactly Name, Date seen, Venue, Director, Cast, in that order, followed by one row per play. |
| QA-05 | Cast cell join (FR-05) | A play with three actors shows them in entry order joined by "; " in a single Cast cell; a play with no actors shows an empty Cast cell. |
| QA-06 | Blank fields and date format (FR-06) | A play saved with only a name exports with empty Date seen, Venue, Director, and Cast cells (no placeholder text); a play with a date exports it as `YYYY-MM-DD`. |
| QA-07 | CSV escaping (FR-07) | A play whose title contains a comma, one whose venue contains a double-quote, and one whose value contains a newline all open in Excel/Sheets as single intact cells with no column drift or broken rows; the file is UTF-8 with a BOM and an accented actor name renders correctly in Excel. |
| QA-08 | Formula-injection neutralization (FR-08) | A title of `=1+1`, a venue of `+SUM(A1)`, a director of `-2`, and an actor of `@cmd` each open as literal text (apostrophe-prefixed), executing no formula, in both the CSV and the `.xlsx`, across Excel and Google Sheets. |
| QA-09 | Genuine xlsx (FR-09) | The `.xlsx` opens natively in Excel as one worksheet with the same rows/columns as the CSV, every cell shown as text with its exact value (no silent re-typing). |
| QA-10 | Delivery headers (FR-10) | The CSV response carries `Content-Type: text/csv; charset=utf-8` and the Excel response the OOXML spreadsheet media type; both carry `Content-Disposition: attachment` with the filename. |
| QA-11 | Filename (FR-11) | The downloaded files are named `instant-re-play-YYYY-MM-DD.csv` / `.xlsx` with the current date. |
| QA-12 | Empty-log export (FR-12) | With zero plays, exporting CSV and Excel each yields a valid, openable file containing only the header row and no data rows — no error. |
| QA-13 | Server-side, current data (FR-13) | Adding a play and then exporting includes that play; the file is produced by a server route reading the archive at request time, not from stale client state. |
| QA-14 | Performance (NFR-01) | With 1,000 seeded plays, both exports generate and begin downloading within a couple of seconds and the list UI does not visibly hang. |
| QA-15 | No third party (NFR-02) | Generating an export issues no network request to any host other than the app's own origin; no play data leaves the app's server/database. |
| QA-16 | Mobile usability (NFR-03) | At a 360px-wide viewport the Export control and both downloads are usable with no horizontal page scrolling. |
| QA-17 | Accessibility (NFR-04) | The Export control and its two format choices have visible labels, are reachable and operable by keyboard with a visible focus ring, and are distinguishable without relying on color. |
| QA-18 | Design fidelity (NFR-05) | The Export control renders as a calm secondary affordance using existing plane/ghost/label tokens; it does not use the aloe accent, which remains only on "Log a play". |
| QA-19 | Value round-trip fidelity (NFR-06) | Across Excel, Google Sheets, and Numbers, values with commas, quotes, newlines, and leading formula characters open with correct columns and no data loss (aside from the FR-08 apostrophe). |
