import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Leaf } from "lucide-react";

import { SignOutControl } from "@/components/sign-out-control";
import { getDb } from "@/db";
import { listPlays } from "@/db/repository";
import { getInvitedUser } from "@/lib/auth";
import { filterHref, type FilterType } from "@/lib/query";
import { computeStats, type RankedValue, type Stats } from "@/lib/stats";
import { cn } from "@/lib/utils";

// Recompute every figure live from the current archive on each load (FR-03):
// same dynamic read the log and export use, so the numbers stay true as the log
// grows and PGlite stays out of the build step.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Instant Re-Play · Stats",
  description:
    "The shape of your theatregoing, counted fresh from your archive every time you look.",
};

const EN_DASH = "–";
const RSQUO = "’";

export default async function StatsPage() {
  // Defense in depth (FR-10/FR-11): re-verify session + allowlist BEFORE any DB
  // read, independently of middleware. An unauthenticated/uninvited request
  // renders no archive content.
  const user = await getInvitedUser();
  if (!user) {
    redirect("/login");
  }

  const db = await getDb();
  const plays = await listPlays(db);
  const stats = computeStats(plays);

  return (
    <>
      <header className="sky sky-stats">
        <div className="shell">
          <div className="headtop">
            <Link className="backlink" href="/">
              <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
              Back to the log
            </Link>
            <SignOutControl email={user.email ?? ""} />
          </div>
          <div className="brand brand-rise">
            <p className="eyebrow">
              <span className="mark">
                Instant Re<span className="dot">&middot;</span>Play
              </span>
            </p>
            <h1 className="page-title">The shape of your theatregoing</h1>
            <p className="tagline">
              Counted fresh from your archive, every time you look.
            </p>
          </div>
        </div>
      </header>

      <main>
        <div className="shell">
          {stats.total === 0 ? <EmptyArchive /> : <FullStats stats={stats} />}

          <footer>
            <div className="foot-in">
              <p className="note">
                Every figure is counted live from your archive each time you
                open this page. Nothing is precomputed or stored. Reach it from
                the quiet &ldquo;Stats&rdquo; link beside Export on the log.
              </p>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}

function FullStats({ stats }: { stats: Stats }) {
  const spanLabel = stats.span
    ? stats.span.from === stats.span.to
      ? String(stats.span.from)
      : `${stats.span.from}${EN_DASH}${stats.span.to}`
    : "No dates yet";

  const maxYear = stats.perYear.reduce((m, y) => Math.max(m, y.count), 0);

  const undatedNote =
    stats.undatedCount > 0
      ? `${stats.undatedCount} undated ${
          stats.undatedCount === 1 ? "play" : "plays"
        } aren${RSQUO}t shown by year. `
      : "";
  const yearNote = `${undatedNote}Bar length is relative to your busiest year; the count is always written out.`;

  return (
    <div className="stack">
      {/* ---- Headline tiles ---- */}
      <section aria-label="At a glance">
        <div className="tilewrap">
          <div className="tile plane tile-total">
            <div className="lead">
              <span className="tile-num">{stats.total}</span>
              <span className="tile-cap">
                {stats.total === 1 ? "play logged" : "plays logged"}
              </span>
            </div>
            <p className="aside">
              A record of time well spent, counted live from the archive.
            </p>
          </div>

          <div className="tile plane">
            <span className="tile-num range">{spanLabel}</span>
            <span className="tile-cap">Years spanned</span>
          </div>
          <div className="tile plane">
            <span className="tile-num">{stats.distinctVenues}</span>
            <span className="tile-cap">Distinct venues</span>
          </div>
          <div className="tile plane">
            <span className="tile-num">{stats.distinctDirectors}</span>
            <span className="tile-cap">Distinct directors</span>
          </div>
          <div className="tile plane">
            <span className="tile-num">{stats.distinctActors}</span>
            <span className="tile-cap">Distinct actors</span>
          </div>
        </div>
      </section>

      {/* ---- Plays per year ---- */}
      <section aria-labelledby="yearHead">
        <div className="sec-head">
          <p className="sec-eyebrow">The rhythm</p>
          <h2 className="sec-title" id="yearHead">
            Plays per year
          </h2>
          <p className="sec-note">
            <span className="dot" aria-hidden="true" />
            {yearNote}
          </p>
        </div>
        {stats.perYear.length > 0 ? (
          <div className="yearstrip plane">
            <ul className="yearlist">
              {stats.perYear.map((row) => {
                const width = maxYear > 0 ? (row.count / maxYear) * 100 : 0;
                return (
                  <li className="yearrow" key={row.year}>
                    <span className="yr-year">{row.year}</span>
                    <span className="yr-track" aria-hidden="true">
                      <span
                        className="yr-fill"
                        style={{ width: `${width.toFixed(1)}%` }}
                      />
                    </span>
                    <span className="yr-count">{row.count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="yearstrip plane">
            <p className="seen-empty">
              No year breakdown yet, because no entries are dated.
            </p>
          </div>
        )}
      </section>

      {/* ---- Most seen ---- */}
      <section aria-labelledby="seenHead">
        <div className="sec-head">
          <p className="sec-eyebrow">Across the archive</p>
          <h2 className="sec-title" id="seenHead">
            The names you return to
          </h2>
          <p className="sec-note">
            <span className="dot" aria-hidden="true" />
            Choose a name to open your log filtered to it. Every count is a
            doorway into the entries behind it.
          </p>
        </div>

        <div className="seenwrap">
          <MostSeen
            kicker="Most visited"
            title="Venues"
            type="venue"
            items={stats.topVenues}
          />
          <MostSeen
            kicker="Most seen"
            title="Directors"
            type="director"
            items={stats.topDirectors}
          />
          <MostSeen
            kicker="Most seen"
            title="Actors"
            type="actor"
            items={stats.topActors}
          />
        </div>
      </section>
    </div>
  );
}

function MostSeen({
  kicker,
  title,
  type,
  items,
}: {
  kicker: string;
  title: string;
  type: FilterType;
  items: RankedValue[];
}) {
  return (
    <div className="seen plane">
      <p className="seen-kicker">{kicker}</p>
      <h3 className="seen-title">{title}</h3>
      {items.length > 0 ? (
        <ul className="seen-list">
          {items.map((item) => (
            <li className="seen-row" key={item.value}>
              <Link
                className={cn("fval", type === "venue" && "venue")}
                href={filterHref(type, item.value)}
              >
                {item.value}
              </Link>
              <span className="seen-count">{item.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="seen-empty">Not enough logged yet.</p>
      )}
    </div>
  );
}

function EmptyArchive() {
  return (
    <div className="empty plane" aria-label="Your archive is empty">
      <span className="glyph" aria-hidden="true">
        <Leaf size={31} strokeWidth={1.5} />
      </span>
      <h2>Nothing to count yet</h2>
      <p>
        This is where your theatregoing adds up: the years you{RSQUO}ve spanned,
        the venues you return to, the names you{RSQUO}ve seen most. Log your
        first play and the picture starts to form.
      </p>
      <Link className="btn btn-ghost btn-lg" href="/">
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        Back to the log to add your first play
      </Link>
    </div>
  );
}
