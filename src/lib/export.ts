/**
 * Data Export — the single source of truth for turning the archive into a
 * downloadable file (FR-03..FR-12). Pure, driver- and HTTP-agnostic, so both
 * output formats and the security-critical logic (RFC 4180 quoting + formula-
 * injection neutralization) are unit-testable in isolation. The Route Handler
 * (`src/app/api/export/route.ts`) is a thin adapter: read via the repository,
 * call in here, attach delivery headers.
 *
 * Column order is fixed (FR-04): Name, Date seen, Venue, Playwright, Director,
 * Cast. One row per play (FR-03), in the order `listPlays` already returns (date
 * seen DESC, undated last). Blank optional fields become empty cells (FR-06);
 * the ordered cast joins with "; " (FR-05). An empty archive still yields a
 * valid header-only file (FR-12).
 */

import type { Play } from "./play";

/** FR-04: the fixed header row, first row of every file, both formats. */
export const EXPORT_HEADERS = [
  "Name",
  "Date seen",
  "Venue",
  "Playwright",
  "Director",
  "Cast",
] as const;

/** FR-05: the delimiter that joins ordered actor names into one Cast cell. */
export const CAST_DELIMITER = "; ";

/** FR-07: a UTF-8 byte-order mark so Excel opens accented names correctly. */
export const CSV_BOM = "﻿";

/** FR-07: RFC 4180 rows are CRLF-terminated. */
const CRLF = "\r\n";

/** FR-10: delivery media types, keyed by export format. */
export const CONTENT_TYPE = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export type ExportFormat = keyof typeof CONTENT_TYPE;

/** Narrowing guard for the `?format=` query param (the UI only ever sends these). */
export function isExportFormat(value: string | null): value is ExportFormat {
  return value === "csv" || value === "xlsx";
}

/**
 * FR-08 (SECURITY-CRITICAL): neutralize a single cell against spreadsheet
 * formula injection. Any value whose first character is `=`, `+`, `-`, `@`, a
 * TAB (U+0009), or a CR (U+000D) is prefixed with a single leading apostrophe
 * so it can never be interpreted as a formula in Excel, Google Sheets, or
 * Numbers. Applied to EVERY cell of BOTH formats, and — for CSV — BEFORE RFC
 * 4180 quoting so the guarding apostrophe lands inside the quoted field.
 */
export function neutralizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Map a play to its raw (un-neutralized) ordered cell values (FR-04..FR-06). */
export function playToRow(play: Play): string[] {
  return [
    play.name,
    play.date,
    play.venue,
    play.playwright,
    play.director,
    play.actors.join(CAST_DELIMITER),
  ];
}

/**
 * The full table as raw string cells: the header row first (FR-04), then one
 * row per play (FR-03). Cells are NOT yet neutralized or quoted — each format
 * applies FR-08 (and, for CSV, FR-07) itself. An empty archive yields just the
 * header row (FR-12).
 */
export function buildRows(plays: Play[]): string[][] {
  return [[...EXPORT_HEADERS], ...plays.map(playToRow)];
}

/** FR-07: RFC 4180-quote a single (already neutralized) field. */
function csvField(raw: string): string {
  const value = neutralizeCell(raw);
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * FR-07/FR-08: serialize the archive to an RFC 4180 CSV string — every cell
 * neutralized then quoted/escaped, rows CRLF-terminated, prefixed with a UTF-8
 * BOM. Never errors; an empty archive returns the header row alone (FR-12).
 */
export function toCsv(plays: Play[]): string {
  const body = buildRows(plays)
    .map((row) => row.map(csvField).join(","))
    .join(CRLF);
  return `${CSV_BOM}${body}${CRLF}`;
}

/**
 * FR-09: serialize the archive to a genuine single-worksheet OOXML `.xlsx`
 * workbook. Every cell is written as a TEXT (string) value with an explicit
 * text number format (`@`) so no value — an ISO date, a numeric-looking title —
 * is silently re-typed, and the FR-08 neutralization survives intact. Returns
 * the workbook as an in-memory Buffer (no temp files, no disk). exceljs is
 * imported just-in-time so the CSV path never loads it.
 */
export async function toXlsxBuffer(plays: Play[]): Promise<ArrayBuffer> {
  // exceljs is CommonJS; normalize the interop shape so `.Workbook` resolves
  // whether the loader exposes it as a namespace member or under `default`.
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Plays");

  for (const row of buildRows(plays)) {
    const added = worksheet.addRow(row.map(neutralizeCell));
    added.eachCell({ includeEmpty: true }, (cell) => {
      // Belt-and-braces: text format guards against any spreadsheet app
      // re-typing a value, and a string cell.value keeps it text (FR-09).
      cell.numFmt = "@";
      cell.value = cell.value == null ? "" : String(cell.value);
    });
  }

  // exceljs types its buffer as `interface Buffer extends ArrayBuffer`; at
  // runtime this is a Node Buffer — a valid Response BodyInit either way.
  return workbook.xlsx.writeBuffer();
}

/**
 * FR-11: the download filename, `instant-re-play-YYYY-MM-DD.<ext>`, where the
 * date is the export's generation date on the server clock in UTC (stable and
 * unambiguous). Plain ASCII, so no RFC 5987 `filename*` encoding is needed.
 */
export function exportFilename(
  format: ExportFormat,
  now: Date = new Date(),
): string {
  return `instant-re-play-${now.toISOString().slice(0, 10)}.${format}`;
}
