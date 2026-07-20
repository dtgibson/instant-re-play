# Schema — Data Export

## Path

**Incremental — no new persistence.** Export is a **read-only** feature over
the tables the Play Log already owns (`plays`, `play_actors`). It adds **no
new table, column, index, or constraint**, and requires **no migration**.
Nothing about the data model, entry flow, or list behaviour changes (PRD
"Out of Scope"). The only new artefacts are server code (a Route Handler +
pure serializer helpers) and one new dependency (`exceljs`); the database is
untouched.

> **Migration status: NONE.** `drizzle/0000_init.sql` remains the whole
> schema. `npm run db:generate` should produce no new migration for this
> feature; if it does, something has drifted and the diff must be rejected.

## Overview

The export reads the **entire** archive — every `plays` row with its ordered
`play_actors` — and serializes it to a downloadable CSV or XLSX file, one row
per play, columns **Name, Date seen, Venue, Director, Cast** (FR-03/FR-04).
The read is the Play Log's existing default-order list read; the new work is
purely *serialization + HTTP delivery*, both of which live above the data
layer.

Because the shape and order the export needs are exactly what
`listPlays(db)` already returns, the feature **reuses the existing
repository read** rather than introducing a new query — satisfying FR-13
("reads the archive with the existing repository") by construction and
keeping the default-order guarantee (FR-03) in one place.

## No Schema Change — Why

| Question | Answer |
|---|---|
| New tables? | No. |
| New columns? | No. |
| New indexes? | No — the existing `plays_date_seen_idx` already serves the export's ordering. |
| New constraints? | No. |
| Data migration / backfill? | No. |
| Destructive steps? | No — export never writes. It issues only `SELECT`s. |

The `play_actors` child-table design (chosen in the Play Log schema
explicitly "so CSV export later is a straightforward join") pays off here:
the ordered `position` column gives the Cast join its order for free.

## The Read (exact query for the full archive with ordered actors)

**Recommended: reuse `listPlays(db)` verbatim.** It already returns
`Play[]` in the export's required order, with each play's actors in
`position` order — nothing to add.

`src/db/repository.ts` → `listPlays()` issues these two statements and
stitches them in memory:

```sql
-- 1) every play, in the export's required default order (FR-03):
--    date seen desc, undated last, created_at breaking ties.
SELECT id, name, date_seen, venue, director, created_at, updated_at
FROM   plays
ORDER  BY date_seen DESC NULLS LAST, created_at DESC;

-- 2) every actor, grouped by play in stored position order (FR-05):
SELECT id, play_id, name, position
FROM   play_actors
ORDER  BY play_id, position;
```

The second result set is folded into a `Map<playId, string[]>` and each play
mapped to the domain `Play` object

```ts
interface Play { id; name; date /* "YYYY-MM-DD" | "" */; venue; director; actors: string[] }
```

where **NULL date/venue/director already surface as `""`** (via
`row.dateSeen ?? ""` etc. in `rowToPlay`). That maps directly onto FR-06
("blank optional fields export as empty cells") with no extra handling, and
`date` is already the stored ISO `YYYY-MM-DD` string FR-06 asks for.

**Optional single-statement variant (not required, for reference only).**
If a future refactor wants one round trip, the same result is a correlated
ordered aggregate — but at the ≤1,000-play scale (NFR-01) the two-query reuse
above is comfortably fast and avoids new code:

```sql
SELECT p.id, p.name, p.date_seen, p.venue, p.director,
       COALESCE(
         (SELECT string_agg(pa.name, '; ' ORDER BY pa.position)
          FROM play_actors pa WHERE pa.play_id = p.id),
         ''
       ) AS cast
FROM   plays p
ORDER  BY p.date_seen DESC NULLS LAST, p.created_at DESC;
```

Both driver back-ends run this identically — PGlite *is* Postgres, and
`string_agg` / `NULLS LAST` are standard Postgres. **v1 uses the
`listPlays` reuse.**

## Technical Approach

### Runtime & driver

Runs on **Node** (`pipeline.config.json` → `runtime: "node"`; Vercel Fluid
Compute), reading through the **existing PGlite/Neon driver factory**
`getDb()` in `src/db/index.ts` — PGlite locally and in tests, Neon serverless
in production, same schema and same queries either way. No new DB client, no
new connection path. The route must declare Node explicitly (exceljs is a
Node/Buffer library, not Edge-compatible):

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // read the archive at request time (FR-13)
```

### Route Handler(s)

A single Next.js App Router **Route Handler** at
`src/app/api/export/route.ts`, `GET /api/export?format=csv|xlsx`:

1. `const db = await getDb();`
2. `const plays = await listPlays(db);` — the full archive in default order.
3. Build the rows (below), serialize to the requested format.
4. Return a `Response` with the correct delivery headers (below).

`format` defaults to `csv`; an unrecognized value is treated as `csv` (or
`400` — implementer's call; the UI only ever sends `csv`/`xlsx`). The two
formats can share one handler branching on `format`, or be split into
`/api/export/csv` and `/api/export/xlsx` — either satisfies FR-01/FR-10; a
single query-param handler is the smaller surface and is recommended.

The **UI control** (FR-01/FR-02, NFR-03/04/05) is two ordinary links —
`<a href="/api/export?format=csv" download>` and `…format=xlsx` — in the
existing control bar beside "Log a play". Because a plain link navigation to
an `attachment` response triggers a download **without** navigating the page
away or touching React state, FR-02 (search/filter/sort untouched, no
navigation) is satisfied with no client JS. This is a UI concern; the data
layer exposes only the route.

### Row / column mapping

Pure, dependency-free, and unit-testable (Vitest) — factored into
`src/lib/export.ts` so both formats and both drivers share one definition:

- **Header row (always first, both formats):**
  `["Name", "Date seen", "Venue", "Director", "Cast"]` (FR-04).
- **One data row per play** (FR-03), in `listPlays` order:
  | Column | Source | Notes |
  |---|---|---|
  | Name | `play.name` | Always present (NOT NULL). |
  | Date seen | `play.date` | ISO `YYYY-MM-DD`, or `""` when unset (FR-06). |
  | Venue | `play.venue` | `""` when blank. |
  | Director | `play.director` | `""` when blank. |
  | Cast | `play.actors.join("; ")` | Ordered names joined by `"; "` (semicolon + space); **empty string when no actors** (FR-05). |
- **Every cell** — header cells are fixed safe literals; **every data cell**
  passes through the formula-injection neutralizer (below) **before** any
  format-specific quoting.

### CSV generation (RFC 4180 + injection-safe)

Generated **directly**, no library (FR-07/FR-08):

1. **Neutralize** each raw cell value (formula-injection rule below) — done
   first, on the raw string, so the guarding apostrophe is inside the quoted
   field (FR-08 explicitly: neutralize *before* RFC 4180 quoting).
2. **RFC 4180 quote/escape:** if the (neutralized) value contains a comma,
   double-quote, CR, or LF, wrap the whole field in double-quotes and double
   every embedded `"` → `""`. Otherwise emit it bare.
3. **Rows terminated with CRLF** (`\r\n`).
4. **UTF-8 with a leading BOM** (`﻿`) so Excel opens accented/diacritic
   names correctly (FR-07, QA-07).

### XLSX generation (`exceljs`, server-side)

Generated with **`exceljs`** — **MIT-licensed**, pure-JS, Node-native
(Buffer/stream based), so it runs on the Fluid Compute Node runtime and needs
**no** `serverExternalPackages` entry. **Install just-in-time at build**
(`npm install exceljs`; add to `dependencies`) — it is not yet in
`package.json`. Approach (FR-09):

- One `Workbook`, one `Worksheet`, `addRow(header)` then `addRow(...)` per
  play.
- **Every cell written as a text/string value** — assign the neutralized
  **string** to `cell.value` (exceljs stores a JS string as a string cell),
  and set the column/cell number format to text (`'@'`) as a belt-and-braces
  guard so the spreadsheet app never silently re-types a value (e.g. a date
  or number). This preserves the exact value and the FR-08 neutralization
  (FR-09, QA-09).
- Serialize with `await workbook.xlsx.writeBuffer()` → a `Buffer`/`Uint8Array`
  returned as the response body. No temp files, no disk.

### Formula-injection neutralization (both formats, FR-08)

A single shared function applied to **every** cell value in **both** formats:
if the value's **first character** is one of `=`, `+`, `-`, `@`, **tab
(U+0009)**, or **CR (U+000D)**, prefix a single leading apostrophe `'`. The
visible apostrophe is the accepted standard trade-off (PRD Open Questions).
This runs on the raw value **before** CSV quoting and before the exceljs cell
assignment, so no exported cell in either format is executable as a formula
in Excel, Google Sheets, or Numbers.

### Delivery headers (FR-10/FR-11)

| Format | `Content-Type` | `Content-Disposition` |
|---|---|---|
| CSV | `text/csv; charset=utf-8` | `attachment; filename="instant-re-play-YYYY-MM-DD.csv"` |
| XLSX | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `attachment; filename="instant-re-play-YYYY-MM-DD.xlsx"` |

**Filename scheme:** `instant-re-play-YYYY-MM-DD.<ext>` where `YYYY-MM-DD` is
the export's generation date, derived from the server clock as
`new Date().toISOString().slice(0, 10)` (UTC — stable and unambiguous)
(FR-11). The filename is plain ASCII, so no RFC 5987 `filename*` encoding is
needed.

The file is small even at the NFR-01 ceiling (1,000 plays ≈ low hundreds of
KB), so the body is built fully in memory and returned as one `Response` —
the "streaming download" the PRD calls for is the browser receiving it as an
`attachment`, not chunked transfer. No perceptible hang; well within the
"couple of seconds" budget.

### Empty log (FR-12)

`listPlays` returns `[]` for an empty archive. Serialization then emits the
**header row only** — a valid, openable file (CSV = BOM + one CRLF-terminated
header line; XLSX = one worksheet with a single header row). No special-case
branch, no error.

## Privacy (NFR-02)

The whole pipeline — read via `getDb()`, serialize, stream — runs inside the
app's own Node runtime and its own Postgres (PGlite/Neon). `exceljs` is a
local library that makes no network calls. **No play data touches any third
party, CDN, or external API**, preserving the product's single-user,
deployment-level privacy model.

## New Artefacts (none in the data layer)

| Artefact | Kind | DB impact |
|---|---|---|
| `src/app/api/export/route.ts` | Route Handler (GET) | Read-only via `listPlays`. |
| `src/lib/export.ts` | Pure serializers: `buildRows`, `neutralizeCell`, `toCsv`, `exportFilename` (unit-tested) | None. |
| `exceljs` dependency | XLSX writer (MIT, Node) | None. |

## Design Decisions

- **Reuse `listPlays`, don't add a query.** The export's required rows and
  order are identical to the list read; a second query path would be a place
  for the two to drift. FR-03's default order lives in exactly one place.
- **No schema change is the correct answer, stated loudly.** The child-table
  actor model already anticipated export; the ordered `position` gives the
  Cast join its order with no new structure.
- **Pure serializers, thin route.** CSV/neutralization/filename logic is
  driver- and HTTP-agnostic and fully covered by Vitest; the Route Handler is
  a thin adapter (read → serialize → headers). This keeps the security-
  critical logic (RFC 4180 + injection) testable in isolation.
- **`exceljs` over hand-rolled OOXML.** A genuine, natively-openable `.xlsx`
  (FR-09) is non-trivial to emit by hand; `exceljs` is MIT, Node-native, and
  needs no external services (NFR-02). CSV, by contrast, is simple enough to
  emit directly and avoids a heavier CSV dependency.
- **All XLSX cells as text.** Guarantees the FR-08 apostrophe and the exact
  stored value survive, and stops the spreadsheet re-typing an ISO date or a
  numeric-looking title (FR-09).

## Assumptions

- One deployment = one user; the export reflects the archive at request time
  (FR-13) with no isolation/locking concerns beyond the single writer.
- ≤1,000 plays with typical casts (NFR-01) — whole-file in-memory generation
  is well within budget; no pagination or true chunked streaming needed in
  v1.
- Import is a **separate later feature**; loss-free round-trip parsing of the
  joined `"; "` Cast cell is that feature's concern, not this one. This
  export writes a faithful, human-readable table, which the `play_actors`
  model can round-trip when import arrives — still with no schema change.
