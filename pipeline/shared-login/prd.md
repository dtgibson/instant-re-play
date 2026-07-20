# PRD — Shared Login
**Feature:** shared-login
**Date:** 2026-07-19
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

An application-level sign-in that puts the whole of Instant Re-Play behind a
front door the app owns, so the archive can be shared with one specific
trusted person (the owner's dad) without opening it to the world and without
handing out Vercel account access.

Sign-in is **passwordless magic link** via Supabase Auth, wired for the
Next.js App Router with `@supabase/ssr` and cookie-based, httpOnly sessions.
A visitor enters their email on a Neutra-styled login screen, receives a
one-time link, clicks it, and a server-side callback exchanges the code for a
session. The real gate is a small **email allowlist** (`ALLOWED_EMAILS`):
only named addresses are *invited*, and that check is enforced **server-side
on every request** — a valid Supabase session is necessary but never
sufficient. Anyone who signs in with an address that isn't on the list is
politely turned away with a clear "you're not on the invite list" message and
gets no access to any page, action, or export.

Once the login exists, **every surface** sits behind it — the play log, the
`/stats` page, the `/api/export` route, and the create/edit/delete server
actions — protected by middleware **and** an independent server-side re-check
at each boundary (defense in depth). A signed-in user can sign out from within
the app, which clears the session and returns them to the login.

Identity is the only new thing. The archive itself does not change: it stays a
single **shared** log in Neon. There is no per-user data, no `user_id`, no
row-level scoping; `getDb()`, the Drizzle schema, and every existing play-log /
export / stats behaviour are untouched for a signed-in, invited user. At
deploy, Vercel Deployment Protection is switched off (the app now self-guards),
the Supabase and allowlist env vars are set, and the app is redeployed.

---

## User Stories

> **US-01** — As the owner, I want my dad to sign in with just his email and a
> link he clicks, so that a non-technical family member can reach the archive
> with no password to create, remember, or lose.

> **US-02** — As the owner, I want only the specific people I've invited (me
> and my dad) to be able to get in — enforced on the server, on every
> request — so that signing in is not the same as being allowed in, and a
> stranger who obtains a link still cannot reach a single play.

> **US-03** — As an invited user, I want every part of the app — the log, add
> / edit / delete, export, and stats — to sit behind the same login, so that
> there is no unguarded corner and no way to reach the archive without being
> signed in and invited.

> **US-04** — As a person who signs in with an email that isn't on the invite
> list, I want a clear, non-technical message telling me I'm not invited (not
> a crash or a blank page), so that I understand what happened and no data is
> exposed to me.

> **US-05** — As an invited user, I want to sign out from within the app and be
> returned to the login, so that I can end my session on a shared or borrowed
> device.

> **US-06** — As the owner, I want the login and its states to look like they
> were always part of Instant Re-Play, so that the front door feels as
> considered and calm as the archive behind it.

> **US-07** — As the owner, I want everything the app does today to keep working
> exactly as it does now for a signed-in user, so that adding a login costs me
> nothing in the archive I already trust.

---

## Functional Requirements

### Magic-link sign-in flow (end to end)

> **FR-01** — The app shall present a login screen offering **passwordless,
> email magic-link sign-in via Supabase Auth**. The screen shall accept a
> single email address and a primary "send the link" action. No password
> field shall be presented anywhere in the sign-in flow.

> **FR-02** — On submitting a valid-format email, the app shall request a
> one-time magic-link email from Supabase for that address and shall then
> display the "check your email" state. To avoid revealing who is on the
> invite list, this confirmation shall be shown **identically** whether or not
> the address is allowlisted (the allowlist is enforced when the user returns
> with a session, not by leaking membership at request time). A malformed
> email shall be rejected inline without leaving the enter-email state.

> **FR-03** — Clicking the magic link shall land on a **server-side callback
> route** that exchanges the one-time code for a Supabase session and
> establishes that session in **secure, httpOnly cookies** via `@supabase/ssr`,
> then redirects the user onward. The code exchange shall happen on the server;
> the session shall never be assembled from client-readable storage.

> **FR-04** — The callback shall redirect **only to a validated internal
> (same-origin, relative) path**, defaulting to the log at `/`. Any
> redirect-target parameter that is absolute, protocol-relative, or otherwise
> not a safe internal path shall be ignored in favor of the default. There
> shall be **no open redirect**.

> **FR-05** — Once the callback has established a session, the app shall apply
> the allowlist: an **invited** email shall proceed into the app (landing on
> the log); a **non-allowlisted** email shall be routed to the not-invited
> state (FR-16) and granted no access. An allowlisted person shall thereby
> complete sign-in end to end — enter email → receive link → click → land in
> the archive — in one uninterrupted flow on desktop or phone.

### The invite allowlist and its server-side enforcement

> **FR-06** — The set of invited addresses shall be supplied by an environment
> variable (`ALLOWED_EMAILS`, a comma-separated list). An email shall be
> considered invited only if it matches an entry on this list, compared
> **case-insensitively and with surrounding whitespace trimmed**. The list is
> read server-side only.

> **FR-07** — Authentication **and** the allowlist shall be enforced
> **server-side on every request**. A valid Supabase session shall be
> **necessary but not sufficient**: access requires both a valid session and a
> session email present on the allowlist. Any client-side gating is
> presentation only and shall never be the access boundary.

> **FR-08** — A **signed-in-but-not-allowlisted** session shall be treated as
> **unauthorised everywhere**: it shall receive no page content, no archive
> data, no export file, and no ability to create, edit, or delete. Every
> protected surface shall deny it and route it to the not-invited state, not to
> the archive.

### Protection covering every page, server action, and API route

> **FR-09** — **Middleware** shall run on every applicable request, refresh the
> Supabase session cookies, and — **before** any protected content or handler
> executes — redirect unauthenticated (no valid session) or uninvited (session
> not on the allowlist) visitors to the login (or not-invited) screen. The
> middleware matcher shall cover all application routes except the public
> auth surfaces (login, callback) and static assets.

> **FR-10** — Protection shall **not rely on middleware alone**. In addition to
> FR-09, **each protected boundary shall independently re-verify session +
> allowlist server-side** (defense in depth), covering: the **log page**
> (`/`), the **stats page** (`/stats`), the **export route handler**
> (`/api/export`), and **each mutating server action** in `actions.ts`
> (`createPlayAction`, `updatePlayAction`, `deletePlayAction`).

> **FR-11** — An **unauthenticated or uninvited** request to the **log page**
> (`/`) or the **stats page** (`/stats`) shall redirect to the login and
> render **no archive content** (no plays, no counts, no names).

> **FR-12** — An **unauthenticated or uninvited** request to **`/api/export`**
> (either format) shall be refused — redirected to the login or answered with a
> non-200 auth response — and shall **stream no file and read no play data**.

> **FR-13** — **Each mutating server action** (create / update / delete) shall
> re-verify session + allowlist **before touching the database**. An
> unauthenticated or uninvited invocation shall perform **no data operation**
> (no insert, update, or delete) and shall **not** return archive data.

### The login screen and each auth state

> **FR-14** — **Enter-email state:** the login screen shall show the Instant
> Re-Play wordmark/eyebrow, a labeled single email input, and the primary
> send-link action, all in the Neutra design language, as the starting state
> for an unauthenticated visitor.

> **FR-15** — **Check-your-email state:** after a link is requested (FR-02),
> the screen shall confirm that a link has been sent to the entered address and
> shall tell the user to open it, without exposing whether the address is
> invited or registered. It shall offer a way back to try a different email.

> **FR-16** — **Not-invited state:** a person who completes sign-in with a
> non-allowlisted email shall see a clear, **non-technical** message that this
> email is not on the invite list, with a control to sign out and try a
> different email. This state shall grant no access to any page, action, or
> export.

> **FR-17** — **Invalid-or-expired-link state:** when the callback cannot
> complete a sign-in (the code is expired, already used, or otherwise invalid),
> the user shall see a clear message that the link didn't work, with a
> one-action way to return to the enter-email state and request a fresh link.
> No session shall be established.

> **FR-18** — The login screen and the callback route shall be the **only**
> surfaces reachable **without** a valid, invited session; all four auth states
> (FR-14–FR-17) shall be presentable to an unauthenticated visitor without a
> redirect loop.

### Sign-out

> **FR-19** — A signed-in user shall have a **visible sign-out control** within
> the app. Activating it shall clear the Supabase session **server-side**
> (Supabase sign-out plus clearing of the session cookies) and return the user
> to the login screen, revoking access; a subsequent request to any protected
> surface shall be treated as unauthenticated.

### One shared log; no data change

> **FR-20** — All invited users shall read and write the **same** archive.
> There shall be **no per-user data separation** — no `user_id` column, no
> row-level scoping, no filtering of plays by identity. Identity governs
> **access only**, not which data is shown. **Neon**, the **Drizzle schema**,
> and **`getDb()`** shall be unchanged; Supabase is used solely for identity.

### Deployment configuration

> **FR-21** — At deploy, the app shall self-guard via this login: **Vercel
> Deployment Protection shall be turned off**, and the required environment
> variables shall be set — the **Supabase project URL**, the **Supabase anon
> (public) key**, and **`ALLOWED_EMAILS`** — after which the app is redeployed.
> Following this change, the only thing between a stranger and the archive
> shall be this login. The switch from platform-level to application-level
> protection shall occur only once the login is proven to cover every surface,
> so there is no window in which the archive is public and unguarded.

---

## Non-Functional Requirements

> **NFR-01 — Server-side enforcement (security core):** The authentication and
> allowlist decision shall be computed on the server on every request — in
> middleware and re-checked at each protected boundary (FR-09/FR-10). No access
> decision shall depend on client-side code, hidden UI, or the mere presence of
> a cookie the client could forge; membership is decided by verifying the
> Supabase session server-side and testing its email against the server-only
> allowlist.

> **NFR-02 — No auth bypass on any surface:** There shall be **no route, server
> action, or route handler that leaks the archive to an unauthenticated or
> uninvited caller**. Every application surface — `/`, `/stats`,
> `/api/export`, and each server action — shall be covered by the gate; the
> only unauthenticated surfaces shall be the login and callback and static
> assets. Direct navigation to a protected URL, a direct `GET` to the export
> route, or a direct server-action invocation shall each be denied without
> exposing data.

> **NFR-03 — Secret hygiene & session safety:** Only the Supabase **project
> URL** and **anon (public-safe) key** shall reach the client; **no
> service-role key** shall ever appear in client-reachable code or the client
> bundle. Sessions shall live in **secure, httpOnly cookies** managed by
> `@supabase/ssr`, not in client-readable storage. The magic-link callback
> shall be safe (no open redirect — FR-04).

> **NFR-04 — Fail closed:** On misconfiguration (missing/blank Supabase env
> vars or a missing/empty `ALLOWED_EMAILS`), the app shall **deny access**
> (fail closed), never fall open to an unguarded archive.

> **NFR-05 — Accessibility:** The login screen and every auth state shall have
> a properly labeled email field, be fully keyboard operable with a visible
> `:focus-visible` ring, associate validation/error messaging with the field,
> announce state changes (e.g. "check your email", errors) to assistive
> technology, and never signal state by color alone.

> **NFR-06 — Responsive Neutra login:** The login screen and all states shall
> render in the established Neutra system (floating-plane surface, uppercase
> label tokens, the single aloe primary action reused for send-link), and shall
> be fully usable at a **360px-wide** viewport with **no horizontal scrolling**.
> The aloe accent shall remain reserved for the one primary action.

> **NFR-07 — Existing behaviour unchanged:** For a signed-in, invited user,
> the **play log, add/edit/delete, export, and stats shall behave exactly as
> they do today** — same list order, filtering, search, validation, export
> output, and stats figures. No schema change, no `getDb()` change, and no
> change to the archive's contents or behaviour beyond the addition of the auth
> boundary.

> **NFR-08 — Performance:** The added auth work (session refresh in middleware
> plus the per-boundary re-check) shall add only negligible latency; navigation
> between the log, stats, and export for a signed-in user shall not perceptibly
> slow, and sign-in end to end shall feel prompt.

---

## Out of Scope

- **Per-user private archives.** This is a shared log: no `user_id`, no
  row-level scoping, no per-person data. The database, schema, and `getDb()`
  do not change.
- **Passwords and OAuth providers.** Magic link only in v1; a password option
  is a deliberate later consideration, not a v1 gap.
- **Self-serve / public signup.** Access is the invite allowlist, full stop —
  no open registration.
- **Roles and permissions** beyond "invited or not." No admin tier, no
  moderation, no per-person capabilities.
- **Any change to the play-log, export, or stats functionality itself**, and
  any change to Neon, the Drizzle schema, or `getDb()`.
- **Account management UI** (managing the allowlist from within the app,
  invitations, email change) — the allowlist is env-configured by the owner.

---

## Open Questions

None — all decisions are resolved in this document. Defaults chosen where the
brief was silent, and flagged to the user in the stage hand-back:

- **Identity via Supabase, data stays in Neon.** Supabase answers "who is this
  and are they invited"; Neon keeps holding the plays, unchanged (FR-20).
- **Uniform "check your email" confirmation** regardless of allowlist
  membership, so the login never reveals who is invited; the authoritative
  denial happens on the returning, authenticated session (FR-02/FR-05/FR-16).
- **Allowlist source is `ALLOWED_EMAILS`** (comma-separated, case-insensitive,
  trimmed), read server-side only (FR-06).
- **Defense in depth:** middleware redirect **plus** an independent server-side
  re-check at every protected boundary; middleware alone is never trusted
  (FR-09/FR-10, NFR-01/NFR-02).
- **Callback is server-side and redirects only to a validated internal path**
  (default `/`); no open redirect (FR-03/FR-04).
- **Sessions in secure httpOnly cookies via `@supabase/ssr`;** only the anon
  key and URL reach the client; no service-role key client-side (FR-03,
  NFR-03).
- **Fail closed on misconfiguration** — missing env vars deny access rather
  than expose the archive (NFR-04).
- **Deploy flips platform protection to app protection last** — Deployment
  Protection comes off only after the login is proven to cover every surface
  (FR-21).

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Magic-link, no-password sign-in (FR-01) | The login screen accepts an email and a "send link" action; there is no password field anywhere in the sign-in flow. |
| QA-02 | Request link → check-email, no enumeration (FR-02) | Submitting a valid-format email requests a Supabase magic link and shows the "check your email" state; the same confirmation appears for an allowlisted and a non-allowlisted address (no membership leak); a malformed email is rejected inline without leaving the enter-email state. |
| QA-03 | Server-side callback establishes httpOnly session (FR-03) | Clicking the link hits a server callback that exchanges the code and sets secure, httpOnly session cookies via `@supabase/ssr`; the session is not readable from client JS storage. |
| QA-04 | No open redirect (FR-04) | A callback carrying an absolute or protocol-relative redirect target (e.g. `//evil.com`, `https://evil.com`) lands the user on the internal default (`/`), never on the external URL; only same-origin relative paths are honored. |
| QA-05 | Allowlisted end-to-end sign-in (FR-05) | An allowlisted user completes enter email → receive link → click → land on the log in one flow on desktop and at 360px; a non-allowlisted user completing the same flow lands on the not-invited state, not the log. |
| QA-06 | Allowlist parsing (FR-06) | With `ALLOWED_EMAILS="Owner@Example.com, dad@example.com"`, signing in as `owner@example.com` (different case, stray spaces in the list) is admitted; an address not listed is not. |
| QA-07 | Session necessary but not sufficient, server-side (FR-07) | Enforcement is computed server-side; a valid Supabase session whose email is not on the allowlist is denied on every request; removing/altering client-side gating does not grant access. |
| QA-08 | **Non-allowlisted signed-in user is denied everywhere** (FR-08) | A signed-in but non-allowlisted session receives no page content, no archive data, no export file, and cannot create/edit/delete; it is routed to the not-invited state from `/`, `/stats`, `/api/export`, and any mutating action. |
| QA-09 | Middleware gate before content (FR-09) | Middleware runs on all app routes (except login/callback/static), refreshes the session, and redirects unauthenticated/uninvited visitors to login before any protected content or handler executes. |
| QA-10 | Defense in depth at every boundary (FR-10) | With middleware bypassed/disabled in a test, each of `/`, `/stats`, `/api/export`, and each server action still independently denies an unauthenticated/uninvited caller server-side. |
| QA-11 | **Unauthenticated request to the log and stats is blocked** (FR-11) | An unauthenticated (and separately, an uninvited) request to `/` and to `/stats` redirects to the login and renders no plays, counts, or names. |
| QA-12 | **Unauthenticated request to the export route is blocked** (FR-12) | An unauthenticated (and separately, an uninvited) `GET /api/export?format=csv` and `?format=xlsx` is refused (redirect or non-200 auth response) and returns no file and no play data. |
| QA-13 | **Unauthenticated server action performs no data operation** (FR-13) | An unauthenticated/uninvited invocation of `createPlayAction`, `updatePlayAction`, and `deletePlayAction` performs no DB insert/update/delete and returns no archive data; the database is unchanged afterward. |
| QA-14 | Enter-email state (FR-14) | The login shows the wordmark/eyebrow, a labeled email field, and the primary send-link action in the Neutra style. |
| QA-15 | Check-your-email state (FR-15) | After requesting a link the screen confirms a link was sent and how to proceed, without revealing invite/registration status, and offers a way to try a different email. |
| QA-16 | Not-invited state (FR-16) | A non-allowlisted signed-in user sees a clear, non-technical "not on the invite list" message with a sign-out / try-another-email control and no access to any page, action, or export. |
| QA-17 | Invalid-or-expired-link state (FR-17) | Following an expired or already-used link shows a clear "link didn't work" message with a one-action path back to request a fresh link; no session is established. |
| QA-18 | Public auth surfaces reachable without a session (FR-18) | An unauthenticated visitor can reach the login and each auth state, and the callback, without a redirect loop; no other surface is reachable unauthenticated. |
| QA-19 | Sign-out (FR-19) | A signed-in user activates a visible sign-out control; the session is cleared server-side and cookies removed; they land on the login, and a subsequent request to any protected surface is treated as unauthenticated. |
| QA-20 | One shared log, no data change (FR-20) | Both invited users see and edit the identical archive; there is no `user_id`, no per-user filtering, and the Drizzle schema and `getDb()` are unchanged; a play added by one invited user is visible to the other. |
| QA-21 | Deploy configuration (FR-21) | On the deployed app, Vercel Deployment Protection is off, the Supabase URL, anon key, and `ALLOWED_EMAILS` env vars are set, and the app is reachable only through this login — a signed-out stranger reaches the login, not the archive. |
| QA-22 | No auth bypass — full surface sweep (NFR-01/NFR-02) | Enumerating every route, route handler, and server action, none serves archive data or performs a mutation for an unauthenticated/uninvited caller; only login, callback, and static assets are public. |
| QA-23 | Secret hygiene & session safety (NFR-03) | The client bundle contains only the Supabase URL and anon key — no service-role key; session cookies are `HttpOnly` and `Secure`; the session is not present in client-readable storage. |
| QA-24 | Fail closed (NFR-04) | With `ALLOWED_EMAILS` unset/empty or Supabase env vars missing, the app denies access to protected surfaces rather than exposing the archive. |
| QA-25 | Accessibility (NFR-05) | The email field is labeled, the flow is keyboard operable with a visible focus ring, validation/errors are associated with the field and announced, state changes are announced to assistive tech, and no state relies on color alone. |
| QA-26 | Responsive Neutra login (NFR-06) | The login and all states render in the Neutra system (plane/label tokens, single aloe primary) and are fully usable at 360px with no horizontal scrolling. |
| QA-27 | Existing behaviour unchanged for signed-in users (NFR-07) | For a signed-in, invited user, the log list order, search, filter, add/edit/delete, export output, and stats figures are identical to pre-login behaviour; no schema or `getDb()` change is present. |
| QA-28 | Performance (NFR-08) | Sign-in completes promptly and navigation between log, stats, and export for a signed-in user shows no perceptible slowdown from the added middleware session refresh and per-boundary re-check. |
