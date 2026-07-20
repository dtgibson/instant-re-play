import { describe, expect, it } from "vitest";

import type { Play } from "@/lib/play";
import { matchesFilter } from "@/lib/query";
import { computeStats } from "@/lib/stats";

function play(p: Partial<Play> & { name: string }): Play {
  return {
    id: p.name,
    name: p.name,
    date: p.date ?? "",
    venue: p.venue ?? "",
    playwright: p.playwright ?? "",
    director: p.director ?? "",
    actors: p.actors ?? [],
  };
}

// A multi-year archive with ties, blanks, and undated entries — the fixture the
// PRD's QA table is written against.
const ARCHIVE: Play[] = [
  play({
    name: "p1",
    date: "2024-05-01",
    venue: "National Theatre",
    director: "Rebecca Frecknall",
    actors: ["Andrew Scott", "Ben Whishaw"],
  }),
  play({
    name: "p2",
    date: "2024-06-01",
    venue: "National Theatre",
    director: "Jamie Lloyd",
    actors: ["Andrew Scott"],
  }),
  play({
    name: "p3",
    date: "2023-01-01",
    venue: "Almeida Theatre",
    director: "Rebecca Frecknall",
    actors: ["Ben Whishaw", "Cate Blanchett"],
  }),
  play({
    name: "p4",
    date: "2023-02-01",
    venue: "Almeida Theatre",
    director: "", // blank director — excluded
    actors: [],
  }),
  play({
    name: "p5",
    date: "2022-01-01",
    venue: "Donmar Warehouse",
    director: "Robert Icke",
    actors: ["Andrew Scott"],
  }),
  play({
    name: "p6",
    date: "", // undated — excluded from per-year, still counts toward most-seen
    venue: "", // blank venue — excluded
    director: "Robert Icke",
    actors: ["Cate Blanchett"],
  }),
  play({
    name: "p7",
    date: "", // undated
    venue: "Bridge Theatre",
    director: "", // blank director
    actors: [],
  }),
];

describe("computeStats — totals & distinct (FR-05)", () => {
  const s = computeStats(ARCHIVE);

  it("counts every entry as the total (dated or not)", () => {
    expect(s.total).toBe(7);
  });

  it("distinct counts exclude blank values", () => {
    expect(s.distinctVenues).toBe(4); // National, Almeida, Donmar, Bridge (p6 blank excluded)
    expect(s.distinctDirectors).toBe(3); // Frecknall, Lloyd, Icke (p4/p7 blank excluded)
    expect(s.distinctActors).toBe(3); // Andrew Scott, Ben Whishaw, Cate Blanchett
  });
});

describe("computeStats — span (FR-06)", () => {
  it("spans earliest to latest dated year", () => {
    expect(computeStats(ARCHIVE).span).toEqual({ from: 2022, to: 2024 });
  });

  it("returns a single year when only one dated year exists", () => {
    const s = computeStats([
      play({ name: "a", date: "2024-03-01" }),
      play({ name: "b", date: "2024-09-01" }),
    ]);
    expect(s.span).toEqual({ from: 2024, to: 2024 });
  });

  it("returns null when no play is dated", () => {
    const s = computeStats([
      play({ name: "a", venue: "X" }),
      play({ name: "b", venue: "Y" }),
    ]);
    expect(s.span).toBeNull();
  });
});

describe("computeStats — plays per year (FR-07/08/15)", () => {
  const s = computeStats(ARCHIVE);

  it("tallies dated plays per year, newest first, undated excluded", () => {
    expect(s.perYear).toEqual([
      { year: 2024, count: 2 },
      { year: 2023, count: 2 },
      { year: 2022, count: 1 },
    ]);
  });

  it("surfaces the undated count separately", () => {
    expect(s.undatedCount).toBe(2);
  });

  it("emits no year rows and undatedCount for an all-undated archive", () => {
    const allUndated = computeStats([
      play({ name: "a", venue: "X" }),
      play({ name: "b", venue: "Y" }),
    ]);
    expect(allUndated.perYear).toEqual([]);
    expect(allUndated.undatedCount).toBe(2);
  });
});

describe("computeStats — most-seen ordering, ties & blanks (FR-09/10/11)", () => {
  const s = computeStats(ARCHIVE);

  it("orders venues count-desc then name-asc, with a tie shown equal", () => {
    // National=2, Almeida=2 (tie → name asc), Donmar=1, Bridge=1 (tie → name asc)
    expect(s.topVenues).toEqual([
      { value: "Almeida Theatre", count: 2 },
      { value: "National Theatre", count: 2 },
      { value: "Bridge Theatre", count: 1 },
      { value: "Donmar Warehouse", count: 1 },
    ]);
  });

  it("orders directors with a count tie broken by name", () => {
    expect(s.topDirectors).toEqual([
      { value: "Rebecca Frecknall", count: 2 },
      { value: "Robert Icke", count: 2 },
      { value: "Jamie Lloyd", count: 1 },
    ]);
  });

  it("counts each actor once per play; undated plays still count", () => {
    expect(s.topActors).toEqual([
      { value: "Andrew Scott", count: 3 },
      { value: "Ben Whishaw", count: 2 },
      { value: "Cate Blanchett", count: 2 }, // Cate's second is on undated p6
    ]);
  });

  it("hard-cuts each list at five by the deterministic order", () => {
    const many = computeStats(
      ["F", "E", "D", "C", "B", "A"].map((v) =>
        play({ name: v, venue: v }),
      ),
    );
    // Six venues each seen once → all tied → name-asc, keep the first five.
    expect(many.topVenues.map((r) => r.value)).toEqual(["A", "B", "C", "D", "E"]);
    expect(many.topVenues).toHaveLength(5);
  });
});

describe("computeStats — case-sensitive keys equal the filtered log (FR-04, NFR-05)", () => {
  it('treats "Almeida" and "almeida" as two distinct venues', () => {
    const s = computeStats([
      play({ name: "a", venue: "Almeida" }),
      play({ name: "b", venue: "almeida" }),
    ]);
    expect(s.distinctVenues).toBe(2);
    // Two distinct case-sensitive keys; the count tie is broken by the same
    // locale compare the schema specifies (en), which orders "almeida" first.
    expect(s.topVenues).toEqual([
      { value: "almeida", count: 1 },
      { value: "Almeida", count: 1 },
    ]);
  });

  it("every most-seen count equals what the filtered log would show", () => {
    const s = computeStats(ARCHIVE);
    for (const r of s.topVenues) {
      const n = ARCHIVE.filter((p) =>
        matchesFilter(p, { type: "venue", value: r.value }),
      ).length;
      expect(r.count).toBe(n);
    }
    for (const r of s.topActors) {
      const n = ARCHIVE.filter((p) =>
        matchesFilter(p, { type: "actor", value: r.value }),
      ).length;
      expect(r.count).toBe(n);
    }
  });
});

describe("computeStats — empty archive (FR-17)", () => {
  it("returns a well-formed zero shape", () => {
    expect(computeStats([])).toEqual({
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
    });
  });
});

describe("computeStats — single-play degradation (FR-18)", () => {
  it("states true small numbers with no fabricated trend", () => {
    const s = computeStats([
      play({
        name: "only",
        date: "2025-04-04",
        venue: "Young Vic",
        director: "Kip Williams",
        actors: ["Sarah Snook"],
      }),
    ]);
    expect(s.total).toBe(1);
    expect(s.span).toEqual({ from: 2025, to: 2025 });
    expect(s.perYear).toEqual([{ year: 2025, count: 1 }]);
    expect(s.topVenues).toEqual([{ value: "Young Vic", count: 1 }]);
  });
});
