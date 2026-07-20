# Instant Re-Play — Design System

The canonical design language for Instant Re-Play, established by the founding feature (The Play Log). Future features should inherit these tokens, patterns, and intent so the product stays one coherent, calm archive.

## The Reference & The Feel

**Anchor: Richard Neutra's California mid-century modernism — the *Biorealism* reading**, warmed toward the golden-hour light of the **Kaufmann Desert House (Palm Springs, 1946)**. The app should feel like a calm, sunlit room seen through a floor-to-ceiling window onto a garden: horizontal, low, and open, with content staged as **long cantilevered planes floating on soft warm shadows** over an atmospheric ground. It is a private, considered archive — *more trustworthy than memory* — never a dashboard, social feed, or review site.

Design intent, in words: **radical calm and restraint.** Enormous negative space used as literal "open air." Horizontal emphasis above all. Depth through **layered floating planes with warm walnut shadows**, never nested cards and never hard grey drop-shadows. One dominant warm neutral + one sharp landscape accent. Golden California light with atmosphere (layered gradients, sun glow, a low horizon line) — never a flat slab.

## Color Tokens (light — the hero theme)

**Warm plaster planes**
- `--plaster` #F8F1E3 · `--plaster-hi` #FDF8EE · `--plaster-top` #FFFCF5 (lift edge) · `--recess` #F1E7D4 · `--recess-soft` #EFE6D2

**Atmospheric ground** (layered, never flat)
- `--ground-1` #F3EAD8 · `--ground-2` #EFE6D2 · `--ground-3` #E9DAC0 · `--ground-4` #E3D2B4
- Composed with a top-centre golden sun-glow radial, a pool-sky reflection radial, an aloe hint radial, and a fixed horizon hairline.

**Warm inks** (all AA on plaster; never pure #000/dead grey)
- `--ink` #2B261E (primary/titles, 13.4:1) · `--ink-2` #4A4234 (secondary/values, 8.8:1) · `--ink-3` #6B5D46 (muted, 5.7:1) · `--ink-faint` #8A7A5E (decorative/large only)
- `--label-ink` #574123 — **dedicated small-caps signage ink (8.6:1); use for ALL uppercase micro-labels.** Do not set wood tones on small labels.

**Wood (materials):** `--walnut` #7A5233 · `--walnut-deep` #4B2F19 · `--teak` #9A6738 · `--teak-soft` #C0A176

**Landscape accent (single, sharp — primary action & active states only):**
- `--aloe` #3B6B4C · `--aloe-hi` #47795A · `--aloe-deep` #2F5A3F · `--aloe-tint` / `--aloe-line` / `--aloe-wash` · `--on-aloe` #FDF8EE (5.85:1 on aloe)

**Desert clay (destructive/semantic ONLY):** `--terra` #A5502F · `--terra-deep` #8C3F22 (6.6:1) · `--on-terra` #FDF7EC

**Structure / misc:** `--sand` #E0D5C0 · `--sand-soft` #EADFCA · `--hair` #D8C5A2 (steel mullions/hairlines) · `--steel` #38332B (toast) · `--sky` #C7DAD8 · `--sky-soft` #DCE7E1 (horizon band)

**Shadows (warm, soft, cantilevered — over warm walnut rgba):**
- `--sh-plane` resting depth (apply to planes AT REST) · `--sh-lift` hover · `--sh-float` overlays · `--hi-edge` sunlit inset top edge

**Dark theme:** a full parallel token set is defined under `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` (viewer toggle wins). Daylight is the hero; dark exists for viewer preference and must never out-compete the golden-hour thesis.

> **Rule:** every component references a token — no one-off hex in component rules. Add a token before you need a colour.

## Typography

- **Display / signage:** **Jost** (weights 300/400/500/600) — geometric, high-waisted, architectural; evokes Neutraface without using it (Neutraface is not open-licensed). Used for wordmark, titles, stat number, and all wide-tracked uppercase labels.
- **Body:** **IBM Plex Sans** (400/500/600 + italic 400).
- **Forbidden:** Inter, Roboto, Open Sans, Lato, Arial, bare system-ui.
- **Scale (~1.25):** `--fs-micro` 11 · `--fs-label` 12 · `--fs-small` 13 · `--fs-body` 15 · `--fs-lead` 17 · `--fs-name` 22 · `--fs-h` 24 · `--fs-mark`/`--fs-stat` fluid.
- **Three roles with real contrast:** display (Jost 300–500, tight/negative tracking on large sizes), body (IBM Plex Sans, 1.6 line-height), label (Jost 500, UPPERCASE, 0.14–0.34em tracking — mid-century signage). Numerals `tabular-nums`.

## Spacing, Geometry, Motion

- **Radius:** `--r` 10px (planes), `--r-sm` 4px (controls/inputs/chips). Small radii — architectural, not soft.
- **Rhythm:** fluid `clamp()` padding; shell `max-width:1180px`; generous gaps between planes so the ground shows (open air).
- **Ease:** `--ease` cubic-bezier(0.22,0.61,0.36,1). **All durations ≤ 300ms.** No overshoot/bounce/elastic.
- **Focus:** `--focus` 3px aloe ring on `:focus-visible`.
- **Motion vocabulary:** `rise` (entrance), `settle` (new/changed rows), `slideDown` (filter banner), plane hover-lift, origin-aware drawer/dialog. Always ship a `prefers-reduced-motion: reduce` fallback **and** gate JS-driven scrolling on the same query.

## Component Patterns (what to use when)

- **Floating plane** — the single structural primitive for any elevated surface (rows, control bar, states, drawer, dialog). Plaster gradient + hairline border + `--sh-plane` at rest / `--sh-lift` on hover. **Never nest a plane inside a plane.**
- **ARIA table for tabular data** — `role="table"` wrapping a header row of sortable `columnheader` buttons (`aria-sort`) over a `rowgroup` of `role="row"` planes with `role="cell"`/`rowheader`. Provide a mobile sort segment sharing one state. Collapse to labeled stacked bands (`.celllabel`) below the layout's min-content width; give icon actions text labels on mobile.
- **Click-to-filter value** — a text button with a dotted "sill" underline (interactive by shape, not colour); active state marked and re-click toggles off; at most one filter, combines with search via AND. Places/things get a small square "plan" glyph and **no** external link; people get a filter value **plus** a distinct boxed external-link icon (shape+icon, never colour alone).
- **Primary action** — aloe `.btn-primary`, the only accent-filled surface on the screen. Ghost for secondary; clay `.btn-danger` for destructive only, always behind an explicit confirm dialog.
- **Overlays** — right-side drawer for create/edit; centered alertdialog for confirm; both trap Tab focus, close on Escape, and restore focus. Toast (role="status") for confirmations.
- **Empty vs no-results** — always two distinct designed states; empty invites the first entry, no-results offers a one-action clear and reassures other entries remain.
- **Blank data** — omit the field entirely (label shown only when a value exists). Never render placeholder glyphs that could be mistaken for data.
- **Origin-aware dropdown menu** — a trigger (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls`) opening one floating plaster plane (`role="menu"`, `--sh-float`, hairline border, `--hi-edge`) that scales open *from* the trigger (`transform-origin` re-anchored per layout — top-right desktop, top-left mobile; chevron rotates 180°). Items are `role="menuitem"` rows with a warm `--walnut` glyph, a label, and an optional one-line hint; Tab is trapped between items, Arrow/Home/End cycle, Escape closes and restores focus to the trigger, outside-click and viewport-resize dismiss. A hairline-topped caption (a divider, not a nested card) can carry scope truth. Use for a small secondary action set (e.g. choosing an export format) — never the primary aloe surface, never a nested plane.
- **Field autocomplete plane** — a suggestion overlay on an entry field offering values from the user's **own prior entries** for that field (a case-insensitive filter of what's typed, ranked prefix-then-substring, capped small). Reuses the floating plaster-menu language — plaster plane, `--sh-float`, hairline border, `--hi-edge` — with a `From your archive` caption, each row a warm `--teak-soft` dot and the value with the typed fragment wrapped in `<mark>` (`--ink`, weight 600); the active row uses the aloe wash tint and an aloe dot (aloe is **never** a fill surface here). Keyboard-first (Arrow to move, Enter to fill, Escape to dismiss, typing keeps filtering) and **non-correcting** — no match shows no plane and the value saves exactly as typed. `role="combobox"` / listbox a11y with `aria-selected` options; the open transition is removed under reduced-motion.
- **Headline stat tile** — a floating plaster plane presenting one figure: a large Jost-300 `--walnut-deep` number with a wide-tracked `--label-ink` signage label. A lead tile may run as a long low horizontal cantilever spanning the row with a quiet italic aside; siblings reflow 4-up → 2-up → stacked. Numerals `tabular-nums`. Aloe is withheld — reflection is never an action surface.
- **Static proportional bar strip** — one plane of read-only bars (e.g. a row per year, newest at top): a recessed inset track (`--recess`, inset shadow, sand hairline) with a `--teak`→`--walnut` fill proportional to the largest value and a ~6px minimum mark so small values stay visible. The count is always written as tabular Jost text beside the bar — quantity is never conveyed by length or color alone. No charting library; fully static and reduced-motion-safe by construction.
- **Top-N most-seen list** — a plane listing ranked items (name + count), ordered count-desc then name-asc, with ties rendered identically (no rank badge). Each name is the click-to-filter "sill" affordance (places carry the square "plan" glyph; people do not) linking into the log's exact-match filter, so the shown count equals the filtered result. Count is tabular `--walnut-deep` text.
- **Front-door auth plane** — the signed-out entry surface: the full golden-hour garden ground behind a single centered floating plaster plane, with the wordmark, eyebrow, and tagline as signage floating above it. That plane is the only elevated surface (no nested plane) and carries the aloe `.btn-primary` as the one action.
- **Auth-state medallion** — a glyph medallion marking an auth state on the front-door plane. An aloe-tinted variant marks positive/confirming states (e.g. "check your email"); a **warm-neutral variant** (walnut/hair/recess, zero aloe) marks denials and dead-ends (not invited, expired link). Denial and neutrality never spend the accent; a positive state may carry a single aloe tint but never a filled action surface.

## App / Home-Screen Identity

The product's install identity when added to a phone or tablet home screen — the one place the design language leaves the browser and lives as a launcher icon.

- **The mark — the "replay loop."** A warm, literal nod to the name: an open circular replay arc (walnut `--walnut` #7A5233, round caps) wrapping a play mark, closed by a desert-clay `--terra` #A5502F arrowhead, with an aloe `--aloe` #3B6B4C play triangle at its heart. It sits on the golden-hour tile — a radial from plaster-top (#FFFCF5) at center to `--ground-3` / `--ground-4` at the edge, rounded corners. The warm tile is deliberate: it stands out among cool system icons on the home screen.
- **Maskable framing.** The maskable variant keeps the loop and triangle inside the ~80% safe area on a fully filled tile (no transparency), so masking to a squircle never clips the mark. Authored from one SVG source and rasterized to `apple-touch-icon` (180) and manifest icons at 192, 512, and the maskable 512.
- **Manifest & theme.** `name` "Instant Re-Play", `short_name` "Re-Play", `display: standalone`, `start_url: /`, warm-plaster `background_color` (~#F3EAD8) and warm `theme_color` (~`--ground-3` / walnut header tone). Standalone launch goes full-screen straight to the log; the home-screen label reads "Instant Re-Play".

## Rationale (so future features inherit intent)

- **Warm-tinted everything, one accent.** The archive must feel personal and sunlit, not clinical. Neutrals bias toward walnut/plaster; aloe green is the only landscape accent and is spent only on the key action and active states, so the eye always knows where the "one true action" is.
- **Depth via planes + warm shadows, at rest.** Neutra's roofs cantilever and cast long soft shadows; content must *float*, not sit in ruled rows or nested boxes. Resting `--sh-plane` is non-negotiable for primary content.
- **Correctness is part of the aesthetic of trust.** Real validation (required name, genuine calendar dates, trim/dedupe), exact-match filtering per the data model, keyboard operability with focus traps, and AA contrast (via the dedicated `--label-ink`) are what make the log "more trustworthy than memory."
- **Accessibility and responsiveness are built in, not bolted on.** Affordance distinctions never rely on colour; the layout collapses to labeled bands with no horizontal scroll at 360px; motion always has a reduced-motion path.
- **Demo scaffolding is labeled and removable.** The "Preview the empty archive" toggle is explicitly marked as non-shipping so review needs never leak fake controls into the product.

## Copy Voice

Short, specific, human, present tense. Warm but not cutesy. The masthead eyebrow reads "A private theatre archive" (no leading rule/dash) and the tagline is *"A record of time well spent."* No em-dash-as-crutch, no corporate register, no bold lead-in bullets in product copy.
