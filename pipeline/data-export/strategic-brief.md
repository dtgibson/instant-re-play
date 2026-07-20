# Strategic Brief — Data Export

## What We're Building
A one-click way to export the entire Play Log to a downloadable file,
in two formats — CSV (`.csv`) and Excel (`.xlsx`) — offered from a
small, calm Export control in the existing Play Log UI. One row per
play, with the ordered cast joined into a single Cast cell.

## Why Now
The Play Log is shipped and now holds real, hand-entered data the user
is starting to trust more than memory. That trust needs an exit door:
right now the only copy of a season's theatregoing lives in one
database, with no way for the user to hold their own backup or open
their history in the tools they already use (Excel, Sheets, Numbers).
Export is the smallest, highest-value next step — it makes the archive
genuinely *theirs* — and it deliberately ships before Import so the
user can get their data out first. The schema was already modelled with
this round-trip in mind (child `play_actors` table, delimiter-joined
cast), so the work is additive and low-risk.

## The User Problem
"I've logged two seasons of plays and I want a copy I can keep — a
spreadsheet I can back up, print, or open in Excel — without it being
locked inside this one app." Today there is no way to get the data out.
If the deployment ever broke or the user wanted to work with their log
elsewhere, the history would be stranded.

## Success Criteria
- From the Play Log, the user can export the full archive in one action
  and choose CSV or Excel; the browser downloads a file with a sensible
  dated name (`instant-re-play-YYYY-MM-DD.csv` / `.xlsx`).
- Each file has one row per play with columns Name, Date seen, Venue,
  Director, and Cast (the actors in stored order, joined in one cell
  with a clear delimiter); blank optional fields come through as empty
  cells, not placeholder text.
- Opening the CSV in Excel/Sheets and the `.xlsx` in Excel both show
  clean, correctly separated columns with no broken rows — commas,
  quotes, and newlines inside values survive intact.
- No cell value can execute as a formula when the file is opened in a
  spreadsheet app (formula-injection is neutralized).
- Exporting an empty log produces a valid file with the header row and
  no data rows — never an error.

## Scope
- Export the **entire** Play Log (not the current search/filter view);
  v1 export is a full backup of everything.
- Two formats from one control: CSV and Excel (`.xlsx`).
- Fixed column set, in order: Name, Date seen, Venue, Director, Cast.
- Server-generated download with correct `Content-Type` and
  `Content-Disposition: attachment` for each format, and a dated
  filename.
- A small Export affordance in the existing Play Log UI that fits the
  Neutra design system (calm, secondary — not a primary accent
  surface), offering the two formats.
- Safe output: CSV quoting/escaping of commas, quotes, and newlines,
  and formula-injection neutralization on every cell for both formats.
- Empty-log case handled as a valid header-only file.

## Out of Scope
- **Import** in any format — deferred to a later feature.
- Choosing which columns to export, or exporting only the filtered /
  searched view (v1 is always the full archive).
- Scheduled or automated exports, cloud backup, emailing the file.
- Stats, summaries, or charts — that is the next, separate feature.
- Any change to the data model, entry flow, or list behaviour.

## Key Decisions
- **Export before Import.** Getting data *out* is the trust-critical
  half and is far simpler; Import (with its parsing, validation, and
  merge questions) is its own later feature.
- **Full archive, not the current view.** v1 export is a backup, so it
  ignores active search/filter and always writes every play. "Export
  what's filtered" is a plausible later enhancement, explicitly not v1.
- **Fixed columns, cast in one cell.** Mirrors the shipped data model:
  one row per play, actors joined by a clear delimiter into a single
  Cast column (round-trips cleanly toward a future Import). No
  column-picker in v1.
- **Two real formats, not "CSV that Excel happens to open."** A genuine
  `.xlsx` is provided so the file opens natively in Excel with typed
  cells; CSV serves everything else and simple backup.
- **Formula-injection safety is a requirement, not a nicety.** Any cell
  beginning with `= + - @` (or leading tab/CR) is neutralized (e.g.
  apostrophe-prefixed) in *both* formats so opening the file can never
  execute a formula. Combined with correct CSV quoting/escaping, this is
  a named acceptance criterion the Auditor will check.
- **Calm, secondary UI.** The Export control is a restrained,
  non-accent affordance in the existing list surface — aloe stays
  reserved for the one true primary action; export sits quietly beside
  it and fits the existing plane/label vocabulary.
