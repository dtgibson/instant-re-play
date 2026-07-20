# Design Spec — Shared Login

**Feature:** shared-login · **Artifact:** `pipeline/shared-login/design.html`
**Mode:** Extension of the established Neutra Biorealism design system (`pipeline/design-system.md`) — no new tokens, fonts, or colors.

---

## Visual Direction

A calm "front door" to the archive: the same golden-hour garden ground (body gradient stack, plaster grain, fixed horizon hairline) behind a single centered floating plaster plane. The wordmark, eyebrow, and tagline float as signage above that one plane. The plane is the only elevated surface — no plane nested inside another. Aloe is reserved for the single primary action ("Send me a link"); every denial/neutral state uses warm walnut/hair/recess with no aloe.

---

## Screens / States (one route, `/login`, plus the callback + sign-out)

1. **Sign in (enter email)** — heading "Welcome in.", the invite-only explainer wired as the field's `aria-describedby`, a visibly-labeled email input (`type=email`, `autocomplete=email`), and the aloe `.btn-primary` "Send me a link" (send-arrow icon). Malformed email → inline `role=alert` error tied to the field, stays on this state, self-clears on valid input.
2. **Check your email** — an aloe-tinted mail medallion (the established positive-glyph vocabulary, not an action surface), "Check your email. We sent a sign-in link to <entered address>. Click it to come in.", a warm spam-folder micro-line, and a ghost "Use a different email" back to state 1.
3. **Not invited** — warm-neutral (walnut/hair/recess) closed-door medallion, zero aloe: "This archive is invite-only, and that email is not on the list." + a quiet ghost route back.
4. **Link expired / invalid** — warm-neutral clock medallion: "That link did not work or has expired. Let us send a fresh one." + a way to request another.
5. **Sign out** — a quiet ghost `<form method=post action=/auth/signout>` control in the app header action cluster (log-out icon, "Signed in as <email>" context), never aloe.

---

## Component Usage

- Reuses the floating plaster plane, `--sh-plane`/`--hi-edge`, hairline borders, the aloe `.btn-primary`, ghost buttons/links, the positive-glyph medallion (aloe tint) and a new warm-neutral medallion variant for denials, the aloe `:focus-visible` ring, and the `rise`/`settle` motion vocabulary — all from the established system.
- Sign-out reuses the ghost affordance pattern from the log's action cluster.

## Design Tokens Applied

No new tokens. Uses `--plaster*`, `--recess`, `--sand`/`--hair`, `--walnut*`, `--aloe*` (primary + focus + one positive tint only), `--ink*`, `--label-ink`, `--sh-plane`, `--hi-edge`, `--ease`, `--focus`.

## Interaction Notes

- Client-side email format check on submit is UX only; the real gate (session + allowlist) is server-side (see schema.md). The four visible states are driven by the auth flow: enter-email → check-email on submit; not-invited / expired are landed on return from the magic link.
- A visually-hidden `role=status` region announces every state change; real in-app transitions move focus to the incoming heading/input.
- Fully keyboard-operable; the labeled non-shipping "Preview" demo toggle switches states for review without stealing focus.

## Motion Spec

- Entrance `rise` (signage 40ms, plane 130ms, reassurance 210ms; ≤300ms ease-out) and a per-state `settle` swap (≤240–300ms). Aloe hover-lift on the primary. Full `prefers-reduced-motion: reduce` fallback.

## Content Notes

Warm, human, non-technical copy. **No em dashes** (standing project preference — periods/commas). Invite-only framing throughout so the model is clear. Denial copy is warm but unambiguous. Placeholder addresses are realistic, never lorem.
