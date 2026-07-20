import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildRows,
  CAST_DELIMITER,
  CONTENT_TYPE,
  CSV_BOM,
  EXPORT_HEADERS,
  exportFilename,
  isExportFormat,
  neutralizeCell,
  playToRow,
  toCsv,
  toXlsxBuffer,
} from "@/lib/export";
import type { Play } from "@/lib/play";

function makePlay(partial: Partial<Play> & { name: string }): Play {
  return {
    id: partial.id ?? "id",
    name: partial.name,
    date: partial.date ?? "",
    venue: partial.venue ?? "",
    playwright: partial.playwright ?? "",
    director: partial.director ?? "",
    actors: partial.actors ?? [],
  };
}

/** Split a CSV string (BOM-stripped) into physical CRLF-delimited lines. */
function csvLines(csv: string): string[] {
  return csv.slice(CSV_BOM.length).split("\r\n");
}

describe("neutralizeCell (FR-08 — formula-injection)", () => {
  it("prefixes an apostrophe to any leading formula trigger", () => {
    expect(neutralizeCell("=1+1")).toBe("'=1+1");
    expect(neutralizeCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(neutralizeCell("-2")).toBe("'-2");
    expect(neutralizeCell("@cmd")).toBe("'@cmd");
    expect(neutralizeCell("\tTabbed")).toBe("'\tTabbed"); // leading TAB (U+0009)
    expect(neutralizeCell("\rReturn")).toBe("'\rReturn"); // leading CR (U+000D)
  });

  it("leaves safe values untouched", () => {
    expect(neutralizeCell("Hamlet")).toBe("Hamlet");
    expect(neutralizeCell("2024-01-05")).toBe("2024-01-05");
    expect(neutralizeCell("a=b+c")).toBe("a=b+c"); // trigger only matters as first char
    expect(neutralizeCell("")).toBe(""); // empty stays empty (blank cell)
    expect(neutralizeCell("O'Brien")).toBe("O'Brien");
  });
});

describe("playToRow / buildRows (FR-04/FR-05/FR-06)", () => {
  it("maps a play to the fixed column order with the cast joined by '; '", () => {
    const row = playToRow(
      makePlay({
        name: "Hamlet",
        date: "2024-01-05",
        venue: "Almeida",
        playwright: "William Shakespeare",
        director: "Robert Icke",
        actors: ["Andrew Scott", "Juliet Stevenson"],
      }),
    );
    expect(row).toEqual([
      "Hamlet",
      "2024-01-05",
      "Almeida",
      "William Shakespeare",
      "Robert Icke",
      "Andrew Scott; Juliet Stevenson",
    ]);
    expect(CAST_DELIMITER).toBe("; ");
  });

  it("leaves blank optional fields as empty strings and an empty cast blank", () => {
    expect(playToRow(makePlay({ name: "Solo" }))).toEqual([
      "Solo",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("prepends the fixed header row, one data row per play", () => {
    const rows = buildRows([makePlay({ name: "A" }), makePlay({ name: "B" })]);
    expect(rows[0]).toEqual([...EXPORT_HEADERS]);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe("A");
    expect(rows[2][0]).toBe("B");
  });
});

describe("toCsv (FR-07 — RFC 4180 + BOM + CRLF)", () => {
  it("emits a valid header-only file for an empty archive (FR-12)", () => {
    const csv = toCsv([]);
    expect(csv).toBe(
      `${CSV_BOM}Name,Date seen,Venue,Playwright,Director,Cast\r\n`,
    );
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csvLines(csv)).toEqual([
      "Name,Date seen,Venue,Playwright,Director,Cast",
      "",
    ]);
  });

  it("begins with a UTF-8 BOM and terminates rows with CRLF", () => {
    const csv = toCsv([makePlay({ name: "Hamlet", date: "2024-01-05" })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.includes("\r\n")).toBe(true);
    const lines = csvLines(csv);
    expect(lines[1]).toBe("Hamlet,2024-01-05,,,,");
    expect(lines[2]).toBe(""); // trailing CRLF
  });

  it("quotes fields with commas and doubles embedded quotes", () => {
    const csv = toCsv([
      makePlay({ name: "Angels in America, Part One", venue: 'The "Old" Vic' }),
    ]);
    expect(csv).toContain('"Angels in America, Part One"');
    expect(csv).toContain('"The ""Old"" Vic"');
  });

  it("quotes a field containing a newline (keeping the row intact)", () => {
    const csv = toCsv([makePlay({ name: "Two", venue: "Court\nyard" })]);
    expect(csv).toContain('"Court\nyard"');
  });

  it("neutralizes every leading-formula cell BEFORE quoting (FR-08)", () => {
    const csv = toCsv([
      makePlay({
        name: "=1+1",
        venue: "+SUM(A1)",
        playwright: "@author",
        director: "-2",
        actors: ["@cmd", "Second"],
      }),
    ]);
    const dataLine = csvLines(csv)[1];
    expect(dataLine).toBe("'=1+1,,'+SUM(A1),'@author,'-2,'@cmd; Second");
  });

  it("wraps AND neutralizes a value that both injects and needs quoting", () => {
    // A CR-leading value trips both FR-08 (apostrophe) and FR-07 (quote on CR).
    const csv = toCsv([makePlay({ name: "=x,y" })]);
    // '=x,y' -> neutralize -> "'=x,y" -> contains a comma -> quoted.
    expect(csv).toContain('"\'=x,y"');
  });
});

describe("toXlsxBuffer (FR-09 — genuine OOXML, all TEXT cells)", () => {
  async function readBack(buffer: ArrayBuffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb.worksheets[0];
  }

  it("writes a header-only worksheet for an empty archive (FR-12)", async () => {
    const ws = await readBack(await toXlsxBuffer([]));
    expect(ws.actualRowCount).toBe(1);
    expect(EXPORT_HEADERS.map((_, i) => ws.getRow(1).getCell(i + 1).value)).toEqual([
      ...EXPORT_HEADERS,
    ]);
  });

  it("writes every cell as a neutralized TEXT value with the '@' format", async () => {
    const ws = await readBack(
      await toXlsxBuffer([
        makePlay({
          name: "=1+1",
          date: "2024-01-05",
          venue: "+SUM(A1)",
          playwright: "Tennessee Williams",
          director: "Robert Icke",
          actors: ["Andrew Scott", "Juliet Stevenson"],
        }),
      ]),
    );
    const row = ws.getRow(2);

    // Every populated cell is a string (not a formula, not a re-typed number).
    for (let c = 1; c <= 6; c++) {
      expect(typeof row.getCell(c).value).toBe("string");
      expect(row.getCell(c).numFmt).toBe("@");
    }

    expect(row.getCell(1).value).toBe("'=1+1"); // FR-08 neutralized in xlsx
    expect(row.getCell(2).value).toBe("2024-01-05"); // ISO date kept as text (not a Date)
    expect(row.getCell(2).value).not.toBeInstanceOf(Date);
    expect(row.getCell(3).value).toBe("'+SUM(A1)");
    expect(row.getCell(4).value).toBe("Tennessee Williams"); // playwright column
    expect(row.getCell(6).value).toBe("Andrew Scott; Juliet Stevenson"); // cast now col 6
  });
});

describe("exportFilename / delivery metadata (FR-10/FR-11)", () => {
  it("builds a dated, per-format filename in UTC", () => {
    const at = new Date("2026-07-19T09:00:00Z");
    expect(exportFilename("csv", at)).toBe("instant-re-play-2026-07-19.csv");
    expect(exportFilename("xlsx", at)).toBe("instant-re-play-2026-07-19.xlsx");
  });

  it("derives the date from the UTC calendar day of the server clock", () => {
    // 23:30 at UTC-05:00 is already the next UTC day.
    const at = new Date("2026-07-19T23:30:00-05:00");
    expect(exportFilename("csv", at)).toBe("instant-re-play-2026-07-20.csv");
  });

  it("exposes the correct media types and narrows the format param", () => {
    expect(CONTENT_TYPE.csv).toBe("text/csv; charset=utf-8");
    expect(CONTENT_TYPE.xlsx).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(isExportFormat("csv")).toBe(true);
    expect(isExportFormat("xlsx")).toBe(true);
    expect(isExportFormat("json")).toBe(false);
    expect(isExportFormat(null)).toBe(false);
  });
});
