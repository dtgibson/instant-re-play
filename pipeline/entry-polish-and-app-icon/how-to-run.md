# How to run — Entry Polish & App Icon

Three additive refinements to the shipped Play Log: a new **Playwright** field,
**self-sourced autocomplete** on the entry form, and a **home-screen app icon**
+ web manifest. Everything is additive; existing log / export / stats / auth
behaviour is unchanged.

## First-time setup

```bash
npm install          # sharp is a build-time devDependency for the icons
npm run gen:icons    # (re)rasterize the PNGs in public/ from public/icon.svg
npm run dev          # http://localhost:3000 (embedded PGlite, no DB to stand up)
```

The dev database is embedded PGlite persisted to `.data/pglite`. It applies the
Drizzle migrations on startup, so the new `0001` migration (the additive
`playwright` column) is picked up automatically the first time you run `dev`.
To start from the sample archive: `npm run seed`.

## 1. The Playwright field

- Open **Log a play** (or edit an entry). There is a new **Playwright** field
  sitting just above **Director** (who wrote it, then who staged it). It is
  optional and works exactly like Director.
- Save. In the log, the playwright shows as a person-value **consistent with
  Director**: the dotted "sill" underline **filters** the log to that playwright
  (exact match), and the small boxed icon opens an **IMDb name search** in a new
  tab. A blank playwright is omitted entirely (never a placeholder).
- The playwright is included in **free-text search** (the search box matches it
  alongside title / venue / director / cast) and in the **CSV / XLSX export**
  (a new `Playwright` column, between Venue and Director).
- Pre-existing entries render with the playwright blank until you edit them.

## 2. Autocomplete (venue · playwright · director · cast)

- Start typing in any of those four fields. A quiet **"From your archive"**
  plane appears below the input, offering your **own** prior values for that
  field (case-insensitive substring; prefix matches first; up to 6).
- Keyboard-first: **↑ / ↓** move the active row, **Enter** fills it, **Esc**
  dismisses the plane (without closing the drawer), and typing keeps filtering.
  Mouse users can click a suggestion.
- It **never auto-corrects**. If what you typed matches nothing, no plane
  appears and the value saves exactly as typed — new names are always allowed
  and the exact-match filter/search/stats semantics are unchanged.
- Suggestions are derived entirely from the archive already loaded in the page
  (`collectFieldValues` in `src/lib/suggest.ts`). There is **no new endpoint**
  and no server round-trip.

## 3. Add to Home Screen (the app icon)

The icon is the **replay-loop** mark (walnut arc + clay arrowhead + aloe play
triangle on the golden-hour tile). Source: `public/icon.svg`; the shipped PNGs
(`apple-touch-icon.png` 180, `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`) are rasterized by `npm run gen:icons` and served
statically (no runtime image dependency).

- **iOS / iPadOS (Safari):** sign in, then Share → **Add to Home Screen**. The
  home-screen icon is the designed mark and the label reads **Instant Re-Play**;
  launching it opens standalone (full-screen) straight to the log. iOS reads the
  `apple-touch-icon` link + `apple-mobile-web-app-*` meta from `layout.tsx`.
- **Android / Chrome:** the `/manifest.webmanifest` route supplies the name,
  `standalone` display, theme colour, and the 192/512/maskable icons. The
  manifest is served un-gated (it carries no user data) so install works.
- Quick check without a phone: `npm run build` lists the
  `○ /manifest.webmanifest` route; `curl -s localhost:3000/manifest.webmanifest`
  returns the JSON; the four PNGs are in `public/`.

## Verify

```bash
npm run db:generate        # confirms one additive migration: drizzle/0001_*.sql
npx tsc --noEmit           # 0 errors
npm run build              # succeeds; /manifest.webmanifest present
npm run test               # vitest — all suites incl. suggest + playwright field
npm run smoke:playwright   # end-to-end: create/read/filter/search/export/edit + autocomplete
```

## Conventions established (for the design system / future features)

- **Field autocomplete plane** — a suggestion overlay derived from the user's
  own prior values, in the plaster-menu language (plaster gradient, hairline,
  `--sh-float`, `--hi-edge`; aloe only as the active-row wash tint, never a fill
  surface). Keyboard-first, non-correcting, `prefers-reduced-motion` safe. Pure
  logic lives in `src/lib/suggest.ts`; the reusable widget is
  `src/components/autocomplete-input.tsx`.
- **Person-value parity** — playwright reuses the existing `PersonValue`
  (dotted filter value + boxed IMDb icon), so every "person" field in the log
  reads and behaves the same.
- **Additive schema change** — a nullable text column + its exact-match index,
  NULL-when-blank like venue/director; `PlayInput.playwright` is optional so no
  existing call site had to change, while the normalized `Play` always carries
  it as a string.
- **Install identity** — the replay-loop icon mark, maskable framing (mark
  inside the ~80% safe area on a fully-filled tile), and the manifest / theme
  values (`background_color #F3EAD8`, `theme_color #E9DAC0`).
