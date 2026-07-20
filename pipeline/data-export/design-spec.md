# Design Spec — Data Export

**Feature:** data-export · **Artifact:** `pipeline/data-export/design.html`
**Mode:** Extension of the established Neutra Biorealism design system (`pipeline/design-system.md`) — no new tokens, fonts, or colors.

---

## Visual Direction

A small, calm addition that stays entirely inside the existing system. Export is a **secondary** affordance: it must never compete with the one primary aloe action ("Log a play"). It reads as a quiet, matched companion in the control bar, and its menu is one floating plaster plane consistent with every other overlay in the app.

---

## Screens / Views

### Control bar — Export control
- A new right-aligned `.bar-actions` cluster holds Export to the **left** of the unchanged aloe `.btn-primary` "Log a play", so the aloe action stays the rightmost, terminal element (preserves the "one true action" rule).
- **Export** is a `.btn-ghost` (recess fill, sand hairline, `--ink-2` text) with a small download/export Lucide-style icon and a chevron. Same Jost-500 uppercase 0.08em signage treatment as the primary button, so the two read as a matched pair differentiated by **fill + icon**, never by color alone.

### Export menu (origin-aware overlay)
- One floating plaster-gradient plane: `--sh-float` shadow, hairline `--sand` border, `--hi-edge` sunlit top edge. **No nested cards.**
- Two `role="menuitem"` rows: **Download CSV** and **Download Excel (.xlsx)**, each with a one-line hint ("Spreadsheet-ready" / "Opens in Excel or Numbers"). Item icons are warm `--walnut`; CSV vs XLSX distinguished by glyph shape (text-lines vs grid) plus text label.
- A hairline-topped caption (a divider, not a nested card) states the scope truth live: "Your whole archive — all N plays, not just what's shown", degrading to the empty-log line at N = 0.

---

## Component Usage

- Reuses `.btn-ghost`, `.btn-primary`, plaster-plane + `--sh-float` overlay pattern, hairline dividers, warm icon treatment, and the aloe `:focus-visible` ring — all from the established system.
- Introduces one reusable pattern: an **origin-aware dropdown menu** (trigger + `role="menu"` plane). Flagged for The Chronicler to fold into `design-system.md` as a standing pattern.

## Design Tokens Applied

No new tokens. Uses `--recess`, `--sand`, `--ink-2`, `--walnut`, `--plaster*`, `--sh-float`, `--hi-edge`, `--ease`, `--focus` from `design-system.md`.

## Interaction Notes

- Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`. Menu: `role="menu"` with two `role="menuitem"` buttons.
- Open via click / ArrowDown / Enter / Space (focuses first item). Arrow / Home / End cycle items; **Tab is trapped between the two items**; Escape closes and returns focus to the trigger; outside-click and viewport-resize dismiss.
- The two format choices trigger real downloads (plain `<a download>` in the built app hitting the export route) — no page navigation, no list state lost.
- Distinction between the two formats never relies on color alone (icon shape + label).

## Motion Spec

- Menu scales open **from the trigger**: `translateY(-6px) scale(.97)` → none, opacity 0→1 over 160–180ms `--ease` (ease-out, sub-300ms). `transform-origin: top right` desktop, re-anchored `top left` on mobile so it grows from the button in both layouts. Chevron rotates 180° on open.
- Full `prefers-reduced-motion: reduce` fallback: no scale, no chevron spin, instant show/hide.

## Content Notes

Format labels: "Download CSV" / "Download Excel (.xlsx)". Hints short and human. The scope caption is the load-bearing copy — it tells the user they're backing up everything. Shown in real context against the West End sample log.
