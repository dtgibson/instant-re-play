// Runs at build time on Vercel (see vercel.json buildCommand), where the Neon
// DATABASE_URL is available. Applies the generated drizzle migrations to the
// production database, then the normal Next.js build proceeds. Idempotent:
// drizzle records applied migrations and never re-applies them. On dev/preview
// builds with no DATABASE_URL it is a no-op, so local `next build` is unaffected.
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] no DATABASE_URL — skipping (build without a database)");
  process.exit(0);
}
if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString: url });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("[migrate] migrations applied to the production database");
} finally {
  await pool.end();
}
