import { redirect } from "next/navigation";

import { PlayLog } from "@/components/play-log";
import { getDb } from "@/db";
import { listPlays } from "@/db/repository";
import { getInvitedUser } from "@/lib/auth";
import { parseFilter } from "@/lib/query";

// The log is read from Postgres on every request; mutations revalidate this
// path. Forcing dynamic keeps the embedded PGlite database out of the build
// step (it is only ever touched at request time).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Defense in depth (FR-10/FR-11): re-verify session + allowlist BEFORE any DB
  // read, independently of middleware. An unauthenticated/uninvited request
  // renders no archive content.
  const user = await getInvitedUser();
  if (!user) {
    redirect("/login");
  }

  // FR-14: seed the log's existing single filter from the /stats click-through
  // query params. Absent or malformed → null → the log loads unfiltered.
  const sp = await searchParams;
  const initialFilter = parseFilter({
    filter: typeof sp.filter === "string" ? sp.filter : undefined,
    value: typeof sp.value === "string" ? sp.value : undefined,
  });

  const db = await getDb();
  const plays = await listPlays(db);
  return (
    <PlayLog
      initialPlays={plays}
      initialFilter={initialFilter}
      signedInEmail={user.email ?? ""}
    />
  );
}
