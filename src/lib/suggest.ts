/**
 * Self-sourced autocomplete logic — pure, so the "distinct prior values,
 * substring match, never auto-correct" contract is unit-testable in isolation
 * (like query.ts and export.ts). The drawer feeds it the archive already loaded
 * client-side in PlayLog; there is no endpoint and no server round-trip.
 *
 * It is only ever a convenience: suggestions are the user's OWN earlier values
 * for a field, offered as you type. Nothing here rewrites what the user typed —
 * an unmatched fragment yields no suggestions, so the typed value saves exactly
 * as entered and the log's exact-match filter/search/export semantics are
 * unchanged.
 */

import type { Play } from "./play";

/** The entry fields that carry autocomplete (name/date deliberately do not). */
export type SuggestField = "venue" | "playwright" | "director" | "actor";

/**
 * The user's distinct, non-blank prior values for one field, in the order they
 * are first seen across the log (which is date-desc — recent spellings first).
 * Distinctness is by exact stored string, so genuinely different values (incl.
 * case variants, which the exact-match filter treats as distinct) are all kept.
 */
export function collectFieldValues(
  plays: Play[],
  field: SuggestField,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const value = raw.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  };
  for (const play of plays) {
    if (field === "actor") play.actors.forEach(push);
    else push(play[field]);
  }
  return out;
}

/**
 * Rank a field's distinct values against the typed fragment: case-insensitive
 * substring, prefix matches first (then the remaining substring matches),
 * capped. A value the user has already fully typed is dropped (nothing to
 * suggest), and an empty/whitespace fragment yields nothing — so the suggestion
 * plane only appears once typing narrows to real matches, and never as a
 * correction of the final value.
 */
export function suggestValues(
  values: string[],
  fragment: string,
  cap = 6,
): string[] {
  const q = fragment.trim().toLowerCase();
  if (!q) return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const value of values) {
    const lower = value.toLowerCase();
    if (lower === q) continue; // already fully typed — nothing to add
    if (!lower.includes(q)) continue; // no match — never invented
    (lower.startsWith(q) ? prefix : contains).push(value);
  }
  return [...prefix, ...contains].slice(0, Math.max(0, cap));
}

/** One run of a suggestion's text: `match` marks the typed fragment (for <mark>). */
export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Split a suggestion into runs around the FIRST case-insensitive occurrence of
 * the typed fragment, so the UI can wrap that run in <mark> without losing the
 * value's original casing. An empty or unmatched fragment returns the whole
 * value as a single non-matching run.
 */
export function highlightFragment(
  value: string,
  fragment: string,
): HighlightPart[] {
  const q = fragment.trim();
  if (!q) return [{ text: value, match: false }];
  const at = value.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return [{ text: value, match: false }];
  const parts: HighlightPart[] = [];
  if (at > 0) parts.push({ text: value.slice(0, at), match: false });
  parts.push({ text: value.slice(at, at + q.length), match: true });
  if (at + q.length < value.length) {
    parts.push({ text: value.slice(at + q.length), match: false });
  }
  return parts;
}
