import { mkdirSync } from "node:fs";
import path from "node:path";

import { drizzle as pgliteDrizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";

/**
 * The app-wide database type.
 *
 * We standardise on the PGlite Drizzle type because PGlite is the exercised
 * path (local dev, tests, and this verification) and it exposes the full,
 * honestly-typed Drizzle Postgres query surface. The Neon branch produces a
 * structurally identical `PgDatabase` (same schema, same queries — PGlite *is*
 * Postgres) and is cast to this type. This is a driver/implementation choice,
 * not a schema change: both drivers run the same generated migration.
 */
export type AppDatabase = PgliteDatabase<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

function defaultPgliteDir() {
  return (
    process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite")
  );
}

/**
 * Build a Drizzle client for whichever environment we are in.
 *
 * - DATABASE_URL set  → Neon serverless (production). Migrations are applied at
 *   deploy time via `npm run db:migrate`, not here.
 * - DATABASE_URL unset → PGlite, an embedded WASM Postgres persisted to a local
 *   directory, with the generated migration applied programmatically on init so
 *   `npm run dev` works out of the box and the log survives restarts (FR-20).
 */
async function createDatabase(): Promise<AppDatabase> {
  const url = process.env.DATABASE_URL;

  if (url) {
    // --- Production: Neon serverless (same schema, same queries) ---
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const { drizzle: neonDrizzle } = await import(
      "drizzle-orm/neon-serverless"
    );
    // Node 22+ ships a global WebSocket; Neon's Pool uses it for sessions and
    // transactions. Guarded so it is only touched on the Neon path.
    if (typeof WebSocket !== "undefined") {
      neonConfig.webSocketConstructor = WebSocket as never;
    }
    const pool = new Pool({ connectionString: url });
    return neonDrizzle(pool, { schema }) as unknown as AppDatabase;
  }

  // --- Local / dev / tests: embedded PGlite persisted to disk ---
  const { PGlite } = await import("@electric-sql/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const dir = defaultPgliteDir();
  mkdirSync(dir, { recursive: true });
  const client = await PGlite.create(dir);
  const db = pgliteDrizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

// Cache the connection across HMR reloads in dev (Next re-evaluates modules on
// every change; without this each reload would open a fresh PGlite handle on
// the same data directory).
const globalForDb = globalThis as unknown as {
  __instantReplayDb?: Promise<AppDatabase>;
};

/** Get the shared database handle (created once per process). */
export function getDb(): Promise<AppDatabase> {
  if (!globalForDb.__instantReplayDb) {
    globalForDb.__instantReplayDb = createDatabase();
  }
  return globalForDb.__instantReplayDb;
}

/**
 * Create a fresh, isolated PGlite-backed database at a specific directory and
 * apply migrations. Used by tests and the smoke script; not for app runtime.
 */
export async function createPgliteDatabaseAt(
  dataDir: string,
): Promise<{ db: AppDatabase; close: () => Promise<void> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  mkdirSync(dataDir, { recursive: true });
  const client = await PGlite.create(dataDir);
  const db = pgliteDrizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
}

export { schema };
