import { describe, expect, it } from "vitest";

import {
  formatDate,
  imdbUrl,
  isFuture,
  isValidDate,
  normalizePlayInput,
  validatePlayInput,
} from "@/lib/play";

describe("normalizePlayInput (FR-06)", () => {
  it("trims every free-text field", () => {
    const out = normalizePlayInput({
      name: "  Hamlet  ",
      date: "  2024-01-05  ",
      venue: "  Almeida  ",
      playwright: "  William Shakespeare  ",
      director: "  Robert Icke  ",
      actors: [],
    });
    expect(out).toMatchObject({
      name: "Hamlet",
      date: "2024-01-05",
      venue: "Almeida",
      playwright: "William Shakespeare",
      director: "Robert Icke",
    });
  });

  it("treats an omitted playwright as blank (additive/optional field)", () => {
    const out = normalizePlayInput({
      name: "X",
      date: "",
      venue: "",
      director: "",
      actors: [],
    });
    expect(out.playwright).toBe("");
  });

  it("drops empty/whitespace actors, dedupes exact duplicates, preserves order", () => {
    const out = normalizePlayInput({
      name: "X",
      date: "",
      venue: "",
      director: "",
      actors: [" Ian McKellen ", "Ian McKellen", "   ", "Judi Dench", ""],
    });
    expect(out.actors).toEqual(["Ian McKellen", "Judi Dench"]);
  });

  it("keeps case-distinct actors as different values", () => {
    const out = normalizePlayInput({
      name: "X",
      date: "",
      venue: "",
      director: "",
      actors: ["ian mckellen", "Ian McKellen"],
    });
    expect(out.actors).toEqual(["ian mckellen", "Ian McKellen"]);
  });
});

describe("validatePlayInput (FR-02 / FR-04)", () => {
  it("passes a name-only entry", () => {
    expect(
      validatePlayInput({
        name: "A Midsummer Night's Dream",
        date: "",
        venue: "",
        director: "",
        actors: [],
      }),
    ).toBeNull();
  });

  it("rejects an empty name", () => {
    const errs = validatePlayInput({
      name: "",
      date: "",
      venue: "",
      director: "",
      actors: [],
    });
    expect(errs?.name).toBeTruthy();
  });

  it("rejects an invalid date but not the empty (optional) date", () => {
    expect(
      validatePlayInput({
        name: "X",
        date: "2024-02-31",
        venue: "",
        director: "",
        actors: [],
      })?.date,
    ).toBeTruthy();
    expect(
      validatePlayInput({
        name: "X",
        date: "",
        venue: "",
        director: "",
        actors: [],
      }),
    ).toBeNull();
  });
});

describe("isValidDate (FR-04)", () => {
  it("accepts a real past date and a real future date", () => {
    expect(isValidDate("2019-07-18")).toBe(true);
    expect(isValidDate("2099-12-31")).toBe(true);
  });
  it("accepts an empty value (optional field)", () => {
    expect(isValidDate("")).toBe(true);
  });
  it("rejects impossible and malformed dates", () => {
    expect(isValidDate("2024-02-31")).toBe(false);
    expect(isValidDate("2024-13-01")).toBe(false);
    expect(isValidDate("2024-1-1")).toBe(false);
    expect(isValidDate("not-a-date")).toBe(false);
    expect(isValidDate("01/02/2024")).toBe(false);
  });
});

describe("isFuture", () => {
  it("is true for a far-future date and false for a past date and blank", () => {
    expect(isFuture("2099-12-31")).toBe(true);
    expect(isFuture("2000-01-01")).toBe(false);
    expect(isFuture("")).toBe(false);
  });
});

describe("formatDate", () => {
  it("parses an ISO date into day / month / year", () => {
    expect(formatDate("2024-01-12")).toEqual({
      day: 12,
      mon: "Jan",
      year: "2024",
    });
  });
  it("returns null for blank or malformed input", () => {
    expect(formatDate("")).toBeNull();
    expect(formatDate("2024-99-99")).toBeNull();
  });
});

describe("imdbUrl (FR-18 / NFR-05)", () => {
  it("builds a URL-encoded IMDb name-search link", () => {
    expect(imdbUrl("Ian McKellen")).toBe(
      "https://www.imdb.com/find/?q=Ian%20McKellen&s=nm",
    );
  });
});
