# Trying Data Export

Export downloads your **entire** Play Log as a file, in two formats — **CSV**
(`.csv`) and **Excel** (`.xlsx`). It is a full backup: it always writes the whole
archive, ignoring any active search, filter, or sort. This guide assumes you can
already run the app (see `pipeline/play-log/how-to-run.md`).

## 1. Start the app

```bash
npm install      # once — pulls in exceljs, the .xlsx writer
npm run dev
```

Open **http://localhost:3000**. To try it against a populated archive, load the
sample log first (`npm run seed`, then restart `npm run dev`).

## 2. Export from the control bar

In the control bar at the top, the calm **Export** button sits just to the left
of the green **Log a play** button.

1. Click **Export** (or focus it and press **↓ / Enter / Space**). A small
   floating menu opens from the button.
2. Choose **Download CSV** or **Download Excel (.xlsx)**. Your browser downloads
   a file named `instant-re-play-YYYY-MM-DD.csv` / `.xlsx` (today's date).
3. The list stays exactly as it was — your search text, active filter, and sort
   are untouched, and the page does not navigate away.

The caption at the bottom of the menu states the scope live: *"Your whole
archive — all N plays, not just what's shown"* (and an empty-archive line when
you have no plays yet — exporting still gives you a valid header-only file).

Keyboard: **↑/↓/Home/End** cycle the two choices, **Tab** stays trapped between
them, **Esc** closes and returns focus to the Export button, and an outside
click or a viewport resize dismisses the menu. The open animation has a full
`prefers-reduced-motion` fallback. The control is usable at a 360px viewport.

## 3. What's in the file

- One row per play. Columns, in order: **Name, Date seen, Venue, Director, Cast**
  (a header row first).
- Cast is the ordered actor names joined into one cell with `"; "`.
- Blank optional fields are empty cells; dates are ISO `YYYY-MM-DD`.
- **CSV** is UTF-8 with a BOM, CRLF rows, and RFC 4180 quoting (accents, commas,
  quotes, and newlines survive intact).
- **XLSX** is a single plain worksheet with every cell written as text.
- **Formula-injection is neutralized** on every cell of both formats: a value
  beginning with `= + - @` (or a leading tab/CR) gets a single leading
  apostrophe so it can never run as a formula in Excel, Sheets, or Numbers.

## 4. Verify it end-to-end

```bash
npm run test          # vitest — unit tests for the export lib (tests/export.test.ts)
npm run smoke:export  # full pipeline: seed a temp DB → export CSV + XLSX → assert
```

The route can also be hit directly (it is generated server-side, at request
time, reading the archive with the existing repository):

```
GET /api/export?format=csv    → text/csv; charset=utf-8,  attachment
GET /api/export?format=xlsx   → OOXML spreadsheet,        attachment
GET /api/export?format=json   → 400 (only csv/xlsx are valid)
```

## Conventions established

- **Origin-aware dropdown menu** (trigger + `role="menu"` plane): a new reusable
  interaction pattern, built with existing Neutra tokens — `.export-wrap`,
  `.export-btn`, `.export-menu` in `src/app/globals.css`, driven by
  `src/components/export-menu.tsx`. Flagged in the design-spec for folding into
  `design-system.md` as a standing pattern.
- **Pure serializers, thin route.** All export logic lives in one unit-testable
  module, `src/lib/export.ts` (`buildRows`, `neutralizeCell`, `toCsv`,
  `toXlsxBuffer`, `exportFilename`). The Route Handler
  `src/app/api/export/route.ts` is a thin adapter that reuses the existing
  `listPlays` read (no new query, no schema change) and attaches delivery
  headers. It declares `runtime = "nodejs"` (exceljs is Node/Buffer-based) and
  `dynamic = "force-dynamic"` (read the archive at request time).
- **`exceljs`** (MIT, Node-native) is the only new dependency, imported
  just-in-time inside `toXlsxBuffer` so the CSV path never loads it.
