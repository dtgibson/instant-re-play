# Instant Re-Play

A private theatre archive. A calm, single-log web app for keeping a personal record of every play you have seen, shared by invite with the people you choose. It runs behind a passwordless email login, so only invited addresses can get in.

## Features

- **Play Log:** record each play (name, date seen, venue, playwright, director, cast) and browse a sortable, searchable list. Click any venue, playwright, director, or actor to filter to everything that shares it; people carry an IMDb search link.
- **Self-sourced autocomplete:** the entry form suggests names you have used before, so the archive stays consistent. It never overrides you.
- **Export:** download the whole archive as CSV or Excel (.xlsx), with spreadsheet-formula-injection kept out of the cells.
- **Stats:** a live view of your theatregoing, computed on read: totals, plays per year, and your most-seen venues, directors, and actors.
- **Shared login:** passwordless magic-link sign-in via Supabase, gated by a server-side email invite allowlist. One shared archive for everyone invited.
- **Installable:** add it to an iPhone or iPad home screen for a full-screen app with its own icon.

## Stack

- Next.js (App Router) + TypeScript + React
- Drizzle ORM over Postgres: Neon in production, an embedded PGlite database for local development
- Supabase Auth (identity only) for the magic-link login and invite allowlist
- A bespoke "Neutra Biorealism" design system (Jost + IBM Plex Sans), Motion, Lucide
- Deployed on Vercel

## Local development

```bash
npm install
npm run seed     # loads a sample archive into a local embedded database
npm run dev      # http://localhost:3000
```

Locally there is no login: with no Supabase environment configured and `NODE_ENV` not set to `production`, the app signs you in as a synthetic development user so you can work on it directly. This shortcut is inert in production, where real auth is always required.

Other scripts: `npm run build`, `npm run test`, `npm run db:generate`, `npm run gen:icons`.

## Environment variables (production)

See `.env.example`. In production, set:

- `DATABASE_URL`: a Postgres connection string (Neon in production).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: your Supabase project's URL and public (anon) key.
- `ALLOWED_EMAILS`: comma-separated list of the email addresses allowed to sign in.

Never set a Supabase service-role key; the app does not use one. If the Supabase variables or `ALLOWED_EMAILS` are missing in production, the app fails closed and denies access.

## Deployment

Deployed on Vercel. The build command runs the database migrations against `DATABASE_URL` (see `migrate.mjs`) and then builds. This version has no access control beyond its own login, so keep the deployment reachable only through that login.

## Project notes

`PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md`, and `pipeline/` hold the product record, the decisions behind it, and the design system. This project was built with [Weft](https://weft.build).
