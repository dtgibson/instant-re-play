import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPgliteDatabaseAt, type AppDatabase } from "@/db";
import { playActors } from "@/db/schema";
import {
  createPlay,
  deletePlay,
  getPlay,
  listPlays,
  PlayValidationError,
  replaceAllPlays,
  updatePlay,
} from "@/db/repository";
import { SEED_PLAYS } from "@/lib/seed-data";

describe("repository against real PGlite Postgres", () => {
  let dir: string;
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "instant-replay-repo-"));
    ({ db, close } = await createPgliteDatabaseAt(dir));
  });

  afterAll(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates with normalization applied (FR-06)", async () => {
    const created = await createPlay(db, {
      name: "  Hamlet  ",
      date: "2024-01-05",
      venue: "  Almeida  ",
      director: "  Robert Icke  ",
      actors: [" Andrew Scott ", "Andrew Scott", "  ", "Juliet Stevenson"],
    });
    expect(created.name).toBe("Hamlet");
    expect(created.venue).toBe("Almeida");
    expect(created.actors).toEqual(["Andrew Scott", "Juliet Stevenson"]);
  });

  it("rejects an empty name and an invalid date (FR-02 / FR-04)", async () => {
    await expect(
      createPlay(db, { name: "   ", date: "", venue: "", director: "", actors: [] }),
    ).rejects.toBeInstanceOf(PlayValidationError);
    await expect(
      createPlay(db, {
        name: "X",
        date: "2024-02-31",
        venue: "",
        director: "",
        actors: [],
      }),
    ).rejects.toBeInstanceOf(PlayValidationError);
  });

  it("accepts a future date", async () => {
    const created = await createPlay(db, {
      name: "Future Show",
      date: "2099-12-31",
      venue: "",
      director: "",
      actors: [],
    });
    expect(created.date).toBe("2099-12-31");
  });

  it("lists in date DESC NULLS LAST order (FR-11)", async () => {
    await replaceAllPlays(db, SEED_PLAYS);
    const list = await listPlays(db);
    expect(list).toHaveLength(14);
    expect(list[0].name).toBe("Waiting for Godot");
    expect(list[12].date).toBe("");
    expect(list[13].date).toBe("");
  });

  it("replaces the actor set on edit (FR-08)", async () => {
    const list = await listPlays(db);
    const streetcar = list.find((p) => p.name === "A Streetcar Named Desire")!;
    expect(streetcar.actors).toHaveLength(3);

    const updated = await updatePlay(db, streetcar.id, {
      name: streetcar.name,
      date: streetcar.date,
      venue: "Almeida (Islington)",
      director: streetcar.director,
      actors: ["Paul Mescal"],
    });
    expect(updated.venue).toBe("Almeida (Islington)");
    expect(updated.actors).toEqual(["Paul Mescal"]);

    const actorRows = await db
      .select()
      .from(playActors)
      .where(eq(playActors.playId, streetcar.id));
    expect(actorRows).toHaveLength(1);
  });

  it("cascades actor deletion when a play is deleted (FR-09)", async () => {
    const list = await listPlays(db);
    const lehman = list.find((p) => p.name === "The Lehman Trilogy")!;
    await deletePlay(db, lehman.id);
    expect(await getPlay(db, lehman.id)).toBeNull();
    const actorRows = await db
      .select()
      .from(playActors)
      .where(eq(playActors.playId, lehman.id));
    expect(actorRows).toHaveLength(0);
  });
});

describe("playwright field (additive column, migration 0001)", () => {
  let dir: string;
  let db: AppDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "instant-replay-pw-"));
    ({ db, close } = await createPgliteDatabaseAt(dir));
  });
  afterAll(async () => {
    await close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates and reads back a play WITH a playwright (trimmed)", async () => {
    const created = await createPlay(db, {
      name: "The Glass Menagerie",
      date: "2024-05-01",
      venue: "Duke of York's",
      playwright: "  Tennessee Williams  ",
      director: "Jeremy Herrin",
      actors: ["Amy Adams"],
    });
    expect(created.playwright).toBe("Tennessee Williams");
    const read = await getPlay(db, created.id);
    expect(read?.playwright).toBe("Tennessee Williams");
  });

  it("stores a pre-existing / omitted playwright as blank (NULL → \"\")", async () => {
    const created = await createPlay(db, {
      name: "Undocumented Author",
      date: "",
      venue: "",
      director: "",
      actors: [],
    }); // playwright omitted entirely (additive/optional)
    expect(created.playwright).toBe("");
    const read = await getPlay(db, created.id);
    expect(read?.playwright).toBe("");
  });

  it("replaces the playwright on edit", async () => {
    const created = await createPlay(db, {
      name: "Vanya",
      date: "",
      venue: "",
      playwright: "Anton Chekhov",
      director: "Sam Yates",
      actors: [],
    });
    const edited = await updatePlay(db, created.id, {
      name: "Uncle Vanya",
      date: "",
      venue: "",
      playwright: "Anton Chekhov (adapted by Simon Stephens)",
      director: "Sam Yates",
      actors: [],
    });
    expect(edited.playwright).toBe("Anton Chekhov (adapted by Simon Stephens)");
  });

  it("clears the playwright when edited to blank", async () => {
    const created = await createPlay(db, {
      name: "Blankable",
      date: "",
      venue: "",
      playwright: "Someone",
      director: "",
      actors: [],
    });
    const edited = await updatePlay(db, created.id, {
      name: "Blankable",
      date: "",
      venue: "",
      playwright: "   ",
      director: "",
      actors: [],
    });
    expect(edited.playwright).toBe("");
  });
});

describe("persistence across sessions (FR-20)", () => {
  it("reopens the same directory and reads the same data", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "instant-replay-persist-"));
    try {
      const first = await createPgliteDatabaseAt(dir);
      await createPlay(first.db, {
        name: "The Lehman Trilogy",
        date: "2019-07-18",
        venue: "Gillian Lynne Theatre",
        director: "Sam Mendes",
        actors: ["Simon Russell Beale", "Adam Godley", "Ben Miles"],
      });
      await first.close();

      const second = await createPgliteDatabaseAt(dir);
      const list = await listPlays(second.db);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("The Lehman Trilogy");
      expect(list[0].actors).toHaveLength(3);
      await second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
