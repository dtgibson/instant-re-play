/**
 * Full-pipeline smoke for the additive Playwright field + self-sourced
 * autocomplete: seed a temp PGlite dir (which applies migrations 0000 + 0001,
 * the additive ADD COLUMN), then exercise the field end-to-end through the real
 * repository, query, export, and suggest modules — create with a playwright,
 * read it back, filter/search by it, carry it into the CSV export, edit it, and
 * confirm a pre-existing (playwright-less) row reads blank. Also asserts the
 * autocomplete suggestion logic (distinct prior values, substring, no
 * auto-correct). Exits non-zero on the first failed assertion.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createPgliteDatabaseAt } from "@/db";
import { createPlay, getPlay, listPlays, updatePlay } from "@/db/repository";
import { toCsv } from "@/lib/export";
import { filterAndSortPlays } from "@/lib/query";
import { collectFieldValues, suggestValues } from "@/lib/suggest";

let passed = 0;
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "instant-replay-pw-smoke-"));
  console.log(`\nPlaywright-field smoke — temp PGlite dir: ${dir}\n`);
  const { db, close } = await createPgliteDatabaseAt(dir);

  try {
    console.log("MIGRATE — a pre-existing row created without a playwright");
    const legacy = await createPlay(db, {
      name: "A Midsummer Night's Dream",
      date: "",
      venue: "",
      director: "",
      actors: [],
    }); // playwright omitted — the pre-migration shape
    assert(legacy.playwright === "", "a row with no playwright reads back blank");

    console.log("\nCREATE — a play WITH a playwright (trimmed)");
    const created = await createPlay(db, {
      name: "A Streetcar Named Desire",
      date: "2024-01-12",
      venue: "Almeida Theatre",
      playwright: "  Tennessee Williams  ",
      director: "Rebecca Frecknall",
      actors: ["Paul Mescal", "Patsy Ferran"],
    });
    assert(created.playwright === "Tennessee Williams", "playwright is trimmed on write");
    const readBack = await getPlay(db, created.id);
    assert(
      readBack?.playwright === "Tennessee Williams",
      "playwright survives a read-back from Postgres",
    );

    console.log("\nFILTER — exact, case-sensitive click-to-filter on playwright");
    const all = await listPlays(db);
    const byPw = filterAndSortPlays(all, {
      sort: { field: "date", dir: "desc" },
      search: "",
      filter: { type: "playwright", value: "Tennessee Williams" },
    });
    assert(
      byPw.length === 1 && byPw[0].name === "A Streetcar Named Desire",
      "playwright filter returns exactly the matching play",
    );
    const byPwCase = filterAndSortPlays(all, {
      sort: { field: "date", dir: "desc" },
      search: "",
      filter: { type: "playwright", value: "tennessee williams" },
    });
    assert(byPwCase.length === 0, "playwright filter is case-sensitive (a variant matches nothing)");

    console.log("\nSEARCH — free-text search reaches the playwright");
    const bySearch = filterAndSortPlays(all, {
      sort: { field: "date", dir: "desc" },
      search: "tennessee",
      filter: null,
    });
    assert(
      bySearch.length === 1 && bySearch[0].name === "A Streetcar Named Desire",
      "search 'tennessee' finds the play by its playwright (case-insensitive)",
    );

    console.log("\nEXPORT — the CSV carries a Playwright column with the value");
    const csv = toCsv(all);
    assert(
      csv.includes("Name,Date seen,Venue,Playwright,Director,Cast"),
      "CSV header includes the Playwright column between Venue and Director",
    );
    assert(csv.includes("Tennessee Williams"), "the playwright value appears in the CSV");

    console.log("\nEDIT — the playwright is replaced on update");
    const edited = await updatePlay(db, created.id, {
      name: created.name,
      date: created.date,
      venue: created.venue,
      playwright: "T. Williams",
      director: created.director,
      actors: created.actors,
    });
    assert(edited.playwright === "T. Williams", "playwright is replaced on edit");
    const editedRead = await getPlay(db, created.id);
    assert(editedRead?.playwright === "T. Williams", "the replaced playwright persists");

    console.log("\nAUTOCOMPLETE — distinct prior values, substring, never invents");
    await createPlay(db, {
      name: "The Glass Menagerie",
      date: "2023-02-02",
      venue: "Duke of York's Theatre",
      playwright: "T. Williams",
      director: "Josie Rourke",
      actors: [],
    });
    const list2 = await listPlays(db);
    const pwValues = collectFieldValues(list2, "playwright");
    assert(
      pwValues.filter((v) => v === "T. Williams").length === 1,
      "collectFieldValues returns DISTINCT prior playwrights (no duplicates)",
    );
    const venueValues = collectFieldValues(list2, "venue");
    assert(
      new Set(venueValues).size === venueValues.length,
      "distinct venues (dedupe of the repeated Duke of York's / Almeida)",
    );
    const hits = suggestValues(pwValues, "will");
    assert(
      hits.includes("T. Williams"),
      "typing 'will' surfaces the prior playwright by substring",
    );
    const miss = suggestValues(pwValues, "Chekhov");
    assert(
      miss.length === 0,
      "an unseen fragment returns nothing, so the typed value saves as-is (no auto-correct)",
    );

    console.log(`\nPLAYWRIGHT SMOKE PASS — ${passed} assertions passed.\n`);
  } finally {
    await close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("\nPLAYWRIGHT SMOKE FAIL:", error);
  process.exit(1);
});
