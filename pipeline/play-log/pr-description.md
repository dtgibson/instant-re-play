## Play Log

The founding feature of Instant Re-Play: a private, single-user archive of every
stage play you've seen. A sortable, searchable, click-to-filter list of plays,
plus an add/edit drawer and delete confirmation — persisted to Postgres.

Implements every requirement in `prd.md` (FR-01…FR-20, NFR-01…05) against the
approved Neutra "elevation" design in `design.html`, and the exact two-table
schema in `schema.md`.

### What this does

- **The log** — every entry rendered as a floating plaster plane (ARIA table on
  desktop, stacked labeled bands on mobile) showing date seen, production, venue,
  director, and full cast. Blank optional fields are omitted entirely, so nothing
  reads as placeholder data (FR-03). Future-dated entries carry an "Upcoming" tag.
- **Add / edit drawer** — name required with an inline error that preserves every
  other entered value (FR-02); date validated as a genuine calendar date, past or
  future (FR-04); venue/director optional; a one-at-a-time, removable,
  order-preserving cast sub-form. On save, values are trimmed, empty actors
  dropped, and exact-duplicate actors deduped (FR-06).
- **Edit + delete** — edit pre-fills current values and re-validates; delete is
  behind an explicit, focus-trapped confirm dialog with no undo (FR-08/FR-09).
- **Sort** — default date seen newest-first; toggle asc/desc on date, production,
  and venue; blanks always sorted last in both directions (FR-11). One handler
  drives the desktop `aria-sort` headers and the mobile sort segment.
- **Search** — live, case-insensitive substring across name, venue, director, and
  any actor (FR-13), combining with an active filter via AND (FR-17).
- **Click-to-filter** — every venue, director, and actor value filters the list to
  exact stored-text matches (actor = any-match). One filter at a time; re-clicking
  toggles it off; a visible banner names the active filter with one-click clear
  (FR-15/FR-16/FR-17).
- **IMDb links** — a visually distinct boxed external-link icon beside people's
  names only (shape + icon, never colour alone), opening an IMDb name-search in a
  new tab with `rel="noopener noreferrer"` (FR-18/NFR-04/NFR-05). Venues carry no
  link (FR-19).
- **States** — a designed empty state (the honest first run) and a distinct
  no-results state with a one-action clear (FR-12/FR-14).
- **Accessibility & motion** — full keyboard operability, focus-trapped drawer and
  dialog that restore focus and close on Escape, visible labels on all fields, and
  a `prefers-reduced-motion` path throughout (NFR-04). Responsive to 360px with no
  horizontal page scroll (NFR-01).
- **Persistence** — creates, edits, and deletes survive restarts (FR-20).

### Architecture

- **Next.js (App Router) + TypeScript.** `/` is a Server Component that reads the
  full log from Postgres and hands it to a Client Component. Mutations go through
  three Server Actions (`create`/`update`/`delete`) that return the fresh list and
  `revalidatePath('/')`.
- **Drizzle ORM, exact `schema.md` schema.** `plays` + `play_actors`, all columns,
  the `btrim(...) <> ''` checks, both `UNIQUE(play_id, …)` constraints, the
  `ON DELETE CASCADE` FK, and the four indexes including
  `plays(date_seen DESC NULLS LAST)`. The generated migration is
  `drizzle/0000_init.sql`.
- **DB driver factory (`src/db/index.ts`).** Same schema, two drivers:
  - No `DATABASE_URL` → **PGlite** (embedded WASM Postgres) persisted to
    `./.data/pglite`, with the generated migration applied programmatically on
    startup. `npm run dev` works with zero external services.
  - `DATABASE_URL` set → **Neon serverless** (production), migrations applied at
    deploy time via `npm run db:migrate`.
- Row ids are generated app-side with `crypto.randomUUID()` (driver-agnostic); the
  DB `gen_random_uuid()` default is a backstop.
- **Core logic is pure and shared** (`src/lib/play.ts`, `src/lib/query.ts`):
  normalization, validation, date handling, IMDb URL, and the search/filter/sort
  derivation — used by both the client (instant, no round-trip) and the tests.

### How to test

```bash
npm install
npm run typecheck     # tsc --noEmit — zero errors
npm run build         # next build — succeeds
npm run smoke         # headless PGlite data-layer + logic check (40 assertions)
npm test              # vitest unit + integration (31 tests)
npm run seed          # load the 14-entry sample log
npm run dev           # http://localhost:3000
```

Manual walk-through is in `how-to-run.md`. In the app: add a play (try an empty
name and an impossible date to see inline errors), edit it, delete it (confirm),
sort by the column headers, type in search, click a venue/director/actor to filter,
re-click to toggle off, and click an actor's IMDb icon. Reload to confirm
persistence. Narrow to 360px to confirm the mobile bands and no horizontal scroll.

### Notes for reviewer (decisions flagged)

- **PGlite for local/dev/CI, Neon for production — a driver choice, not a schema
  change.** PGlite *is* Postgres, so the approved schema and every query run
  unchanged on both. This is what makes the app runnable and testable hands-off
  with no cloud provisioning. `.env.example` documents the Neon path.
- **Live search/filter/sort run client-side over the full log.** The page loads
  every entry once in the DB's indexed default order
  (`date_seen DESC NULLS LAST`); the client then derives the visible list in
  memory. For a single-user log at the NFR-03 ceiling (≤1,000 entries) this is
  imperceptible and matches the approved design's instant interaction, while
  avoiding a server round-trip per keystroke. The schema's indexes still back the
  default ordering and fully support server-side querying if scale ever demands it.
- **shadcn/ui is configured (`components.json`, the `cn` util) but the components
  are authored directly.** The approved mockup's elevation, drawer, dialog, and
  toast are bespoke Neutra pieces; wrapping stock shadcn primitives would mean
  overriding them wholesale. shadcn remains available via the CLI for future
  features; icons are Lucide throughout.
- **Motion (motion.dev)** drives the masthead/stat/control-bar entrance rises (the
  staggered rise in the Motion Spec) with `useReducedMotion`. The remaining Motion
  Spec animations (hover-lift, drawer slide, dialog scale, filter `slideDown`, row
  `settle`, toast) are the approved mockup's CSS keyframes/transitions ported
  verbatim — same easing, same ≤300ms durations, same reduced-motion gating.
- **The demo-only "Preview the empty archive" toggle from the mockup was dropped**
  (it was flagged as non-shipping). The empty state is shown honestly when the log
  is empty — which is the shipped first-run.
- **TypeScript is pinned to 5.x.** `npm i -D typescript` initially pulled the new
  native TypeScript 7, whose package layout is not yet compatible with Next 16's
  TypeScript integration (the build's type-check worker crashed). Pinning to 5.9
  resolves it; `tsc --noEmit` and `next build` both pass.
- **Fonts (Jost + IBM Plex Sans) are self-hosted via `next/font`** — no runtime CDN.
- **No auth in v1** (per the brief): single-user, deployment-level access control.

### Verification results

- `npm install` — clean.
- `tsc --noEmit` — 0 errors.
- `next build` — succeeds (`/` is dynamic; the DB is never touched at build time).
- `weft-design-lint check` on `src/app`, `src/components`, `globals.css` — clean,
  0 findings.
- `npm run smoke` — 40/40 assertions pass (create/normalize/validate, default sort,
  name/venue sort, search, filter, filter+search AND, edit, cascade delete, reopen
  persistence).
- `npm test` — 31/31 pass.
- Live dev server — SSR renders the seeded log, IMDb links, the "Upcoming" tag, and
  the trust stat; no console/runtime errors.
