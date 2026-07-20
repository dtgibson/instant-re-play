import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";

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
import { isFuture } from "@/lib/play";
import { filterAndSortPlays, type SortState } from "@/lib/query";
import { SEED_PLAYS } from "@/lib/seed-data";

let passed = 0;
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

async function expectThrows(
  fn: () => Promise<unknown>,
  check: (e: unknown) => boolean,
  message: string,
) {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = check(e);
    if (!threw) throw new Error(`Wrong error thrown for: ${message} (${e})`);
  }
  assert(threw, message);
}

async function countActors(db: AppDatabase, playId: string): Promise<number> {
  const rows = await db
    .select()
    .from(playActors)
    .where(eq(playActors.playId, playId));
  return rows.length;
}

const sort = (field: SortState["field"], dir: SortState["dir"]): SortState => ({
  field,
  dir,
});

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "instant-replay-smoke-"));
  console.log(`\nSmoke test — temp PGlite dir: ${dir}\n`);

  let { db, close } = await createPgliteDatabaseAt(dir);

  // ---------------------------------------------------------------------------
  console.log("CREATE — normalization (trim / dedupe / drop-empty / order)");
  const created = await createPlay(db, {
    name: "  Hamlet  ",
    date: "2024-01-05",
    venue: "  Almeida Theatre  ",
    director: "  Robert Icke  ",
    actors: [" Andrew Scott ", "Andrew Scott", "   ", "Juliet Stevenson"],
  });
  assert(created.name === "Hamlet", "name is trimmed");
  assert(created.venue === "Almeida Theatre", "venue is trimmed");
  assert(created.director === "Robert Icke", "director is trimmed");
  assert(
    JSON.stringify(created.actors) ===
      JSON.stringify(["Andrew Scott", "Juliet Stevenson"]),
    "actors trimmed, exact-duplicate deduped, empty dropped, order preserved",
  );

  console.log("CREATE — validation rejections");
  await expectThrows(
    () => createPlay(db, { name: "   ", date: "", venue: "", director: "", actors: [] }),
    (e) => e instanceof PlayValidationError && !!e.errors.name,
    "empty/whitespace name is rejected (FR-02)",
  );
  await expectThrows(
    () =>
      createPlay(db, {
        name: "Impossible Date",
        date: "2024-02-31",
        venue: "",
        director: "",
        actors: [],
      }),
    (e) => e instanceof PlayValidationError && !!e.errors.date,
    "impossible calendar date 2024-02-31 is rejected (FR-04)",
  );
  await expectThrows(
    () =>
      createPlay(db, {
        name: "Malformed Date",
        date: "not-a-date",
        venue: "",
        director: "",
        actors: [],
      }),
    (e) => e instanceof PlayValidationError && !!e.errors.date,
    "malformed date is rejected (FR-04)",
  );

  console.log("CREATE — future date accepted");
  const future = await createPlay(db, {
    name: "Waiting for Godot (Future)",
    date: "2099-12-31",
    venue: "Theatre Royal Haymarket",
    director: "James Macdonald",
    actors: ["Ben Whishaw"],
  });
  assert(future.date === "2099-12-31", "future date is stored");
  assert(isFuture(future.date), "future date is flagged as upcoming (FR-04)");

  // ---------------------------------------------------------------------------
  console.log("SEED — replaceAllPlays loads the known sample set");
  const seeded = await replaceAllPlays(db, SEED_PLAYS);
  assert(seeded === 14, "replaceAllPlays inserted 14 entries");

  // ---------------------------------------------------------------------------
  console.log("LIST — default sort is date DESC NULLS LAST (from the DB)");
  const list = await listPlays(db);
  assert(list.length === 14, "listPlays returns all 14 entries");
  assert(
    list[0].name === "Waiting for Godot",
    "newest-dated entry (2026-09-16) is first",
  );
  assert(list[12].date === "" && list[13].date === "", "the two undated entries are last (blanks last)");
  assert(
    list.slice(0, 12).every((p) => p.date !== ""),
    "every dated entry precedes the undated ones",
  );

  // ---------------------------------------------------------------------------
  console.log("SORT — name asc/desc (locale, no blanks in name)");
  const nameAsc = filterAndSortPlays(list, {
    sort: sort("name", "asc"),
    search: "",
    filter: null,
  });
  const nameDesc = filterAndSortPlays(list, {
    sort: sort("name", "desc"),
    search: "",
    filter: null,
  });
  assert(
    nameAsc[0].name === "A Midsummer Night's Dream",
    "name asc starts with 'A Midsummer Night's Dream'",
  );
  assert(
    nameDesc[0].name === nameAsc[nameAsc.length - 1].name,
    "name desc is the reverse of name asc",
  );

  console.log("SORT — venue asc/desc with blanks last in BOTH directions");
  const venueAsc = filterAndSortPlays(list, {
    sort: sort("venue", "asc"),
    search: "",
    filter: null,
  });
  const venueDesc = filterAndSortPlays(list, {
    sort: sort("venue", "desc"),
    search: "",
    filter: null,
  });
  assert(
    venueAsc[venueAsc.length - 1].venue === "",
    "venue asc: blank venue sorts last",
  );
  assert(
    venueDesc[venueDesc.length - 1].venue === "",
    "venue desc: blank venue ALSO sorts last",
  );
  assert(
    venueAsc[0].venue === "Almeida Theatre",
    "venue asc first is 'Almeida Theatre'",
  );

  // ---------------------------------------------------------------------------
  console.log("SEARCH — case-insensitive substring across all fields");
  const byActor = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "mescal",
    filter: null,
  });
  assert(
    byActor.length === 1 && byActor[0].name === "A Streetcar Named Desire",
    "actor-surname search 'mescal' returns only Streetcar",
  );
  const byActorUpper = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "MESCAL",
    filter: null,
  });
  assert(
    byActorUpper.length === 1,
    "search is case-insensitive ('MESCAL' == 'mescal')",
  );
  const byDirector = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "mendes",
    filter: null,
  });
  assert(
    byDirector.length === 3,
    "director search 'mendes' returns 3 (Motive, Lehman, Hills)",
  );
  const byVenue = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "wyndham",
    filter: null,
  });
  assert(byVenue.length === 2, "venue search 'wyndham' returns 2");

  // ---------------------------------------------------------------------------
  console.log("FILTER — exact click-to-filter on venue/director/actor");
  const fVenue = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "",
    filter: { type: "venue", value: "Duke of York's Theatre" },
  });
  assert(fVenue.length === 3, "venue filter (Duke of York's) returns 3");
  const fDirector = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "",
    filter: { type: "director", value: "Sam Mendes" },
  });
  assert(fDirector.length === 3, "director filter (Sam Mendes) returns 3");
  const fActor = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "",
    filter: { type: "actor", value: "Andrew Scott" },
  });
  assert(
    fActor.length === 1 && fActor[0].name === "Vanya",
    "actor filter (Andrew Scott) returns only Vanya",
  );
  const fCaseVariant = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "",
    filter: { type: "venue", value: "duke of york's theatre" },
  });
  assert(
    fCaseVariant.length === 0,
    "filter is exact + case-sensitive (a case variant matches nothing)",
  );

  // ---------------------------------------------------------------------------
  console.log("FILTER + SEARCH — combine with AND");
  const combined = filterAndSortPlays(list, {
    sort: sort("date", "desc"),
    search: "lehman",
    filter: { type: "director", value: "Sam Mendes" },
  });
  assert(
    combined.length === 1 && combined[0].name === "The Lehman Trilogy",
    "director=Sam Mendes AND search='lehman' returns only Lehman",
  );

  // ---------------------------------------------------------------------------
  console.log("EDIT — replace actor set and update fields");
  const streetcar = list.find((p) => p.name === "A Streetcar Named Desire")!;
  assert(streetcar.actors.length === 3, "Streetcar starts with 3 actors");
  const edited = await updatePlay(db, streetcar.id, {
    name: "A Streetcar Named Desire",
    date: "2024-01-12",
    venue: "Almeida Theatre (Islington)",
    director: "Rebecca Frecknall",
    actors: ["Paul Mescal", "Anjana Vasan"],
  });
  assert(
    edited.venue === "Almeida Theatre (Islington)",
    "edited venue is updated",
  );
  assert(
    JSON.stringify(edited.actors) ===
      JSON.stringify(["Paul Mescal", "Anjana Vasan"]),
    "actor set is fully replaced (Patsy Ferran removed)",
  );
  assert(
    (await countActors(db, streetcar.id)) === 2,
    "play_actors reflects the replaced set (2 rows, no orphans)",
  );

  // ---------------------------------------------------------------------------
  console.log("DELETE — removes the entry and cascades to actors");
  const lehman = list.find((p) => p.name === "The Lehman Trilogy")!;
  assert((await countActors(db, lehman.id)) === 3, "Lehman has 3 actor rows");
  await deletePlay(db, lehman.id);
  assert((await getPlay(db, lehman.id)) === null, "deleted play is gone");
  assert(
    (await countActors(db, lehman.id)) === 0,
    "ON DELETE CASCADE removed its actor rows",
  );
  const afterDelete = await listPlays(db);
  assert(afterDelete.length === 13, "log now has 13 entries");

  // ---------------------------------------------------------------------------
  console.log("PERSISTENCE — reopen the same PGlite dir, data survives (FR-20)");
  await close();
  ({ db, close } = await createPgliteDatabaseAt(dir));
  const reopened = await listPlays(db);
  assert(reopened.length === 13, "reopened DB still has 13 entries");
  assert(
    reopened.find((p) => p.name === "The Lehman Trilogy") === undefined,
    "the deleted entry stays deleted after reopen",
  );
  const reopenedStreetcar = reopened.find(
    (p) => p.name === "A Streetcar Named Desire",
  )!;
  assert(
    reopenedStreetcar.venue === "Almeida Theatre (Islington)" &&
      reopenedStreetcar.actors.length === 2,
    "the edit persisted across the reopen",
  );
  assert(
    reopened[0].name === "Waiting for Godot",
    "default date-desc order persists across the reopen",
  );
  await close();

  rmSync(dir, { recursive: true, force: true });
  console.log(`\nSMOKE PASS — ${passed} assertions passed.\n`);
}

main().catch((error) => {
  console.error("\nSMOKE FAIL:", error);
  process.exit(1);
});
