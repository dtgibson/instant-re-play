"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  createPlay,
  deletePlay,
  listPlays,
  PlayValidationError,
  updatePlay,
} from "@/db/repository";
import { getInvitedUser } from "@/lib/auth";
import type { FieldErrors, Play, PlayInput } from "@/lib/play";

/**
 * Server Actions are the only path that mutates the log. Each returns the fresh
 * full list on success so the client can update its in-memory copy without a
 * second round-trip; revalidatePath keeps the RSC cache honest too. Validation
 * failures come back as a field-error map (the client also validates for
 * instant inline errors — this is the server-side backstop).
 */
export type ActionResult =
  | { ok: true; plays: Play[] }
  | { ok: false; errors: FieldErrors };

/**
 * Defense in depth (FR-10/FR-13): a Server Action is a public POST endpoint and
 * must NOT trust that middleware ran. Each action independently re-verifies
 * session + allowlist BEFORE any DB access. An unauthenticated/uninvited
 * invocation performs no insert/update/delete and returns no archive data. We
 * throw (not return data) so a denied caller never receives a play list.
 */
async function requireInvited(): Promise<void> {
  if (!(await getInvitedUser())) {
    throw new Error("Not authorized");
  }
}

export async function createPlayAction(
  input: PlayInput,
): Promise<ActionResult> {
  await requireInvited();
  const db = await getDb();
  try {
    await createPlay(db, input);
  } catch (error) {
    if (error instanceof PlayValidationError) {
      return { ok: false, errors: error.errors };
    }
    throw error;
  }
  revalidatePath("/");
  return { ok: true, plays: await listPlays(db) };
}

export async function updatePlayAction(
  id: string,
  input: PlayInput,
): Promise<ActionResult> {
  await requireInvited();
  const db = await getDb();
  try {
    await updatePlay(db, id, input);
  } catch (error) {
    if (error instanceof PlayValidationError) {
      return { ok: false, errors: error.errors };
    }
    throw error;
  }
  revalidatePath("/");
  return { ok: true, plays: await listPlays(db) };
}

export async function deletePlayAction(id: string): Promise<ActionResult> {
  await requireInvited();
  const db = await getDb();
  await deletePlay(db, id);
  revalidatePath("/");
  return { ok: true, plays: await listPlays(db) };
}
