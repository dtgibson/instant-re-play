/**
 * Theatregoing Stats — the one pure aggregation module (FR-03/FR-04, NFR-05).
 *
 * `computeStats` derives every figure the /stats view shows from the SAME
 * `Play[]` the log and export read through `listPlays`, using the SAME exact,
 * case-sensitive keys the log filters by (`matchesFilter` in query.ts). Keeping
 * a single source of truth is a correctness decision, not a convenience one:
 * because a most-seen count is tallied over the very same objects with the very
 * same equality, a click-through from a count can never land on a different
 * number of entries (NFR-05). No DB, no HTTP, no React — a single O(n) pass,
 * imperceptible at the product's ~1,000-play ceiling (NFR-03), unit-tested in
 * isolation like `src/lib/export.ts`.
 *
 * Blank handling is mechanical, not special-cased: `rowToPlay` already surfaces
 * NULL date/venue/director as "", so "not counted" is just `value === ""` and
 * "undated" is just `date === ""`.
 */

import type { Play } from "./play";

/** One ranked value in a most-seen list: count desc, then value asc. */
export interface RankedValue {
  value: string;
  count: number;
}

/** One year's dated-play tally in the per-year strip: newest year first. */
export interface YearCount {
  year: number;
  count: number;
}

export interface Stats {
  /** FR-05a: every entry, dated or not, blank fields or not. */
  total: number;
  /** FR-06: earliest..latest dated year, or null when no play is dated. */
  span: { from: number; to: number } | null;
  /** FR-05c: distinct non-blank venue strings. */
  distinctVenues: number;
  /** FR-05d: distinct non-blank director strings. */
  distinctDirectors: number;
  /** FR-05e: distinct actor names across the archive. */
  distinctActors: number;
  /** FR-07: dated plays per year, newest first; [] when none are dated. */
  perYear: YearCount[];
  /** FR-15: plays with no date; surfaced as a caveat only when > 0. */
  undatedCount: number;
  /** FR-09/10/11: top-5 venues, count desc then name asc; length 0..5. */
  topVenues: RankedValue[];
  topDirectors: RankedValue[];
  topActors: RankedValue[];
}

/** Hard cut at five by the deterministic order (FR-10, PRD Open Questions). */
const TOP_N = 5;

/**
 * The stored value is a validated `YYYY-MM-DD`, so the first four chars are the
 * year; `Number.isNaN` guards defensively against any legacy/edge value
 * (mirroring the masthead trust-stat). "" (undated) yields null.
 */
function yearOf(date: string): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isNaN(year) ? null : year;
}

/**
 * Rank a tally: count descending, then value ascending (locale compare) as the
 * tiebreak, then a hard cut at five. Equal counts come back adjacent in name
 * order and display the same number, with no ordering implied between them.
 */
function rank(counts: Map<string, number>): RankedValue[] {
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "en"))
    .slice(0, TOP_N);
}

export function computeStats(plays: Play[]): Stats {
  const venueCounts = new Map<string, number>();
  const directorCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();
  const yearCounts = new Map<number, number>();

  let undatedCount = 0;
  let minYear = Infinity;
  let maxYear = -Infinity;

  // One play adds 1 to a non-blank key; blanks are silently excluded (FR-05/11).
  const bump = (counts: Map<string, number>, key: string) => {
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const play of plays) {
    bump(venueCounts, play.venue);
    bump(directorCounts, play.director);
    // Actors are already trimmed, non-blank and per-entry deduplicated on write,
    // so each name contributes at most once per play (FR-11). Guard defensively.
    for (const actor of play.actors) bump(actorCounts, actor);

    const year = yearOf(play.date);
    if (year === null) {
      undatedCount += 1;
    } else {
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      if (year < minYear) minYear = year;
      if (year > maxYear) maxYear = year;
    }
  }

  // Only years with >=1 dated play appear (no zero-filled gaps), newest first.
  const perYear = Array.from(yearCounts, ([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);

  const span = perYear.length ? { from: minYear, to: maxYear } : null;

  return {
    total: plays.length,
    span,
    distinctVenues: venueCounts.size,
    distinctDirectors: directorCounts.size,
    distinctActors: actorCounts.size,
    perYear,
    undatedCount,
    topVenues: rank(venueCounts),
    topDirectors: rank(directorCounts),
    topActors: rank(actorCounts),
  };
}
