# CLAUDE.md — Instant Re-Play

Standing conventions for future work. Read at session start. Keep this
lean — only conventions that outlive a single feature.

## Architecture

- **Pure modules in `src/lib` are the single source of truth.** Domain,
  query, stats, and export logic live as pure, side-effect-free modules
  (`play.ts`, `query.ts`, `stats.ts`, `export.ts`, `auth.ts`) that both the
  UI and the tests import. Don't duplicate business logic into components or
  route handlers — build it in `src/lib` and call it from both. Filtering
  and stats share one exact-match semantics, so a count always equals what
  the filtered log shows.

- **Self-sourced autocomplete is pure logic in `src/lib/suggest.ts`.** Field
  suggestions are the user's own prior values, computed from the
  already-loaded archive (no endpoint, no extra read), ranked in the module
  (prefix then substring). It never auto-corrects: unmatched input saves as
  typed and exact-match semantics are untouched.

- **Additive nullable text columns follow the venue/director contract.** A
  new optional per-play field is NULL-when-blank, trimmed on write, given an
  exact-match filter index, and marked optional on `PlayInput` — the same
  shape as venue and director. Reuse the filter/search/export path rather
  than adding a parallel one.

## Auth

- **Every protected boundary re-checks auth server-side before any DB
  access.** Middleware is not enough. Each page, each API route handler, and
  each mutating server action independently verifies session + email
  allowlist through the server auth guard before touching the database.
  Client-side gating is presentation only and is never trusted for access.
  Fail closed on misconfiguration; no service-role key in client-reachable
  code.

## Copy

- **No em dashes in any user-facing string.** A firm project preference. Use
  commas or periods; en dashes in numeric ranges (2019–2026) are fine. Voice
  is short, specific, human, present tense.

## Design

- **The Neutra design system is token-driven in `globals.css`.** Every
  component references a token — no one-off hex in component rules; add a
  token before you need a color. **Aloe (the single green accent) is reserved
  for the one primary action and active states**; every secondary, neutral,
  and denial surface uses warm plaster/walnut/hair. See
  `pipeline/design-system.md`.

- **Every person field reuses the one `PersonValue` treatment.** A dotted
  click-to-filter value plus the distinct boxed IMDb-search icon. Playwright,
  director, and actor render identically; a new person field extends
  `PersonValue`, never a bespoke row.

## Assets

- **Icons are rasterized at build, not at runtime.** The app / home-screen
  icons are generated from one SVG source into static PNGs by a build-time
  devDependency (apple-touch 180, manifest 192/512, maskable 512). No runtime
  image dependency ships; the manifest and metadata reference the static
  files.
