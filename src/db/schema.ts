import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * plays — one row per logged play entry.
 *
 * All optional free-text fields are stored as NULL when empty (never empty
 * string), so "blank" is unambiguous in display (FR-03) and sorts blanks-last
 * cleanly (FR-11). Normalization (trim / discard-empty / dedupe) happens at the
 * app layer on save (FR-06); the CHECK and UNIQUE constraints below are
 * database backstops so bad data cannot slip in through any path.
 */
export const plays = pgTable(
  "plays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // NOT NULL, and a genuine (trimmed) name — FR-02. Trimmed before write; the
    // CHECK is a backstop.
    name: text("name").notNull(),
    // Calendar date only, no time-zone semantics (FR-04). Past or future ok.
    dateSeen: date("date_seen", { mode: "string" }),
    venue: text("venue"),
    // Who wrote the play. Nullable, trimmed, NULL when blank — same contract as
    // venue/director (additive; existing rows get NULL, never empty string).
    playwright: text("playwright"),
    director: text("director"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("plays_name_not_blank", sql`btrim(${t.name}) <> ''`),
    // Default list order is date seen, newest first, blanks last (FR-11).
    // NULLS LAST must be explicit: Postgres defaults DESC to nulls-first.
    index("plays_date_seen_idx").on(sql`${t.dateSeen} DESC NULLS LAST`),
    // Exact-match click-to-filter on venue / director / playwright (FR-15).
    index("plays_venue_idx").on(t.venue),
    index("plays_director_idx").on(t.director),
    index("plays_playwright_idx").on(t.playwright),
  ],
);

/**
 * play_actors — ordered, per-entry-deduplicated actor names for a play.
 *
 * Modeled as a child table (not a text[] column) so actor filtering is a plain
 * indexed equality lookup, per-entry duplicate prevention is a database
 * constraint, and CSV export later is a straightforward join.
 */
export const playActors = pgTable(
  "play_actors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playId: uuid("play_id")
      .notNull()
      .references(() => plays.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 0-based entry order (FR-05: order of entry preserved).
    position: integer("position").notNull(),
  },
  (t) => [
    check("play_actors_name_not_blank", sql`btrim(${t.name}) <> ''`),
    // At most one copy of an exact-duplicate actor name per entry (FR-06).
    unique("play_actors_play_id_name_key").on(t.playId, t.name),
    // Stable, unambiguous ordering per entry.
    unique("play_actors_play_id_position_key").on(t.playId, t.position),
    // Exact-match click-to-filter on actor (FR-15). (play_id is already
    // covered by the UNIQUE(play_id, name) index — no separate index needed.)
    index("play_actors_name_idx").on(t.name),
  ],
);

export type PlayRow = typeof plays.$inferSelect;
export type PlayInsert = typeof plays.$inferInsert;
export type PlayActorRow = typeof playActors.$inferSelect;
export type PlayActorInsert = typeof playActors.$inferInsert;
