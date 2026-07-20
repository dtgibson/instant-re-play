/**
 * Pure domain logic for a play entry: the types, plus normalization,
 * validation, date handling and the IMDb link. Shared verbatim between the
 * client (instant inline validation and display) and the server (Server
 * Actions re-validate; the repository normalizes before writing). Keeping this
 * in one place is what makes "correctness is part of the aesthetic of trust"
 * mechanical rather than duplicated.
 */

/** A play as the UI works with it: blanks are "" (the DB stores NULL). */
export interface Play {
  id: string;
  name: string;
  /** "YYYY-MM-DD", or "" when no date was recorded. */
  date: string;
  venue: string;
  /** Who wrote the play; "" when blank. Parallel to `director`. */
  playwright: string;
  director: string;
  /** Ordered, per-entry-deduplicated actor names. */
  actors: string[];
}

/**
 * Raw form values for creating or editing a play. `playwright` is optional here
 * (an additive field): callers that predate it — seeds, older tests — omit it
 * and it normalizes to "" just like a blank string, so no existing call site
 * needs to change. Normalized `Play` always carries it as a string.
 */
export interface PlayInput {
  name: string;
  date: string;
  venue: string;
  playwright?: string;
  director: string;
  actors: string[];
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const NAME_REQUIRED_MESSAGE =
  "A play needs a name before it can be saved.";
export const DATE_INVALID_MESSAGE =
  "Please enter a valid calendar date (past or future is fine).";

/** Per-field validation errors, keyed by field name. */
export type FieldErrors = Partial<Record<"name" | "date", string>>;

/**
 * FR-06: trim every free-text value, discard actor values that are empty after
 * trimming, and keep at most one copy of an exact-duplicate actor name (first
 * occurrence wins, so entry order is preserved).
 */
export function normalizePlayInput(input: PlayInput): PlayInput {
  const actors: string[] = [];
  for (const raw of input.actors ?? []) {
    const trimmed = (raw ?? "").trim();
    if (trimmed && !actors.includes(trimmed)) actors.push(trimmed);
  }
  return {
    name: (input.name ?? "").trim(),
    date: (input.date ?? "").trim(),
    venue: (input.venue ?? "").trim(),
    playwright: (input.playwright ?? "").trim(),
    director: (input.director ?? "").trim(),
    actors,
  };
}

/**
 * FR-02 / FR-04. Validate an already-normalized input. Returns a field-error
 * map, or null if valid. (Callers should normalize first.)
 */
export function validatePlayInput(input: PlayInput): FieldErrors | null {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = NAME_REQUIRED_MESSAGE;
  if (!isValidDate(input.date)) errors.date = DATE_INVALID_MESSAGE;
  return Object.keys(errors).length ? errors : null;
}

/**
 * FR-04 / QA-04: accept only a genuine calendar date (an empty value is fine —
 * the field is optional). Any past *or* future date is accepted. Rejects
 * malformed and impossible dates (e.g. 2024-02-31) by checking the parsed
 * components round-trip.
 */
export function isValidDate(value: string): boolean {
  if (!value) return true; // optional
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T00:00:00`);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === Number(m[1]) &&
    d.getMonth() + 1 === Number(m[2]) &&
    d.getDate() === Number(m[3])
  );
}

/** Whether an ISO date is strictly after today (drives the "Upcoming" tag). */
export function isFuture(iso: string): boolean {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d.getTime() > today.getTime();
}

/** Parsed date parts for display, or null when there is no valid date. */
export function formatDate(
  iso: string,
): { day: number; mon: string; year: string } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: Number(m[3]),
    mon: MONTHS[Number(m[2]) - 1] ?? "",
    year: m[1],
  };
}

/**
 * FR-18: an IMDb *name-search* link for the exact stored name. Search, never a
 * guessed deep link, so it always resolves. Only the name is sent (NFR-05).
 */
export function imdbUrl(name: string): string {
  return `https://www.imdb.com/find/?q=${encodeURIComponent(name)}&s=nm`;
}
