import { getDb } from "@/db";
import { listPlays } from "@/db/repository";
import { getInvitedUser } from "@/lib/auth";
import {
  CONTENT_TYPE,
  exportFilename,
  isExportFormat,
  toCsv,
  toXlsxBuffer,
} from "@/lib/export";

// exceljs is a Node/Buffer library, not Edge-compatible; the read + serialize
// pipeline runs entirely in the app's own runtime and Postgres (NFR-02).
export const runtime = "nodejs";
// FR-13: read the archive at request time, never a cached/stale build snapshot.
export const dynamic = "force-dynamic";

/**
 * GET /api/export?format=csv|xlsx — stream the ENTIRE archive as a download
 * (FR-01/FR-10/FR-13). Reuses the existing repository read (`listPlays`) so the
 * default order (FR-03) lives in exactly one place. An unknown format is
 * rejected with 400 (the UI only ever sends csv/xlsx).
 */
export async function GET(request: Request): Promise<Response> {
  // Defense in depth (FR-10/FR-12): re-verify session + allowlist BEFORE any DB
  // read, independently of middleware. A denied caller streams no file and reads
  // no play data — 401, not a redirect, since this is a data endpoint.
  if (!(await getInvitedUser())) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const format = new URL(request.url).searchParams.get("format");
  if (!isExportFormat(format)) {
    return new Response(
      `Unknown export format: ${format ?? "(none)"}. Use format=csv or format=xlsx.`,
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const db = await getDb();
  const plays = await listPlays(db);

  const headers = new Headers({
    "Content-Type": CONTENT_TYPE[format],
    "Content-Disposition": `attachment; filename="${exportFilename(format)}"`,
    "Cache-Control": "no-store",
  });

  const body =
    format === "csv" ? toCsv(plays) : await toXlsxBuffer(plays);
  return new Response(body, { headers });
}
