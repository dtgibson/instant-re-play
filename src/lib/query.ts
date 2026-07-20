import type { Play } from "./play";

/**
 * Deriving the visible list from the full log: search, click-to-filter and
 * sort. This is the single source of truth for the list's live behaviour and
 * is used both by the client (instant, no round-trip) and by the smoke test.
 * The full log is loaded once from Postgres, already in the default order the
 * `plays(date_seen DESC NULLS LAST)` index serves; at the NFR-03 scale (≤1,000
 * entries, single user) filtering in memory is imperceptible and matches the
 * approved design's instant interaction.
 */

export type FilterType = "venue" | "playwright" | "director" | "actor";

export interface ActiveFilter {
  type: FilterType;
  value: string;
}

export type SortField = "date" | "name" | "venue";
export type SortDir = "asc" | "desc";

export interface SortState {
  field: SortField;
  dir: SortDir;
}

/** The default order: date seen, most recent first (FR-11). */
export const DEFAULT_SORT: SortState = { field: "date", dir: "desc" };

/** The resting direction for a freshly selected sort field. */
export function defaultDirFor(field: SortField): SortDir {
  return field === "date" ? "desc" : "asc";
}

/** What the sort becomes when a header/segment for `field` is activated. */
export function nextSort(current: SortState, field: SortField): SortState {
  if (current.field === field) {
    return { field, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { field, dir: defaultDirFor(field) };
}

/**
 * FR-15 / FR-17: exact, case-sensitive match on the stored text. Venue and
 * director match the whole field; an actor filter matches if *any* actor in the
 * entry equals the value.
 */
export function matchesFilter(play: Play, filter: ActiveFilter | null): boolean {
  if (!filter) return true;
  if (filter.type === "venue") return play.venue === filter.value;
  if (filter.type === "playwright") return play.playwright === filter.value;
  if (filter.type === "director") return play.director === filter.value;
  return play.actors.includes(filter.value);
}

/**
 * FR-13: case-insensitive substring across name, venue, playwright, director,
 * and any actor name.
 */
export function matchesSearch(play: Play, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (play.name.toLowerCase().includes(q)) return true;
  if (play.venue.toLowerCase().includes(q)) return true;
  if (play.playwright.toLowerCase().includes(q)) return true;
  if (play.director.toLowerCase().includes(q)) return true;
  return play.actors.some((a) => a.toLowerCase().includes(q));
}

/**
 * FR-11: sort by the active field/direction, with blank values always sorted
 * last in *both* directions. Dates compare as ISO strings; name/venue use a
 * locale compare so ordering reads naturally.
 */
export function comparePlays(a: Play, b: Play, sort: SortState): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  const av = sort.field === "date" ? a.date : sort.field === "name" ? a.name : a.venue;
  const bv = sort.field === "date" ? b.date : sort.field === "name" ? b.name : b.venue;

  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // blanks last, regardless of direction
  if (bEmpty) return -1;

  if (sort.field === "date") {
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  }
  return av.localeCompare(bv, "en", { sensitivity: "base" }) * dir;
}

/**
 * FR-13/FR-14: the click-through URL contract. Each most-seen value in /stats
 * links to the log route pre-seeded with the log's existing single filter via
 * two query params — `/?filter=<type>&value=<url-encoded exact value>`. The
 * type lives in one place with a trivial allow-list; the value is taken exactly
 * (case-sensitive), so the seeded filter resolves to precisely the log's set.
 */
export function filterHref(type: FilterType, value: string): string {
  return `/?filter=${type}&value=${encodeURIComponent(value)}`;
}

/**
 * FR-14: read an `ActiveFilter` from the log route's query params. The type
 * must be one of the `FilterType` allow-list and the value a non-empty string;
 * anything absent or malformed yields `null`, so the log loads unfiltered
 * exactly as today. Pure and easy to unit-test against the malformed cases.
 */
export function parseFilter(params: {
  filter?: string;
  value?: string;
}): ActiveFilter | null {
  const { filter, value } = params;
  if (
    (filter === "venue" ||
      filter === "playwright" ||
      filter === "director" ||
      filter === "actor") &&
    typeof value === "string" &&
    value.length > 0
  ) {
    return { type: filter, value };
  }
  return null; // absent or malformed → unfiltered, exactly as today
}

/** Apply the active filter + search, then sort. Returns a new array. */
export function filterAndSortPlays(
  plays: Play[],
  opts: { sort: SortState; search: string; filter: ActiveFilter | null },
): Play[] {
  return plays
    .filter((p) => matchesFilter(p, opts.filter) && matchesSearch(p, opts.search))
    .sort((a, b) => comparePlays(a, b, opts.sort));
}
