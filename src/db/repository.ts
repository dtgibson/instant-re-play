import { randomUUID } from "node:crypto";

import { asc, desc, eq, sql } from "drizzle-orm";

import {
  normalizePlayInput,
  validatePlayInput,
  type FieldErrors,
  type Play,
  type PlayInput,
} from "@/lib/play";

import type { AppDatabase } from "./index";
import { playActors, plays, type PlayRow } from "./schema";

/** Thrown by create/update when normalized input fails validation (FR-02/04). */
export class PlayValidationError extends Error {
  readonly errors: FieldErrors;
  constructor(errors: FieldErrors) {
    super("Invalid play input");
    this.name = "PlayValidationError";
    this.errors = errors;
  }
}

/** Thrown when editing/deleting an id that no longer exists. */
export class PlayNotFoundError extends Error {
  constructor(id: string) {
    super(`Play not found: ${id}`);
    this.name = "PlayNotFoundError";
  }
}

function rowToPlay(row: PlayRow, actors: string[]): Play {
  return {
    id: row.id,
    name: row.name,
    date: row.dateSeen ?? "",
    venue: row.venue ?? "",
    playwright: row.playwright ?? "",
    director: row.director ?? "",
    actors,
  };
}

async function actorsByPlay(db: AppDatabase): Promise<Map<string, string[]>> {
  const rows = await db
    .select()
    .from(playActors)
    .orderBy(asc(playActors.playId), asc(playActors.position));
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.playId) ?? [];
    list.push(r.name);
    map.set(r.playId, list);
  }
  return map;
}

/**
 * FR-10/FR-11: every saved entry, in the default order the
 * `plays(date_seen DESC NULLS LAST)` index serves (created_at breaks ties so
 * the order is deterministic). Actors come back in `position` order.
 */
export async function listPlays(db: AppDatabase): Promise<Play[]> {
  const [playRows, actors] = await Promise.all([
    db
      .select()
      .from(plays)
      .orderBy(sql`${plays.dateSeen} DESC NULLS LAST`, desc(plays.createdAt)),
    actorsByPlay(db),
  ]);
  return playRows.map((row) => rowToPlay(row, actors.get(row.id) ?? []));
}

/** Fetch a single play with its actors, or null. */
export async function getPlay(
  db: AppDatabase,
  id: string,
): Promise<Play | null> {
  const rows = await db.select().from(plays).where(eq(plays.id, id)).limit(1);
  if (!rows.length) return null;
  const actorRows = await db
    .select()
    .from(playActors)
    .where(eq(playActors.playId, id))
    .orderBy(asc(playActors.position));
  return rowToPlay(
    rows[0],
    actorRows.map((a) => a.name),
  );
}

async function insertActors(
  tx: AppDatabase,
  playId: string,
  actors: string[],
): Promise<void> {
  if (!actors.length) return;
  await tx.insert(playActors).values(
    actors.map((name, position) => ({
      id: randomUUID(),
      playId,
      name,
      position,
    })),
  );
}

/**
 * FR-01/FR-06/FR-07: normalize, validate, and write a new play + its actors in
 * one transaction. Ids are generated app-side (driver-agnostic); the DB default
 * is a backstop. Throws PlayValidationError on an empty name or invalid date.
 */
export async function createPlay(
  db: AppDatabase,
  input: PlayInput,
): Promise<Play> {
  const norm = normalizePlayInput(input);
  const errors = validatePlayInput(norm);
  if (errors) throw new PlayValidationError(errors);

  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(plays).values({
      id,
      name: norm.name,
      dateSeen: norm.date || null,
      venue: norm.venue || null,
      playwright: norm.playwright || null,
      director: norm.director || null,
    });
    await insertActors(tx as unknown as AppDatabase, id, norm.actors);
  });

  const created = await getPlay(db, id);
  if (!created) throw new Error("Failed to load created play");
  return created;
}

/**
 * FR-08: update a play, applying the same normalization/validation as create.
 * The actor set is replaced wholesale (delete + reinsert with fresh positions)
 * inside one transaction — simpler and safer than diffing at this row count.
 */
export async function updatePlay(
  db: AppDatabase,
  id: string,
  input: PlayInput,
): Promise<Play> {
  const norm = normalizePlayInput(input);
  const errors = validatePlayInput(norm);
  if (errors) throw new PlayValidationError(errors);

  const exists = await db
    .select({ id: plays.id })
    .from(plays)
    .where(eq(plays.id, id))
    .limit(1);
  if (!exists.length) throw new PlayNotFoundError(id);

  await db.transaction(async (tx) => {
    await tx
      .update(plays)
      .set({
        name: norm.name,
        dateSeen: norm.date || null,
        venue: norm.venue || null,
        playwright: norm.playwright || null,
        director: norm.director || null,
        updatedAt: new Date(),
      })
      .where(eq(plays.id, id));
    await tx.delete(playActors).where(eq(playActors.playId, id));
    await insertActors(tx as unknown as AppDatabase, id, norm.actors);
  });

  const updated = await getPlay(db, id);
  if (!updated) throw new Error("Failed to load updated play");
  return updated;
}

/**
 * FR-09: delete a play permanently. The ON DELETE CASCADE FK removes its
 * play_actors rows.
 */
export async function deletePlay(db: AppDatabase, id: string): Promise<void> {
  await db.delete(plays).where(eq(plays.id, id));
}

/**
 * Replace the entire log with the given entries (clear, then insert). Used by
 * the seed script; safe to re-run. The CASCADE FK clears actors on delete.
 */
export async function replaceAllPlays(
  db: AppDatabase,
  inputs: PlayInput[],
): Promise<number> {
  await db.delete(plays);
  for (const input of inputs) {
    await createPlay(db, input);
  }
  return inputs.length;
}
