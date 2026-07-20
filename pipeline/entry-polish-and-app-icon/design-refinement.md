# Design Refinement — Entry Polish & App Icon

**Task:** entry-polish-and-app-icon · **Artifact:** `pipeline/entry-polish-and-app-icon/design.html`
**Mode:** Extension of the established Neutra Biorealism design system (`pipeline/design-system.md`) — no new tokens or fonts.

---

## 1. Autocomplete on the entry fields

A quiet suggestion plane appears below the Venue, Director, Actor, and (new) Playwright inputs as the user types, offering values they have **already used** in their own log.

- **Source:** the archive is already loaded client-side as `Play[]` in `PlayLog`; suggestions are the distinct prior values for that field, filtered to a case-insensitive substring of what's typed. No new endpoint, no schema read. Ranked simplest sensible way (prefix match first, then substring; cap ~6).
- **Look:** reuse the origin-aware menu / floating plaster overlay language — plaster plane, `--sh-float`, hairline border, `--hi-edge`. A small `From your archive` caption; each row a warm `--teak-soft` dot + the value with the typed fragment wrapped in `<mark>` (`--ink`, weight 600). Active row uses the aloe wash tint + aloe dot. **Never uses aloe as a fill surface.**
- **Behavior:** keyboard-first — ArrowUp/Down move the active row, Enter fills it, Escape dismisses, typing keeps filtering. Purely a convenience: it **never auto-corrects**. If the typed value matches nothing, no plane shows and the value saves as-is (new names are always allowed; exact-match semantics unchanged).
- **A11y:** input `role="combobox"`/`aria-expanded`/`aria-controls` (or an accessible listbox equivalent), options `role="option"` with `aria-selected`; suggestions announced. `prefers-reduced-motion` removes the open transition.

## 2. The Playwright field

- **Form:** a new "Playwright" field in the add/edit drawer, placed **just above Director** (playwright wrote the play, director staged it). Optional. Same input styling; gets autocomplete too.
- **List row:** shown as a **person-value consistent with Director** — the dotted-underline `.fval` click-to-filter affordance plus the distinct boxed IMDb-search icon. Clicking filters the log to that playwright (exact match); the icon opens an IMDb name search in a new tab (`rel="noopener noreferrer"`). Blank playwright is omitted (no placeholder), exactly like the other optional fields.
- **Data:** one nullable `playwright` text column on `plays` (additive migration; existing rows blank), an exact-match index for filtering, included in free-text search and the CSV/XLSX export column shape. Extends `FilterType`, `Play`, `PlayInput`.

## 3. The home-screen app icon — CHOSEN: Direction B (the "Re·Play" loop)

The user chose the **replay-loop** direction: a literal, warm nod to the name — a circular replay arrow wrapped around a play mark, on the golden-hour tile. Clay arrowhead + aloe play triangle over the warm plaster/ground radial.

**Reference mark (author the real assets from this):**
```svg
<svg viewBox="0 0 512 512">
  <!-- tile: radial plaster-top (#FFFCF5) center → ground-3 (#E9DAC0) → ground-4 (#E3D2B4) edge, rounded -->
  <rect width="512" height="512" rx="116" fill="url(#tile)"/>
  <!-- replay loop: open circular arc, walnut #7A5233, round caps, ~30 stroke -->
  <path d="M256 150 a106 106 0 1 1 -96 61" fill="none" stroke="#7A5233" stroke-width="30" stroke-linecap="round"/>
  <!-- loop arrowhead: desert clay #A5502F -->
  <polygon points="256,120 300,150 256,180" fill="#A5502F"/>
  <!-- play triangle at the heart: aloe #3B6B4C -->
  <polygon points="232,214 300,256 232,298" fill="#3B6B4C"/>
</svg>
```

**Assets & wiring the Engineer produces:**
- A crisp icon source (SVG above) exported to raster: `apple-touch-icon.png` (180×180), manifest icons `192×192` and `512×512`, and a **maskable** `512×512` with the loop+triangle kept inside the ~80% safe area on a filled tile (no transparency — iOS masks to a squircle).
- A **web manifest** (`name: "Instant Re-Play"`, `short_name: "Re-Play"`, `display: "standalone"`, `start_url: "/"`, `background_color` warm plaster (~#F3EAD8), `theme_color` warm (~#E9DAC0 or the walnut header tone), the icons above incl. maskable).
- `layout.tsx` metadata: `appleWebApp` (title "Instant Re-Play", status-bar style), `apple-touch-icon` link, manifest link, `themeColor`. Full-screen standalone launch straight to the log.
- The label under the icon reads **Instant Re-Play**; the warm tile deliberately stands out among cool system icons (shown on the home-screen mock).

## Motion / A11y (all reused vocabulary)

Autocomplete plane opens with the existing menu ease (≤300ms, `--ease`), reduced-motion removes it. Everything keyboard-operable; affordances never rely on colour alone (the IMDb icon is shape+icon, the filter is the dotted underline).

## Patterns to fold into the design system (for The Chronicler)

- **Field autocomplete plane** — a suggestion overlay derived from the user's own prior values, in the plaster-menu language, keyboard-first, non-correcting.
- **App / home-screen identity** — the replay-loop icon mark, maskable framing, and manifest/theme values.
