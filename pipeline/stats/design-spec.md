# Design Spec — Theatregoing Stats

**Feature:** stats · **Artifact:** `pipeline/stats/design.html`
**Mode:** Extension of the established Neutra Biorealism design system (`pipeline/design-system.md`) — no new tokens, fonts, or colors; no charting library.

---

## Visual Direction

A calm reflection on the archive, not a dashboard. An editorial vertical stack inside the existing masthead shell, with radical negative space letting the golden-hour ground show between floating plaster planes. Horizontal cantilever emphasis; one focal point (the total). Aloe is withheld entirely (reserved for "Log a play" on the log); the palette is warm plaster / walnut / teak. All data visualization is static.

---

## Screens / Views — the `/stats` route

1. **Header** — the window-onto-garden masthead language with a quiet dotted-sill "Back to the log" link (never aloe) and the page title "The shape of your theatregoing". Subheading: "Counted fresh from your archive, every time you look."
2. **Headline tiles (5)** — floating plaster planes on cantilever shadow:
   - Lead tile: a long, low horizontal cantilever spanning the row — big Jost-300 walnut-deep number ("54 plays logged") on the left, a quiet italic aside on the right: "A record of time well spent, counted live from the archive."
   - Four tiles below in a 4-up that reflows to 2-up then stacks: Years spanned (e.g. 2019–2026, en dash), Distinct venues, Distinct directors, Distinct actors. Big Jost numbers, wide-tracked `--label-ink` signage labels.
3. **Plays-per-year strip** — one plane of static wooden bars, newest year at top: a recessed inset track (`--recess`, inset shadow, sand hairline) with a teak→walnut gradient fill proportional to the busiest year, a 6px minimum mark for quiet years, and the count written as tabular Jost text beside each bar (never conveyed by length alone). A caption notes undated plays excluded from the per-year view.
4. **Most-seen lists (3)** — three sibling planes (Venues / Directors / Actors), top-5, ordered count-desc then name-asc. Each row: the name as the log's dotted-underline "sill" filter affordance (venues carry the square "plan" glyph; people do not) + the count as tabular walnut-deep text. Ties render identically (no rank badge). A section note: "Choose a name to open your log filtered to it. Every count is a doorway into the entries behind it."
5. **Empty state (0 plays)** — a warm invitation (leaf glyph, ghost "Back to the log to add your first play"), no empty tiles or charts, no aloe. (Demonstrated in the mockup via a labeled non-shipping "Preview the empty archive" toggle — remove for the real build.)

---

## Component Usage

- Reuses floating plaster planes, cantilever shadows, hairline dividers, the dotted-sill filter affordance, the "plan" glyph for venues, ghost buttons, and the aloe focus ring — all from the established system. No plane nested inside another.
- Introduces reusable patterns (flag for The Chronicler to fold into `design-system.md`): the **headline stat tile**, the **static proportional bar strip**, and the **top-N most-seen list**.

## Design Tokens Applied

No new tokens. Uses `--plaster*`, `--recess`, `--sand`/`--hair`, `--walnut`/`--walnut-deep`/`--teak`, `--ink*`, `--label-ink`, `--sh-plane`/`--sh-lift`, `--ease`, `--focus`. Aloe used only for the focus ring, never as a surface.

## Interaction Notes

- **Click-through to the filtered log** — each most-seen name is a real keyboard-operable `<a>` to `/?filter=<type>&value=<exact>` (`type` ∈ venue|director|actor; `value` = exact stored text). The Play Log seeds its existing single `ActiveFilter` from these URL query params on load (absent/malformed → unfiltered, as today), reusing the log's existing filter banner and Clear control. Exact, case-sensitive match, matching the log's semantics so counts equal what the filtered log shows.
- **Back to the log** — a quiet dotted-sill link in the header. The entry point into `/stats` is a quiet non-accent "Stats" link in the log's action cluster (left of Export; aloe reserved).
- Counts always shown as text; nothing depends on color or bar length alone. Keyboard-operable throughout.

## Motion Spec

- A gentle `rise` (translateY + fade, ~280–300ms, ease-out) on the brand and the headline-tile band only. The bar strip and lists are fully static (no animated charts). Full `prefers-reduced-motion: reduce` fallback (opacity reset, transforms disabled).

## Content Notes

Calm, plain, present-tense copy. **No em dashes** in any user-facing string (a standing project preference) — use commas or periods; en dashes in numeric ranges (2019–2026) are fine. Illustrative sample numbers in the mockup read as a devoted theatregoer's multi-year archive; the real view computes from actual data. Honesty surfaced plainly: undated-plays caption, "counted live" framing, and a designed empty state.
