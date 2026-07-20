"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ChartColumn,
  Filter,
  Plus,
  Search,
  Sprout,
  SearchX,
  X,
} from "lucide-react";

import {
  createPlayAction,
  deletePlayAction,
  updatePlayAction,
} from "@/app/actions";
import type { FieldErrors, Play, PlayInput } from "@/lib/play";
import {
  DEFAULT_SORT,
  defaultDirFor,
  filterAndSortPlays,
  nextSort,
  type ActiveFilter,
  type FilterType,
  type SortField,
} from "@/lib/query";
import { cn } from "@/lib/utils";

import { ConfirmDialog } from "./confirm-dialog";
import { ExportMenu } from "./export-menu";
import { PlayDrawer } from "./play-drawer";
import { PlayRow } from "./play-row";
import { SignOutControl } from "./sign-out-control";
import { Toast } from "./toast";

const EASE = [0.22, 0.61, 0.36, 1] as const;

const FILTER_LABEL: Record<FilterType, string> = {
  venue: "Showing plays at",
  playwright: "Written by",
  director: "Directed by",
  actor: "Featuring",
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PlayLog({
  initialPlays,
  initialFilter = null,
  signedInEmail = "",
}: {
  initialPlays: Play[];
  initialFilter?: ActiveFilter | null;
  signedInEmail?: string;
}) {
  const reduced = useReducedMotion();

  const [plays, setPlays] = useState<Play[]>(initialPlays);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [search, setSearch] = useState("");
  // FR-14: seed the single active filter from the /stats click-through param on
  // mount; absent → null → unfiltered exactly as today. The banner + Clear
  // control below are the same single-filter mechanism, unchanged.
  const [filter, setFilter] = useState<ActiveFilter | null>(initialFilter);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlay, setEditingPlay] = useState<Play | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Play | null>(null);

  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [toast, setToast] = useState({ message: "", show: false });

  const searchRef = useRef<HTMLInputElement | null>(null);
  const filterBarRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);
  const scrollPending = useRef(false);

  // ---- derived list (search + filter + sort), the single source of truth ----
  const view = useMemo(
    () => filterAndSortPlays(plays, { sort, search, filter }),
    [plays, sort, search, filter],
  );

  // ---- masthead trust stat ----
  const total = plays.length;
  const since = useMemo(() => {
    const years = plays
      .map((p) => (p.date ? Number(p.date.slice(0, 4)) : null))
      .filter((y): y is number => y !== null && !Number.isNaN(y));
    return years.length ? Math.min(...years) : null;
  }, [plays]);
  const playWord = total === 1 ? "play logged" : "plays logged";

  // ---- toast ----
  const showToast = useCallback((message: string) => {
    setToast({ message, show: true });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast((t) => ({ ...t, show: false })),
      2600,
    );
  }, []);

  const triggerSettle = useCallback((id: string) => {
    if (prefersReducedMotion()) return;
    setSettlingId(id);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettlingId(null), 400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, []);

  // scroll the filter banner into view when a filter becomes active by a click
  useEffect(() => {
    if (filter && scrollPending.current) {
      scrollPending.current = false;
      filterBarRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [filter]);

  // ---- sort ----
  const onSort = useCallback((field: SortField) => {
    setSort((current) => nextSort(current, field));
  }, []);

  // ---- click-to-filter (single active; re-click toggles off) ----
  const onFilter = useCallback((type: FilterType, value: string) => {
    setFilter((current) => {
      if (current && current.type === type && current.value === value) {
        return null; // toggle off
      }
      scrollPending.current = true;
      return { type, value };
    });
  }, []);

  const clearFilter = useCallback(() => setFilter(null), []);
  const clearSearchAndFilter = useCallback(() => {
    setFilter(null);
    setSearch("");
  }, []);

  // ---- drawer ----
  const openAdd = useCallback(() => {
    setEditingPlay(null);
    setDrawerOpen(true);
  }, []);
  const openEdit = useCallback(
    (id: string) => {
      const play = plays.find((p) => p.id === id);
      if (!play) return;
      setEditingPlay(play);
      setDrawerOpen(true);
    },
    [plays],
  );
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingPlay(null);
  }, []);

  const handleSubmit = useCallback(
    async (input: PlayInput): Promise<FieldErrors | null> => {
      const beforeIds = new Set(plays.map((p) => p.id));
      const result = editingPlay
        ? await updatePlayAction(editingPlay.id, input)
        : await createPlayAction(input);

      if (!result.ok) return result.errors;

      const savedName = input.name.trim();
      setPlays(result.plays);

      if (editingPlay) {
        triggerSettle(editingPlay.id);
        showToast(`Updated. “${savedName}” is saved.`);
      } else {
        const created = result.plays.find((p) => !beforeIds.has(p.id));
        // surface the new entry: default newest-first sort, no filter/search
        setSort(DEFAULT_SORT);
        setFilter(null);
        setSearch("");
        if (created) triggerSettle(created.id);
        showToast(`Saved. “${savedName}” is in your archive.`);
      }

      setDrawerOpen(false);
      setEditingPlay(null);
      return null;
    },
    [plays, editingPlay, showToast, triggerSettle],
  );

  // ---- delete ----
  const askDelete = useCallback(
    (id: string) => {
      const play = plays.find((p) => p.id === id);
      if (!play) return;
      setPendingDelete(play);
      setConfirmOpen(true);
    },
    [plays],
  );
  const cancelDelete = useCallback(() => {
    setConfirmOpen(false);
    setPendingDelete(null);
  }, []);
  const confirmDelete = useCallback(async () => {
    const play = pendingDelete;
    setConfirmOpen(false);
    setPendingDelete(null);
    if (!play) return;
    const isReduced = prefersReducedMotion();
    if (!isReduced) setRemovingId(play.id);
    const [result] = await Promise.all([
      deletePlayAction(play.id),
      delay(isReduced ? 0 : 200),
    ]);
    if (result.ok) setPlays(result.plays);
    setRemovingId(null);
    showToast(`“${play.name}” deleted.`);
  }, [pendingDelete, showToast]);

  // ---- states ----
  const hasRows = view.length > 0;
  const isEmptyLog = plays.length === 0;
  const isNoResults = plays.length > 0 && view.length === 0;

  const noResultsMsg = useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) parts.push(`the search “${search.trim()}”`);
    if (filter) parts.push("this filter");
    return parts.length
      ? `No plays match ${parts.join(" and ")}. Your other entries are still here. Clear to see them.`
      : "No plays match.";
  }, [search, filter]);

  // ---- motion (entrance rises; honors reduced motion) ----
  const rise = (delayMs: number) => ({
    initial: reduced ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.28, ease: EASE, delay: delayMs },
  });

  return (
    <>
      <header className="sky">
        <div className="shell">
          <div className="brandrow">
            <motion.div className="brand" {...rise(0.04)}>
              <p className="eyebrow">A private theatre archive</p>
              <h1 className="wordmark">
                Instant{" "}
                <span className="thin">
                  Re<span className="dot">&middot;</span>Play
                </span>
              </h1>
              <p className="tagline">A record of time well spent.</p>
            </motion.div>
            <motion.div className="headcluster" {...rise(0.12)}>
              <SignOutControl email={signedInEmail} />
              <div className="stat" aria-live="polite">
                <span className="stat-num">{total}</span>
                <span className="stat-cap">
                  {playWord}
                  {since !== null && (
                    <>
                      <br />
                      since {since}
                    </>
                  )}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      <main>
        <div className="shell">
          {/* control bar */}
          <motion.div className="controls" {...rise(0.15)}>
            <div className={cn("search", search.length > 0 && "has-value")}>
              <span className="ico" aria-hidden="true">
                <Search size={18} strokeWidth={1.8} />
              </span>
              <label htmlFor="searchInput" className="visually-hidden">
                Search your log by title, venue, director, or actor
              </label>
              <input
                ref={searchRef}
                id="searchInput"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search titles, venues, directors, actors&hellip;"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="clear-x"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
              >
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            {/* right-side action cluster: the two calm ghost actions (Stats,
                Export) sit to the LEFT of the single aloe primary, so the accent
                stays the terminal action and the eye always finds "Log a play". */}
            <div className="bar-actions">
              <Link href="/stats" className="btn btn-ghost btn-lg stats-link">
                <ChartColumn size={17} strokeWidth={1.9} aria-hidden="true" />
                Stats
              </Link>
              <ExportMenu playCount={plays.length} />
              <button
                type="button"
                className="btn btn-primary btn-lg add-btn"
                onClick={openAdd}
              >
                <Plus size={17} strokeWidth={2} aria-hidden="true" />
                Log a play
              </button>
            </div>
          </motion.div>

          {/* active-filter banner */}
          <div
            ref={filterBarRef}
            className={cn("filterbar", filter && "open")}
            role="status"
            aria-live="polite"
          >
            <span className="fb-ico" aria-hidden="true">
              <Filter size={16} strokeWidth={1.8} />
            </span>
            <span className="fb-text">
              {filter && (
                <>
                  <span className="fb-lbl">{FILTER_LABEL[filter.type]}</span>
                  <strong>{filter.value}</strong>
                </>
              )}
            </span>
            <button type="button" className="fb-clear" onClick={clearFilter}>
              <X size={13} strokeWidth={1.9} aria-hidden="true" />
              Clear filter
            </button>
          </div>

          {/* the log */}
          <section className="listwrap" aria-label="Logged plays">
            {hasRows && (
              <>
                <div
                  className="sort-mobile"
                  role="group"
                  aria-label="Sort the log"
                >
                  <span className="sm-lbl" aria-hidden="true">
                    Sort
                  </span>
                  <SortButton
                    field="date"
                    label="Date"
                    sortField={sort.field}
                    sortDir={sort.dir}
                    onSort={onSort}
                  />
                  <SortButton
                    field="name"
                    label="Title"
                    sortField={sort.field}
                    sortDir={sort.dir}
                    onSort={onSort}
                  />
                  <SortButton
                    field="venue"
                    label="Venue"
                    sortField={sort.field}
                    sortDir={sort.dir}
                    onSort={onSort}
                  />
                </div>

                <div className="logtable" role="table" aria-label="Logged plays">
                  <div className="thead" role="row">
                    <SortHeader
                      field="date"
                      label="Seen"
                      sortField={sort.field}
                      sortDir={sort.dir}
                      onSort={onSort}
                    />
                    <SortHeader
                      field="name"
                      label="Production"
                      sortField={sort.field}
                      sortDir={sort.dir}
                      onSort={onSort}
                    />
                    <SortHeader
                      field="venue"
                      label="Venue"
                      sortField={sort.field}
                      sortDir={sort.dir}
                      onSort={onSort}
                    />
                    <div className="th" role="columnheader">
                      Written by
                    </div>
                    <div className="th" role="columnheader">
                      Director
                    </div>
                    <div className="th" role="columnheader">
                      Cast
                    </div>
                    <div className="th th-actions" role="columnheader">
                      <span className="visually-hidden">Entry actions</span>
                    </div>
                  </div>

                  <ul className="ledger" role="rowgroup">
                    {view.map((play) => (
                      <PlayRow
                        key={play.id}
                        play={play}
                        filter={filter}
                        settling={play.id === settlingId}
                        removing={play.id === removingId}
                        onFilter={onFilter}
                        onEdit={openEdit}
                        onDelete={askDelete}
                      />
                    ))}
                  </ul>
                </div>
              </>
            )}

            {isEmptyLog && (
              <div className="state show">
                <span className="glyph" aria-hidden="true">
                  <Sprout size={30} strokeWidth={1.5} />
                </span>
                <h2>Your archive is open</h2>
                <p>
                  No plays logged yet. The first one you add settles in here,
                  the beginning of a record you can trust for years.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={openAdd}
                >
                  <Plus size={17} strokeWidth={2} aria-hidden="true" />
                  Log your first play
                </button>
              </div>
            )}

            {isNoResults && (
              <div className="state show">
                <span className="glyph" aria-hidden="true">
                  <SearchX size={30} strokeWidth={1.5} />
                </span>
                <h2>Nothing in the archive matches</h2>
                <p>{noResultsMsg}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-md"
                  onClick={clearSearchAndFilter}
                >
                  Clear search &amp; filter
                </button>
              </div>
            )}
          </section>
        </div>

        <footer>
          <div className="shell">
            <div className="foot-in">
              <p className="note">
                A private archive, kept just for you. Names link to an IMDb
                search, never a guessed page, so a link is never wrong,
                and venues carry no link at all.
              </p>
            </div>
          </div>
        </footer>
      </main>

      <PlayDrawer
        open={drawerOpen}
        editingPlay={editingPlay}
        plays={plays}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        play={pendingDelete}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />

      <Toast message={toast.message} show={toast.show} />
    </>
  );
}

function SortHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  const ariaSort = active
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : undefined;
  return (
    <div className="th" role="columnheader" aria-sort={ariaSort}>
      <button type="button" onClick={() => onSort(field)}>
        {label}
        <span className="arw" aria-hidden="true">
          <ArrowDown size={12} strokeWidth={2.2} />
        </span>
      </button>
    </div>
  );
}

function SortButton({
  field,
  label,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  const dir = active ? sortDir : defaultDirFor(field);
  return (
    <button
      type="button"
      className="sortbtn"
      aria-pressed={active}
      data-dir={dir}
      onClick={() => onSort(field)}
    >
      {label}
      <span className="arw" aria-hidden="true">
        <ArrowDown size={11} strokeWidth={2.2} />
      </span>
    </button>
  );
}
