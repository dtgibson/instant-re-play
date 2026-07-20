import type { Config } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * `generate` reads src/db/schema.ts and emits SQL migrations into ./drizzle
 * with no database connection required — used for both PGlite and Neon since
 * the schema (and therefore the migration) is identical.
 *
 * `migrate` applies those migrations to the database named by DATABASE_URL
 * (the Neon production path). PGlite applies the same migrations
 * programmatically on startup (see src/db/index.ts).
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
} satisfies Config;
