import { describe, expect, it } from "vitest";

import type { Play } from "@/lib/play";
import {
  defaultDirFor,
  filterAndSortPlays,
  filterHref,
  matchesFilter,
  matchesSearch,
  nextSort,
  parseFilter,
  type ActiveFilter,
  type SortState,
} from "@/lib/query";

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

const PLAYS: Play[] = [
  play({
    name: "A Streetcar Named Desire",
    date: "2024-01-12",
    venue: "Almeida Theatre",
    playwright: "Tennessee Williams",
    director: "Rebecca Frecknall",
    actors: ["Paul Mescal", "Patsy Ferran"],
  }),
  play({
    name: "Vanya",
    date: "2024-01-13",
    venue: "Duke of York's Theatre",
    playwright: "Anton Chekhov",
    director: "Sam Yates",
    actors: ["Andrew Scott"],
  }),
  play({
    name: "The Pillowman",
    date: "2023-08-30",
    venue: "Duke of York's Theatre",
    actors: ["David Tennant"],
  }),
  play({ name: "A Midsummer Night's Dream" }), // all blank
];

const byDate = (dir: "asc" | "desc"): SortState => ({ field: "date", dir });

describe("matchesFilter (FR-15 / exact, case-sensitive)", () => {
  it("matches venue / director exactly", () => {
    expect(matchesFilter(PLAYS[0], { type: "venue", value: "Almeida Theatre" })).toBe(true);
    expect(matchesFilter(PLAYS[0], { type: "venue", value: "almeida theatre" })).toBe(false);
    expect(matchesFilter(PLAYS[1], { type: "director", value: "Sam Yates" })).toBe(true);
  });
  it("matches playwright exactly and case-sensitively (like director)", () => {
    expect(
      matchesFilter(PLAYS[0], { type: "playwright", value: "Tennessee Williams" }),
    ).toBe(true);
    expect(
      matchesFilter(PLAYS[0], { type: "playwright", value: "tennessee williams" }),
    ).toBe(false);
    expect(
      matchesFilter(PLAYS[1], { type: "playwright", value: "Tennessee Williams" }),
    ).toBe(false);
  });
  it("matches an actor if any actor equals the value", () => {
    expect(matchesFilter(PLAYS[0], { type: "actor", value: "Patsy Ferran" })).toBe(true);
    expect(matchesFilter(PLAYS[0], { type: "actor", value: "Andrew Scott" })).toBe(false);
  });
  it("null filter matches everything", () => {
    expect(matchesFilter(PLAYS[3], null)).toBe(true);
  });
});

describe("matchesSearch (FR-13 / case-insensitive substring)", () => {
  it("searches across name, venue, playwright, director and actors", () => {
    expect(matchesSearch(PLAYS[0], "streetcar")).toBe(true); // name
    expect(matchesSearch(PLAYS[0], "almeida")).toBe(true); // venue
    expect(matchesSearch(PLAYS[0], "williams")).toBe(true); // playwright
    expect(matchesSearch(PLAYS[0], "TENNESSEE")).toBe(true); // playwright, case-insensitive
    expect(matchesSearch(PLAYS[0], "frecknall")).toBe(true); // director
    expect(matchesSearch(PLAYS[0], "MESCAL")).toBe(true); // actor, case-insensitive
    expect(matchesSearch(PLAYS[0], "godot")).toBe(false);
  });
  it("empty query matches everything", () => {
    expect(matchesSearch(PLAYS[3], "   ")).toBe(true);
  });
});

describe("sort (FR-11)", () => {
  it("date desc puts newest first and blanks last", () => {
    const out = filterAndSortPlays(PLAYS, { sort: byDate("desc"), search: "", filter: null });
    expect(out[0].name).toBe("Vanya"); // 2024-01-13
    expect(out[out.length - 1].date).toBe(""); // blank last
  });
  it("date asc puts oldest first and STILL blanks last", () => {
    const out = filterAndSortPlays(PLAYS, { sort: byDate("asc"), search: "", filter: null });
    expect(out[0].name).toBe("The Pillowman"); // 2023-08-30
    expect(out[out.length - 1].date).toBe(""); // blank still last
  });
  it("venue asc/desc keeps the blank venue last in both directions", () => {
    const asc = filterAndSortPlays(PLAYS, {
      sort: { field: "venue", dir: "asc" },
      search: "",
      filter: null,
    });
    const desc = filterAndSortPlays(PLAYS, {
      sort: { field: "venue", dir: "desc" },
      search: "",
      filter: null,
    });
    expect(asc[asc.length - 1].venue).toBe("");
    expect(desc[desc.length - 1].venue).toBe("");
  });
});

describe("filter + search combine with AND (FR-17)", () => {
  it("narrows to entries matching both", () => {
    const out = filterAndSortPlays(PLAYS, {
      sort: byDate("desc"),
      search: "pillow",
      filter: { type: "venue", value: "Duke of York's Theatre" },
    });
    expect(out.map((p) => p.name)).toEqual(["The Pillowman"]);
  });
});

describe("sort toggling", () => {
  it("defaults date to desc, other fields to asc", () => {
    expect(defaultDirFor("date")).toBe("desc");
    expect(defaultDirFor("name")).toBe("asc");
    expect(defaultDirFor("venue")).toBe("asc");
  });
  it("toggles direction on the same field, resets on a new field", () => {
    expect(nextSort({ field: "date", dir: "desc" }, "date")).toEqual({
      field: "date",
      dir: "asc",
    });
    expect(nextSort({ field: "date", dir: "desc" }, "name")).toEqual({
      field: "name",
      dir: "asc",
    });
  });
});

describe("filterHref (FR-13 / the click-through URL contract)", () => {
  it("builds /?filter=<type>&value=<url-encoded value>", () => {
    expect(filterHref("venue", "National Theatre")).toBe(
      "/?filter=venue&value=National%20Theatre",
    );
    expect(filterHref("director", "Rebecca Frecknall")).toBe(
      "/?filter=director&value=Rebecca%20Frecknall",
    );
  });
  it("url-encodes reserved characters (space, comma, ampersand)", () => {
    expect(filterHref("actor", "Böð, & Co.")).toBe(
      "/?filter=actor&value=B%C3%B6%C3%B0%2C%20%26%20Co.",
    );
  });
});

describe("parseFilter (FR-14 / seed the log's filter from the URL)", () => {
  it("accepts each valid filter type with a value", () => {
    expect(parseFilter({ filter: "venue", value: "Almeida" })).toEqual({
      type: "venue",
      value: "Almeida",
    });
    expect(parseFilter({ filter: "director", value: "Sam Yates" })).toEqual({
      type: "director",
      value: "Sam Yates",
    });
    expect(parseFilter({ filter: "playwright", value: "Tennessee Williams" })).toEqual({
      type: "playwright",
      value: "Tennessee Williams",
    });
    expect(parseFilter({ filter: "actor", value: "Andrew Scott" })).toEqual({
      type: "actor",
      value: "Andrew Scott",
    });
  });

  it("returns null for absent or malformed params", () => {
    expect(parseFilter({})).toBeNull();
    expect(parseFilter({ filter: "venue" })).toBeNull(); // no value
    expect(parseFilter({ value: "Almeida" })).toBeNull(); // no type
    expect(parseFilter({ filter: "venue", value: "" })).toBeNull(); // empty value
    expect(parseFilter({ filter: "author", value: "X" })).toBeNull(); // bad type
    expect(parseFilter({ filter: "VENUE", value: "X" })).toBeNull(); // case-sensitive type
  });

  it("round-trips filterHref → decoded query params → parseFilter", () => {
    const cases: ActiveFilter[] = [
      { type: "venue", value: "Duke of York's, Theatre" },
      { type: "actor", value: "Böð & Co." },
      { type: "director", value: "Robert Icke" },
      { type: "playwright", value: "Tennessee Williams" },
    ];
    for (const original of cases) {
      const href = filterHref(original.type, original.value);
      // The log route receives already-decoded searchParams, as Next.js decodes
      // the query string for us — emulate that with URLSearchParams.
      const qs = new URLSearchParams(href.slice(href.indexOf("?") + 1));
      const round = parseFilter({
        filter: qs.get("filter") ?? undefined,
        value: qs.get("value") ?? undefined,
      });
      expect(round).toEqual(original);
    }
  });
});
