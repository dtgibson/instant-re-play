/**
 * Full-pipeline smoke for Theatregoing Stats: seed a temp PGlite dir with a
 * crafted multi-year archive (ties, blanks, undated plays), read it back with
 * the real repository (`listPlays`), run the pure `computeStats`, and assert the
 * exact PRD figures end-to-end — total, distinct counts, year span, per-year
 * (undated excluded), top-5 ordering with a tie, blanks excluded, and the
 * empty-archive branch. Then assert the click-through contract:
 * `filterHref`/`parseFilter` round-trip (incl. a value with a space and comma)
 * and a malformed param → null. Exits non-zero on the first failed assertion.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createPgliteDatabaseAt } from "@/db";
import { listPlays, replaceAllPlays } from "@/db/repository";
import type { PlayInput } from "@/lib/play";
import { filterHref, parseFilter } from "@/lib/query";
import { computeStats } from "@/lib/stats";

let passed = 0;
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Multi-year archive: ties (National=Almeida=2 venues; Frecknall=Icke=2
// directors), blanks (p4 director, p6 venue, p7 director), and undated entries
// (p6, p7 — excluded from per-year, still counted toward most-seen).
const SEED: PlayInput[] = [
  {
    name: "p1",
    date: "2024-05-01",
    venue: "National Theatre",
    director: "Rebecca Frecknall",
    actors: ["Andrew Scott", "Ben Whishaw"],
  },
  {
    name: "p2",
    date: "2024-06-01",
    venue: "National Theatre",
    director: "Jamie Lloyd",
    actors: ["Andrew Scott"],
  },
  {
    name: "p3",
    date: "2023-01-01",
    venue: "Almeida Theatre",
    director: "Rebecca Frecknall",
    actors: ["Ben Whishaw", "Cate Blanchett"],
  },
  {
    name: "p4",
    date: "2023-02-01",
    venue: "Almeida Theatre",
    director: "",
    actors: [],
  },
  {
    name: "p5",
    date: "2022-01-01",
    venue: "Donmar Warehouse",
    director: "Robert Icke",
    actors: ["Andrew Scott"],
  },
  {
    name: "p6",
    date: "",
    venue: "",
    director: "Robert Icke",
    actors: ["Cate Blanchett"],
  },
  {
    name: "p7",
    date: "",
    venue: "Bridge Theatre",
    director: "",
    actors: [],
  },
];

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "instant-replay-stats-"));
  console.log(`\nStats smoke — temp PGlite dir: ${dir}\n`);
  const { db, close } = await createPgliteDatabaseAt(dir);

  try {
    // ---- EMPTY ARCHIVE (FR-17) --------------------------------------------
    console.log("EMPTY ARCHIVE — a well-formed zero shape");
    const emptyList = await listPlays(db);
    assert(emptyList.length === 0, "archive starts empty");
    const empty = computeStats(emptyList);
    assert(
      eq(empty, {
        total: 0,
        span: null,
        distinctVenues: 0,
        distinctDirectors: 0,
        distinctActors: 0,
        perYear: [],
        undatedCount: 0,
        topVenues: [],
        topDirectors: [],
        topActors: [],
      }),
      "computeStats([]) returns the zero shape (empty-state branch)",
    );

    // ---- SEED + READ + COMPUTE (FR-03) ------------------------------------
    console.log("\nSEED — write the crafted archive, read it back, compute");
    await replaceAllPlays(db, SEED);
    const list = await listPlays(db);
    assert(list.length === 7, "listPlays returns all 7 seeded entries");
    const s = computeStats(list);

    // ---- TOTALS & DISTINCT (FR-05) ----------------------------------------
    assert(s.total === 7, "total counts every entry (dated or not)");
    assert(s.distinctVenues === 4, "distinct venues excludes the blank (=4)");
    assert(
      s.distinctDirectors === 3,
      "distinct directors excludes the two blanks (=3)",
    );
    assert(s.distinctActors === 3, "distinct actors across the archive (=3)");

    // ---- SPAN (FR-06) ------------------------------------------------------
    assert(
      eq(s.span, { from: 2022, to: 2024 }),
      "span is earliest..latest dated year (2022..2024)",
    );

    // ---- PER YEAR + UNDATED (FR-07/08/15) ---------------------------------
    assert(
      eq(s.perYear, [
        { year: 2024, count: 2 },
        { year: 2023, count: 2 },
        { year: 2022, count: 1 },
      ]),
      "per-year is newest-first, undated excluded",
    );
    assert(s.undatedCount === 2, "undated count surfaced separately (=2)");

    // ---- MOST SEEN: ORDER, TIES, BLANKS (FR-09/10/11) ---------------------
    assert(
      eq(s.topVenues, [
        { value: "Almeida Theatre", count: 2 },
        { value: "National Theatre", count: 2 },
        { value: "Bridge Theatre", count: 1 },
        { value: "Donmar Warehouse", count: 1 },
      ]),
      "top venues: count-desc then name-asc, tie (2,2) shown equal, blank excluded",
    );
    assert(
      eq(s.topDirectors, [
        { value: "Rebecca Frecknall", count: 2 },
        { value: "Robert Icke", count: 2 },
        { value: "Jamie Lloyd", count: 1 },
      ]),
      "top directors: count tie broken by name",
    );
    assert(
      eq(s.topActors, [
        { value: "Andrew Scott", count: 3 },
        { value: "Ben Whishaw", count: 2 },
        { value: "Cate Blanchett", count: 2 },
      ]),
      "top actors: each once per play; undated p6 still counts Cate",
    );

    // ---- HARD CUT AT FIVE (FR-10) -----------------------------------------
    const many = computeStats(
      ["F", "E", "D", "C", "B", "A"].map((v) => ({
        id: v,
        name: v,
        date: "",
        venue: v,
        playwright: "",
        director: "",
        actors: [],
      })),
    );
    assert(
      eq(
        many.topVenues.map((r) => r.value),
        ["A", "B", "C", "D", "E"],
      ),
      "six tied venues hard-cut to the first five by name-asc",
    );

    // ---- CLICK-THROUGH CONTRACT (FR-13/14) --------------------------------
    console.log("\nCLICK-THROUGH — filterHref/parseFilter round-trip");
    const href = filterHref("venue", "Duke of York's, Theatre");
    assert(
      href === "/?filter=venue&value=Duke%20of%20York's%2C%20Theatre",
      "filterHref url-encodes a value with a space and a comma",
    );
    const qs = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    assert(
      eq(
        parseFilter({
          filter: qs.get("filter") ?? undefined,
          value: qs.get("value") ?? undefined,
        }),
        { type: "venue", value: "Duke of York's, Theatre" },
      ),
      "parseFilter round-trips the decoded params back to the exact ActiveFilter",
    );
    assert(
      parseFilter({ filter: "author", value: "X" }) === null,
      "a malformed filter type parses to null (log loads unfiltered)",
    );
    assert(
      parseFilter({ filter: "venue" }) === null,
      "a missing value parses to null",
    );

    console.log(`\nSTATS SMOKE PASS — ${passed} assertions passed.\n`);
  } finally {
    await close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("\nSTATS SMOKE FAIL:", error);
  process.exit(1);
});
