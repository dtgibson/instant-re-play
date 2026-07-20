# Decisions

Durable, project-level product decisions and the reasoning behind them.
This is the audit trail for choices that shape how future features are
built — not a changelog of everything done.

---

## Play Log — IMDb search links, people only — 2026-07-19

**Decision:** People names (actors, directors) link to IMDb *search*
URLs, never guessed deep links. Venues and productions get no IMDb link.
**Rationale:** Theatre people and stage productions are unreliably
represented on IMDb; a guessed deep link risks the wrong person or a dead
page, whereas a search link always resolves. This honors "link out to more
info" without ever producing a broken or wrong link.
**Implications:** Any future external linking follows the same
shape-not-guess rule. A theatre-specific source, if added later, may
supplement but should keep the always-resolves guarantee.

## Data Export — full archive, formula-injection neutralized — 2026-07-19

**Decision:** Export writes the *entire* archive (never the current
search/filter view), one row per play with cast joined into a single cell,
in two real formats (CSV and genuine `.xlsx`). Every cell is neutralized
against spreadsheet formula injection.
**Rationale:** v1 export is a trust-critical backup, so it must capture
everything, not a partial view. A real `.xlsx` opens natively with typed
cells rather than "CSV that Excel happens to open." Injection safety is a
named acceptance requirement, not a nicety: any cell beginning with a
formula trigger is neutralized in both formats so opening the file can
never execute code.
**Implications:** Import (deferred) should round-trip this fixed column
shape. "Export what's filtered" is a plausible later enhancement, kept out
of v1. Any new export path inherits the injection-safety requirement.

## Stats — computed live on read, never stored — 2026-07-19

**Decision:** All stats are aggregated live from current data on every
request (the route is dynamic). Nothing is precomputed, cached, or stored;
no schema change. The most-seen lists reuse the log's existing exact-match
click-to-filter so a count always equals what the filtered log shows.
**Rationale:** At the product's scale (≤ ~1,000 plays) live aggregation is
effortless, and it means the numbers stay true as the log grows with zero
maintenance or drift. Reusing the log's read and filter semantics keeps a
single source of truth.
**Implications:** Future summary features should aggregate over the
existing read rather than introduce stored aggregates. Filter semantics are
a shared contract — changing them changes stats too.

## Shared Login — one shared archive, not per-user — 2026-07-19

**Decision:** The archive stays a single shared log. Invited people all
sign into and edit the same data — no `user_id`, no row-level scoping, no
per-person separation. The database does not change when auth is added.
**Rationale:** This is a family archive shared with one trusted person, not
a multi-tenant product. Adding identity should not fork the data model.
**Implications:** Any future per-user feature (private entries, ownership)
is a deliberate, non-trivial data-model change, not an assumed default.

## Shared Login — magic-link + allowlist over Deployment Protection — 2026-07-19

**Decision:** Access is gated by application-level magic-link sign-in
(Supabase Auth) plus a server-side email invite allowlist. Vercel
Deployment Protection is switched off once the app self-guards.
**Rationale:** Deployment Protection can only admit people on the owner's
Vercel account or make the deployment fully public — it cannot invite a
non-technical, non-account guest. An app-owned login admits named people
and no one else. A valid Supabase session is necessary but not sufficient:
being *invited* (on the allowlist) is a separate, stricter check the app
owns. Magic link is the lowest-friction sign-in for a non-technical user.
**Implications:** The allowlist is the real gate and is enforced
server-side on every request. The switch off Deployment Protection happens
only after the login is proven to cover every surface, so there is never a
window where the archive is public.

## Shared Login — Neon holds data, Supabase is identity-only — 2026-07-19

**Decision:** Supabase answers "who is this and are they invited"; Neon
continues to hold the plays. `getDb()` is untouched; no service-role key is
used in client-reachable code, and only the Supabase anon key and app URL
reach the client.
**Rationale:** Confining the new dependency to the auth boundary keeps the
working production database untouched and low-risk, and keeps secret
exposure minimal.
**Implications:** Auth and data stay decoupled. Data logic depends on Neon
via `getDb()`; identity logic depends on Supabase. Neither reaches across.

## Entry Polish — playwright as one additive nullable column — 2026-07-19

**Decision:** Adding a per-play playwright is a single nullable text column
on `plays` (additive migration, existing rows blank), run through the Improve
lane as polish rather than scoped as its own feature.
**Rationale:** The playwright is the one obvious missing person on a theatre
record, and the log's person-value contract already fits it exactly. It needs
no new surface, endpoint, or model, only one column, an exact-match index,
and reuse of the existing director treatment. That is refinement, not a
feature.
**Implications:** Additive nullable fields on `plays` that fit the existing
contract stay on the Improve lane. A field needing its own surface,
relationships, or aggregates would be a feature instead.

## Entry Polish — autocomplete is self-sourced and non-correcting — 2026-07-19

**Decision:** Entry-field autocomplete suggests only the user's own prior
values (derived client-side from the already-loaded archive) and never
auto-corrects: unmatched input saves exactly as typed, and exact-match
filter/stats/search semantics are unchanged. This reverses the Play Log PRD's
"autocomplete out of scope" for self-sourced suggestions only, with no
canonical entities.
**Rationale:** The exact-match contract silently fragments on typos.
Suggesting the user's own prior spellings mitigates that at the source and
speeds logging, without a corrections layer or a canonical venue/person
database that would change what a filter means.
**Implications:** Autocomplete is a convenience over existing data, never a
source of truth. Canonical entities remain deferred; any future one is a
deliberate model decision, not an extension of this.

## Entry Polish — home-screen identity is the "replay loop" mark — 2026-07-19

**Decision:** The install/home-screen identity is the "replay loop" icon
(Direction B): a walnut replay arc with a clay arrowhead around an aloe play
triangle on the golden-hour tile, wired via a web manifest and apple-touch /
maskable icons.
**Rationale:** Of the explored directions, the replay loop reads as a warm,
literal nod to the product name and stands out deliberately among cool system
icons while staying inside the Neutra language. It gives the PWA a finished
install identity in place of the generic screenshot.
**Implications:** The manifest name ("Instant Re-Play"), short name
("Re-Play"), warm theme color, and this mark are the product's home-screen
identity; future icon or splash work extends it rather than restarting.
