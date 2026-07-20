# Design Spec — The Play Log

**Feature:** play-log · **Artifact:** `/Users/developer/devwork/instant-re-play/pipeline/play-log/design.html`
**Lens:** Richard Neutra — *Biorealism* (architecture dissolving into landscape), warmed toward the golden-hour desert-modern light of the Kaufmann Desert House.

---

## Visual Direction

The screen stages the archive as a calm room seen through a floor-to-ceiling window onto a garden. A whisper of pool-and-sky sits at the top with a long, low **horizon line**; below it a layered, atmospheric warm-plaster ground carries a top-centre **golden sun glow** and a faint aloe hint low-left — golden California light, never a flat slab. The log itself is composed as a **Neutra elevation**: long, low **cantilevered plaster planes** that float on soft, warm **walnut shadows** at rest (not only on hover), separated by open "air" so the ground shows between them — layered planes, never cards-inside-cards.

Restraint governs everything: generous negative space, hairline "steel" structure, tinted-warm neutrals, and a **single sharp landscape accent — garden aloe green** — reserved for the primary action and active states. Desert clay (terracotta) is used *only* for destructive semantics. Typography is architectural: **Jost** (geometric, high-waisted, Neutraface-evoking, OFL) for display and wide-tracked signage labels, **IBM Plex Sans** for body. The light golden-hour theme is unmistakably the hero; a fully tokenized dark theme is kept on file and follows the viewer's system/scheme preference without competing.

---

## Screens & Views

One cohesive, interactive screen with these states:

1. **Header ("window onto the garden")** — eyebrow, wordmark *Instant Re·Play* (aloe dot), an italic tagline, and a right-aligned trust stat: **"N / plays logged since YEAR"** (grafted from A).
2. **Control bar (cantilevered plane)** — floats up over the header on a negative top margin; holds the live search field and the primary **Log a play** button.
3. **Active-filter banner** — slides in when a filter is active: *"Showing plays at the Almeida Theatre"* with a one-click **Clear filter**.
4. **The log (ARIA table of floating planes)** — desktop shows **sortable column headers** (Seen / Production / Venue with `aria-sort`; Director; Cast; Entry). Each row is a floating plaster plane: date rail, production title (+ Upcoming tag), venue chip, director, cast, and calm edit/delete actions.
5. **Add / Edit drawer** — right-side glass drawer: name (required), date, venue, director, and a one-at-a-time removable, order-preserved cast sub-form. Shown open in the mockup's add state.
6. **Delete confirm dialog** — centered, clay-topped alertdialog with Keep it / Delete.
7. **Empty state** — "Your archive is open" + *Log your first play* (reachable non-destructively via the footer **Preview the empty archive** toggle — demo scaffolding, flagged for removal).
8. **No-results state** — distinct from empty: "Nothing in the archive matches" + one-action **Clear search & filter**.
9. **Toast** — save/update/delete confirmation.
10. **Mobile (≤940px)** — the elevation collapses to **stacked labeled bands** (per-field `.celllabel`), a mobile sort segment replaces the headers, and edit/delete gain visible text labels; verified with no horizontal scroll at 360px.

---

## Component Usage

- **Floating plane** (`.entry`, `.controls`, `.state`, `.drawer`, `.confirm`) — the one structural primitive; a plaster gradient + hairline border + warm cantilever shadow. Used wherever content must read as elevated over the garden. Never nested inside another plane.
- **Sortable column header** (`.thead .th > button`, `aria-sort`) — the discoverable desktop sort affordance for Date/Production/Venue.
- **Sort segment** (`.sort-mobile .sortbtn`, `aria-pressed`) — mobile equivalent, shares one sort state and one handler.
- **Filter value** (`.fval`) — the click-to-filter affordance: a text button with a dotted "sill" underline (shape, not colour). `.fval.venue` prefixes a small square "plan" glyph; `.fval.is-active` marks the live filter and toggles off on re-click.
- **IMDb link** (`a.imdb`) — a visually distinct **boxed external-link icon** beside people's names only; opens IMDb name-search in a new tab with `rel="noopener noreferrer"`.
- **Icon button** (`.iconbtn`, `.iconbtn.danger`) — calm edit/delete; gains a text label on mobile.
- **Buttons** — `.btn-primary` (aloe, the only accent surface), `.btn-ghost`, `.btn-danger` (clay, destructive only).
- **Form field** (`.field` + `.err`) — label + input + inline error; `.invalid` state for name-required and invalid-date.
- **Chip** (`.actor-list li`) — ordered, removable cast entries in the drawer.

---

## Design Tokens Applied

- **Grounds/atmosphere:** `--ground-1..4` (#F3EAD8→#E3D2B4) layered gradient + sun-glow/pool-sky/aloe radials + `body::after` horizon line.
- **Planes:** `--plaster` #F8F1E3, `--plaster-hi` #FDF8EE, `--plaster-top` #FFFCF5 (lift), `--recess` #F1E7D4.
- **Inks (warm, AA-verified on plaster):** `--ink` #2B261E (13.4:1), `--ink-2` #4A4234 (8.8:1), `--ink-3` #6B5D46 (5.7:1), `--label-ink` #574123 (8.6:1 — the dedicated small-caps label ink that resolves the panel's contrast flaw), `--ink-faint` #8A7A5E (decorative/large only).
- **Wood:** `--walnut` #7A5233, `--walnut-deep` #4B2F19, `--teak` #9A6738, `--teak-soft` #C0A176.
- **Accent (single):** `--aloe` #3B6B4C, `--aloe-hi` #47795A, `--aloe-deep` #2F5A3F, `--aloe-tint`/`--aloe-line`/`--aloe-wash`; white-on-aloe button text 5.85:1.
- **Destructive (semantic only):** `--terra` #A5502F, `--terra-deep` #8C3F22 (error text 6.6:1).
- **Structure:** `--sand`/`--sand-soft`/`--hair` hairline mullions; `--steel` #38332B toast; `--sky`/`--sky-soft` horizon.
- **Warm cantilever shadows:** `--sh-plane` (resting), `--sh-lift` (hover), `--sh-float` (overlays), all over warm walnut rgba; `--hi-edge` sunlit top edge.
- **Type scale (~1.25):** `--fs-micro` 11 → `--fs-stat` clamp 2.1–3rem; three roles (display Jost / body IBM Plex Sans / wide-tracked Jost label).
- **Geometry/motion:** `--r` 10px, `--r-sm` 4px, `--ease` cubic-bezier(0.22,0.61,0.36,1), `--focus` 3px aloe ring.
- All component color references a token; a full dark-theme token set is defined for `prefers-color-scheme: dark` and `:root[data-theme]`.

---

## Interaction Notes

- **Search** — live, case-insensitive substring across name/venue/director/actors; clear button; combines with an active filter via AND (FR-13/FR-17).
- **Sort** — one delegated handler drives both the desktop `aria-sort` headers and the mobile segment. Default **date, newest first**; toggles asc/desc; blanks always last in both directions; name/venue via locale compare (FR-11).
- **Click-to-filter** — venue/director/actor values filter to exact stored-text matches (actor = any-match); active value shows in the banner and is marked `.is-active`; re-clicking it **toggles the filter off** (grafted from B); at most one filter, clicking another replaces it. On filter, the banner is scrolled into view — with `behavior:"auto"` under reduced motion (JS-gated).
- **IMDb** — separate element/hit-area from the filter value, so one click never does both; opens a name-search URL in a new tab, no opener reference (FR-18/NFR-05).
- **Add/Edit** — drawer prefilled on edit; **name required** and **date validated** (`isValidDate` rejects malformed/impossible calendar dates before save, accepts any past *or* future date) with inline errors that preserve all other entered values; on save, values are trimmed, empty actors dropped, exact-duplicate actors deduped; the new entry appears immediately (sort reset to date-desc, filters cleared) with a **settle** animation and a toast.
- **Delete** — explicit confirm dialog (verb "Delete" throughout for copy consistency); confirming removes + persists; declining leaves it untouched.
- **Keyboard** — every control is operable; drawer and confirm dialog **trap Tab focus** (grafted from A) and close on Escape; focus returns to the trigger; filter-vs-IMDb distinction is shape+icon, never colour alone (NFR-04).
- **Persistence** — localStorage; survives reload (FR-20).
- **Preview empty** — non-destructive footer toggle to demo the empty state; can never desync (any add/edit clears it).

---

## Motion Spec

- Enter/exit easing `cubic-bezier(0.22,0.61,0.36,1)` (ease-out, no overshoot); all durations ≤ 300ms.
- **Entrance:** masthead, stat, and control bar `rise` (staggered 40/120/150ms). New/edited rows `settle` (280ms). Filter banner `slideDown` (260ms). Drawer slides 280ms; confirm scales+fades 220ms; toast 200–240ms.
- **Hover:** planes lift from `--sh-plane` to `--sh-lift` with a 1px rise; sort arrows fade/rotate for direction. No hover-scale on every row, no pulsing dots, no page-wide staggered fades.
- **Reduced motion:** a `prefers-reduced-motion: reduce` block neutralizes all animation/transition; JS reads the same query to disable smooth scroll and skip settle/removing animations.

---

## Content Notes

Realistic serious-theatregoer log (14 seed entries, London West End) chosen to exercise every state: *A Streetcar Named Desire* (Almeida / Frecknall / Mescal, Ferran, Vasan), *Sunset Boulevard*, *Vanya*, *The Motive and the Cue*, *Cabaret*, *Oklahoma!* (no cast), *Long Day's Journey Into Night*, *The Lehman Trilogy*, *Prima Facie*, *An Enemy of the People*, plus deliberate edge cases: *The Pillowman* (no director), *The Hills of California* (no date), *Waiting for Godot* (future-dated → **Upcoming** tag), and *A Midsummer Night's Dream* (name only — proves the all-blank read). Repeated venues (Duke of York's ×3, Wyndham's ×2) and directors (Sam Mendes ×3, Rebecca Frecknall ×2) make click-to-filter connections meaningful. Blank optional fields are **omitted entirely** — the field label appears only when a value exists, so nothing reads as placeholder data (FR-03). No lorem ipsum, no "Play 1".

> **Note — the tagline copy was revised at user request during this stage:** the eyebrow no longer shows a leading rule/dash, and the tagline reads *"A record of time well spent."* (was a longer em-dashed sentence). The Engineer should carry this exact copy.
