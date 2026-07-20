# Product Context — Instant Re-Play

## What It Is

A personal theatregoing archive: one shared log where invited people
record every play they've seen and browse that history as a sortable,
searchable, click-to-filter list. It is built around fast entry and the
connections between plays — the same venue, director, or actor recurring
across a life of theatregoing. Live behind an invite-only login. A
private archive, not a social feed or review platform.

## Features

- **Play Log** — Log a play (name, date, venue, playwright, director,
  multi-actor cast) with self-sourced autocomplete on those fields, and
  browse every entry as a sortable, searchable list where any venue,
  playwright, director, or actor filters the list, people carry IMDb search
  links, and entries can be edited or deleted.
- **Home-Screen Install** — Adding the site to a phone or tablet home
  screen installs it as a standalone app with its own icon and name,
  launching full-screen straight to the log.
- **Data Export** — Download the entire archive as CSV or Excel (.xlsx)
  from a quiet control in the log, with every cell neutralized against
  spreadsheet formula injection.
- **Stats** — A live `/stats` view (total plays, years spanned, distinct
  venue/director/actor counts, plays-per-year, and top-N most-seen)
  computed fresh on every read, where each most-seen name opens the log
  filtered to it.
- **Shared Login** — Magic-link email sign-in via Supabase gates the
  whole app, admitting only addresses on a server-side invite allowlist,
  over one shared archive with no per-user data.

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel.
- Drizzle ORM over Neon Postgres holds the archive (plays and cast).
- Supabase Auth (magic link, `@supabase/ssr`, httpOnly cookie sessions)
  handles identity only — it never stores play data.
- Motion + Lucide icons over a bespoke "Neutra" design system, token-driven
  in `globals.css`.
- Vitest (unit) and Playwright (e2e). Access is application-level login;
  Vercel Deployment Protection is off.

## Deferred / Out of Scope

- **Import** (CSV/Excel) — export shipped first; import, with its parsing,
  validation, and merge questions, is a later feature.
- **Per-user private archives** — the log is deliberately shared; no
  `user_id`, no row scoping, no per-person data.
- **Passwords and OAuth** — magic link only; a password option is a
  possible later addition.
- Public/self-serve signup, roles beyond invited-or-not, ratings, reviews,
  notes, photo attachments, and any curated play/venue/person database.
