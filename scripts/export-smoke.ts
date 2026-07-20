/**
 * Full-pipeline smoke for Data Export: seed a temp PGlite dir, read the archive
 * with the real repository (`listPlays`), run the export lib to produce CSV +
 * XLSX in memory, and assert the PRD guarantees end-to-end — RFC 4180 quoting,
 * UTF-8 BOM + CRLF, formula-injection neutralization on every cell, cast joined
 * with "; ", ISO dates, blank cells, empty-log header-only, and (parsing the
 * xlsx back with exceljs) that every cell is text and neutralized. Exits
 * non-zero on the first failed assertion.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";

import { createPgliteDatabaseAt } from "@/db";
import { listPlays, replaceAllPlays } from "@/db/repository";
import {
  CSV_BOM,
  EXPORT_HEADERS,
  exportFilename,
  toCsv,
  toXlsxBuffer,
} from "@/lib/export";
import type { PlayInput } from "@/lib/play";

let passed = 0;
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

// Edge-case archive: formula-injection vectors that survive normalization, plus
// comma / quote / newline in values, a joined cast, an ISO date, and a
// name-only entry with all optionals blank.
const SEED: PlayInput[] = [
  {
    name: "=1+1",
    date: "2024-03-01",
    venue: "+SUM(A1)",
    director: "-2",
    actors: ["@cmd", "Second Actor"],
  },
  {
    name: "Angels in America, Part One",
    date: "2023-05-10",
    venue: 'The "Old" Vic',
    playwright: "Tony Kushner",
    director: "Marianne Elliott",
    actors: ["Andrew Garfield", "Nathan Lane", "Denise Gough"],
  },
  {
    name: "Newline Venue Play",
    date: "",
    venue: "Courtyard\nTheatre",
    director: "",
    actors: [],
  },
  {
    name: "Solo Piece",
    date: "",
    venue: "",
    director: "",
    actors: [],
  },
];

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "instant-replay-export-"));
  console.log(`\nExport smoke — temp PGlite dir: ${dir}\n`);
  const { db, close } = await createPgliteDatabaseAt(dir);

  try {
    // ---- EMPTY LOG (FR-12) -------------------------------------------------
    console.log("EMPTY LOG — valid header-only files, never an error");
    const emptyList = await listPlays(db);
    assert(emptyList.length === 0, "archive starts empty");
    const emptyCsv = toCsv(emptyList);
    assert(emptyCsv.startsWith(CSV_BOM), "empty CSV begins with a UTF-8 BOM");
    assert(
      emptyCsv === `${CSV_BOM}${EXPORT_HEADERS.join(",")}\r\n`,
      "empty CSV is exactly the BOM + header row + CRLF (no data rows)",
    );
    const emptyXlsx = await toXlsxBuffer(emptyList);
    const ewb = new ExcelJS.Workbook();
    await ewb.xlsx.load(emptyXlsx);
    assert(
      ewb.worksheets[0].actualRowCount === 1,
      "empty XLSX has exactly one row (the header)",
    );

    // ---- SEED + READ (FR-03/FR-13) ----------------------------------------
    console.log("\nSEED — write the edge-case archive, read it back");
    await replaceAllPlays(db, SEED);
    const list = await listPlays(db);
    assert(list.length === 4, "listPlays returns all 4 seeded entries");
    assert(
      list[0].date >= list[1].date,
      "default order is date-desc (dated entries first)",
    );
    assert(
      list[2].date === "" && list[3].date === "",
      "undated entries sort last (blanks last)",
    );

    // ---- CSV (FR-05/06/07/08) ---------------------------------------------
    console.log("\nCSV — RFC 4180 + BOM + CRLF + neutralization");
    const csv = toCsv(list);
    assert(csv.startsWith(CSV_BOM), "CSV begins with a UTF-8 BOM (FR-07)");
    assert(csv.includes("\r\n"), "CSV rows are CRLF-terminated (FR-07)");
    assert(
      csv.startsWith(
        `${CSV_BOM}Name,Date seen,Venue,Playwright,Director,Cast\r\n`,
      ),
      "first CSV row is the fixed header incl. Playwright (FR-04)",
    );
    assert(
      csv.includes("'=1+1,2024-03-01,'+SUM(A1),,'-2,'@cmd; Second Actor"),
      "every leading-formula cell is apostrophe-neutralized, blank playwright is an empty cell, cast joined by '; ' (FR-05/FR-08)",
    );
    assert(
      csv.includes("Tony Kushner"),
      "a real playwright value is carried into the export column",
    );
    assert(
      csv.includes('"Angels in America, Part One"'),
      "a title with a comma is wrapped in double-quotes (FR-07)",
    );
    assert(
      csv.includes('"The ""Old"" Vic"'),
      "a venue with double-quotes is quoted with quotes doubled (FR-07)",
    );
    assert(
      csv.includes('"Courtyard\nTheatre"'),
      "a value with a newline is wrapped in double-quotes (FR-07)",
    );
    assert(
      csv.includes("Andrew Garfield; Nathan Lane; Denise Gough"),
      "ordered cast is joined with '; ' in a single cell (FR-05)",
    );
    assert(csv.includes("2024-03-01"), "date is written in ISO YYYY-MM-DD (FR-06)");
    assert(
      csv.includes("Solo Piece,,,,,\r\n"),
      "a name-only entry exports with five trailing empty cells (FR-06)",
    );

    // ---- XLSX (FR-09) ------------------------------------------------------
    console.log("\nXLSX — genuine OOXML, every cell TEXT + neutralized");
    const xlsx = await toXlsxBuffer(list);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx);
    const ws = wb.worksheets[0];
    assert(
      ws.actualRowCount === 5,
      "XLSX has 1 header + 4 data rows",
    );
    const header = EXPORT_HEADERS.map((_, i) => ws.getRow(1).getCell(i + 1).value);
    assert(
      JSON.stringify(header) === JSON.stringify([...EXPORT_HEADERS]),
      "XLSX header row matches the fixed columns (FR-04)",
    );
    // Row 2 is the "=1+1" entry (newest date 2024-03-01).
    const nameCell = ws.getRow(2).getCell(1);
    assert(
      typeof nameCell.value === "string",
      "an XLSX data cell is a text/string value (FR-09)",
    );
    assert(nameCell.value === "'=1+1", "the '=1+1' title is neutralized in XLSX (FR-08)");
    assert(nameCell.numFmt === "@", "the cell carries the text number format '@' (FR-09)");
    const venueCell = ws.getRow(2).getCell(3);
    assert(venueCell.value === "'+SUM(A1)", "the '+SUM(A1)' venue is neutralized in XLSX");
    const dateCell = ws.getRow(2).getCell(2);
    assert(
      typeof dateCell.value === "string" && dateCell.value === "2024-03-01",
      "an ISO date is stored as a string, not re-typed to a Date (FR-09)",
    );

    // ---- FILENAME (FR-11) --------------------------------------------------
    console.log("\nFILENAME — dated, per format");
    const fixed = new Date("2026-07-19T09:00:00Z");
    assert(
      exportFilename("csv", fixed) === "instant-re-play-2026-07-19.csv",
      "CSV filename is instant-re-play-YYYY-MM-DD.csv (FR-11)",
    );
    assert(
      exportFilename("xlsx", fixed) === "instant-re-play-2026-07-19.xlsx",
      "XLSX filename is instant-re-play-YYYY-MM-DD.xlsx (FR-11)",
    );

    console.log(`\nEXPORT SMOKE PASS — ${passed} assertions passed.\n`);
  } finally {
    await close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("\nEXPORT SMOKE FAIL:", error);
  process.exit(1);
});
