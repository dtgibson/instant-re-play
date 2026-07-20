# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

**4 features, plus ongoing polish.**

- **Last shipped — Entry polish & app icon:** self-sourced autocomplete on
  the entry fields, a new playwright field on every play, and a designed
  home-screen icon and manifest so the app installs like a real app.
- **Previously — Shared Login:** magic-link email sign-in gating the whole
  app behind an invite allowlist, over one shared archive.

Also shipped: the Play Log (the founding entry + browse + click-to-filter
experience), Data Export (CSV / Excel backup of the whole archive), and
Stats (a live totals-and-most-seen view).

---

## Up Next

1. **CSV / Excel import** — Export shipped without its other half. Letting
   the user bring years of spreadsheet history *in* is what finally makes
   the log their complete archive, and the schema was modelled for this
   round-trip.
2. **Personal ratings and notes on each entry** — The founding brief's
   most-cited "candidate for later"; a light layer of reflection on top of
   a log that now holds real history.
3. **Playwrights in Stats** — The log now records a playwright per play, but
   the Stats view doesn't yet count them. A most-seen-playwrights list
   alongside venues, directors, and actors closes that gap.

---

## On the Horizon

- Photo attachments for programmes and ticket stubs
- Richer external links via theatre-specific sources where they exist
- A password sign-in option alongside magic link, if the link flow ever
  proves to be friction
- "Export what's filtered" (current-view export) on top of the full-archive
  backup
