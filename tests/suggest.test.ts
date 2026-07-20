import { describe, expect, it } from "vitest";

import type { Play } from "@/lib/play";
import {
  collectFieldValues,
  highlightFragment,
  suggestValues,
} from "@/lib/suggest";

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

const ARCHIVE: Play[] = [
  play({
    name: "A Streetcar Named Desire",
    venue: "Almeida Theatre",
    playwright: "Tennessee Williams",
    director: "Rebecca Frecknall",
    actors: ["Paul Mescal", "Patsy Ferran"],
  }),
  play({
    name: "Cabaret",
    venue: "Almeida Theatre", // duplicate venue — must dedupe
    playwright: "",
    director: "Rebecca Frecknall", // duplicate director — must dedupe
    actors: ["Paul Mescal", "Eddie Redmayne"], // Paul Mescal duplicate
  }),
  play({
    name: "The Glass Menagerie",
    venue: "Duke of York's Theatre",
    playwright: "Tennessee Williams", // duplicate playwright
    director: "  ", // blank after trim — must be dropped
    actors: [],
  }),
];

describe("collectFieldValues (distinct, non-blank, from the user's own log)", () => {
  it("returns distinct venues in first-seen order, blanks dropped", () => {
    expect(collectFieldValues(ARCHIVE, "venue")).toEqual([
      "Almeida Theatre",
      "Duke of York's Theatre",
    ]);
  });
  it("dedupes directors and drops a blank/whitespace value", () => {
    expect(collectFieldValues(ARCHIVE, "director")).toEqual([
      "Rebecca Frecknall",
    ]);
  });
  it("dedupes playwrights across entries", () => {
    expect(collectFieldValues(ARCHIVE, "playwright")).toEqual([
      "Tennessee Williams",
    ]);
  });
  it("flattens and dedupes actor names across the archive", () => {
    expect(collectFieldValues(ARCHIVE, "actor")).toEqual([
      "Paul Mescal",
      "Patsy Ferran",
      "Eddie Redmayne",
    ]);
  });
});

describe("suggestValues (substring, prefix-first, never invents)", () => {
  const names = ["Tennessee Williams", "Thornton Wilder", "Tom Stoppard", "Wole Soyinka"];

  it("matches case-insensitive substring (mid-string, kept in log order)", () => {
    // Neither name STARTS with "wil" (they start "Ten"/"Tho"), so both are
    // substring matches and keep their source order.
    expect(suggestValues(names, "WIL")).toEqual([
      "Tennessee Williams",
      "Thornton Wilder",
    ]);
  });

  it("ranks prefix matches before other substring matches", () => {
    // 'to' is a prefix of 'Tom Stoppard' and appears mid-word in 'Thornton'.
    const out = suggestValues(["Thornton Wilder", "Tom Stoppard"], "to");
    expect(out[0]).toBe("Tom Stoppard");
    expect(out).toContain("Thornton Wilder");
  });

  it("returns nothing for an empty/whitespace fragment (no plane until typing)", () => {
    expect(suggestValues(names, "")).toEqual([]);
    expect(suggestValues(names, "   ")).toEqual([]);
  });

  it("returns nothing for an unseen fragment, so the typed value saves as-is", () => {
    expect(suggestValues(names, "Beckett")).toEqual([]);
    expect(suggestValues(names, "zzz")).toEqual([]);
  });

  it("drops a value the user has already fully typed (nothing to suggest)", () => {
    expect(suggestValues(names, "Tom Stoppard")).toEqual([]);
    expect(suggestValues(names, "TENNESSEE WILLIAMS")).toEqual([]);
  });

  it("never rewrites the input — it only ever returns members of the source list", () => {
    const out = suggestValues(names, "t");
    for (const s of out) expect(names).toContain(s);
  });

  it("caps the number of suggestions", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Value ${i}`);
    expect(suggestValues(many, "value", 6)).toHaveLength(6);
  });
});

describe("highlightFragment (marks the typed run for <mark>)", () => {
  it("splits around the first case-insensitive occurrence, preserving casing", () => {
    expect(highlightFragment("Tennessee Williams", "wil")).toEqual([
      { text: "Tennessee ", match: false },
      { text: "Wil", match: true },
      { text: "liams", match: false },
    ]);
  });
  it("returns the whole value unmarked when the fragment is empty or unmatched", () => {
    expect(highlightFragment("Tom Stoppard", "")).toEqual([
      { text: "Tom Stoppard", match: false },
    ]);
    expect(highlightFragment("Tom Stoppard", "xyz")).toEqual([
      { text: "Tom Stoppard", match: false },
    ]);
  });
});
