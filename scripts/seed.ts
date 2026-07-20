import path from "node:path";

import { createPgliteDatabaseAt, getDb } from "@/db";
import { replaceAllPlays } from "@/db/repository";
import { SEED_PLAYS } from "@/lib/seed-data";

/**
 * Load the realistic sample log (the ~14 West End entries, edge cases and all)
 * into the same database the app uses. Safe to re-run: it clears the log first,
 * then inserts. The app ships EMPTY — this is opt-in via `npm run seed`.
 */
async function main() {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Neon (production) — seed via the shared handle.
    const db = await getDb();
    const n = await replaceAllPlays(db, SEED_PLAYS);
    console.log(`Seeded ${n} plays into the Neon database.`);
    return;
  }

  // Local PGlite — open the persisted store, seed, and close cleanly so the
  // writes are flushed to disk before the process exits.
  const dir =
    process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const { db, close } = await createPgliteDatabaseAt(dir);
  const n = await replaceAllPlays(db, SEED_PLAYS);
  await close();
  console.log(`Seeded ${n} plays into ${dir}.`);
  console.log("Run `npm run dev` and open http://localhost:3000 to see them.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
