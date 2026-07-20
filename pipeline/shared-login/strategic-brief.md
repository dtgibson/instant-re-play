# Strategic Brief — Shared Login

*Feature: `shared-login` · Instant Re-Play's fourth feature · Stage 1 (The Strategist)*

## What We're Building

An application-level sign-in that lets the owner share the archive with one
specific trusted person — his dad — without opening it to the world. A visitor
enters their email, receives a magic link, clicks it, and is signed in. Only
addresses on a small server-side allowlist are let through; everyone else is
politely turned away. Once the login exists, the whole app — the play log, add
and edit and delete, export, and stats — sits behind it, and Vercel's
platform-level Deployment Protection is switched off because the app now guards
itself.

Identity is the only new thing. The archive itself does not change: it stays a
single **shared** log in Neon, exactly as it is today. Supabase Auth handles
"who is this and are they invited"; Neon keeps holding the plays. `getDb()` is
not touched.

## Why Now

The app is live and genuinely useful, but it is currently reachable only by
people on the owner's Vercel account, because access is enforced by Vercel
Deployment Protection. That is the wrong tool for the actual goal: the owner
wants his dad — who is not on his Vercel account and is not technical — to use
the site. Deployment Protection can't grant that without either handing over
Vercel account access or making the deployment fully public. The app needs its
own front door: a login that admits named people and no one else.

## The User Problem

- **The owner** has a working archive he wants to share with
  his dad, and only his dad. He does not want the site public, and he does not
  want to manage Vercel accounts for a family member.
- **His dad** is non-technical. Passwords are friction and another thing to
  forget. He should be able to get in with nothing but his email address and a
  link he clicks — the gentlest possible sign-in.
- Both work from the **same archive**. This is a shared family log, not two
  private accounts. There is no per-person data and no reason to build any.

## Success Criteria

1. An allowlisted person can sign in end to end: enter email → receive link →
   click → land in the archive, in one uninterrupted flow, on desktop or phone.
2. A non-allowlisted person who completes sign-in is refused with a clear,
   non-technical "you're not on the invite list" message — and gets **no**
   access to any page, action, or export.
3. Every surface is protected: visiting the log, `/stats`, the export route, or
   invoking any add/edit/delete server action while unauthenticated redirects to
   the login and performs **no** data operation.
4. The allowlist and route protection are enforced **server-side** on every
   request (middleware + a re-check at each protected boundary), never by
   client-side UI alone. There is no route, action, or handler that leaks the
   archive to an unauthenticated or uninvited caller.
5. A signed-in person can sign out from within the app, and doing so returns
   them to the login and revokes access.
6. The login and its states (enter email · check your email · not invited ·
   expired/invalid link) look like they were always part of Instant Re-Play —
   fully in the Neutra design language.
7. On deploy: Deployment Protection is off, the Supabase and allowlist env vars
   are set, the app is reachable at its public URL, and the only thing standing
   between a stranger and the archive is this login.
8. Nothing about the existing play-log, export, or stats behaviour changes for a
   signed-in user; the archive is byte-for-byte the same log.

## Scope

- **Magic-link email sign-in via Supabase Auth**, using `@supabase/ssr` for the
  Next.js App Router with cookie-based, httpOnly sessions. No passwords.
- **A magic-link callback route** that completes the session exchange safely and
  redirects only to internal paths (no open redirect).
- **An email allowlist** (env-driven, e.g. `ALLOWED_EMAILS`) that is the real
  gate. Enforced server-side on every request. A signed-in-but-not-allowlisted
  session is treated as unauthorised.
- **Route protection covering the entire app**: middleware that redirects
  unauthenticated/uninvited visitors to the login, plus a server-side check at
  each protected boundary — `page.tsx` (log), `stats/page.tsx`, the
  `api/export` route handler, and the mutating server actions in `actions.ts` —
  so protection does not rely on middleware alone.
- **A sign-out control** available once signed in.
- **The login screen and its auth states** (enter email; check your email; not
  invited; expired/invalid link), styled in the established Neutra system and
  reusing its plane/label/primary-action patterns.
- **Deploy changes**: turn off Vercel Deployment Protection, add the Supabase
  project URL, Supabase anon key, and `ALLOWED_EMAILS` env vars, and redeploy.

## Out of Scope

- **Per-user private archives.** This is a shared log. No `user_id`, no row-level
  scoping, no per-person data separation. The database does not change.
- **Passwords and OAuth providers.** Magic link only in v1.
- **Self-serve / public signup.** Access is the invite allowlist, full stop.
- **Roles and permissions** beyond "invited or not." No admin tier, no
  moderation.
- **Any change to the play-log, export, or stats functionality itself**, and any
  change to Neon, the Drizzle schema, or `getDb()`.

## Key Decisions

- **Supabase for identity only; Neon stays the data store.** Supabase answers
  "who is this," Neon holds the plays. This keeps the working production database
  untouched and confines the new dependency to the auth boundary.
- **Shared archive, decided with the user.** Everyone invited signs into and
  edits the same log. This is deliberate — it is a family archive, not a
  multi-tenant product — and it is why there is no schema change.
- **The allowlist is the gate, not Supabase sign-up.** Supabase will happily
  mint a session for any email that receives a link; being *invited* is a
  separate, stricter check the app owns. It must be enforced server-side on
  every request, because a valid Supabase session is necessary but not
  sufficient for access.
- **Defence in depth, server-side.** Middleware redirects, and each protected
  page / route / server action independently re-verifies session + allowlist.
  Client-side gating is presentation only and is never trusted for access.
- **Callback safety.** The magic-link callback exchanges the code for a session
  and redirects only to a validated internal path — never to an
  attacker-supplied URL.
- **Secret hygiene.** Only the Supabase anon key (public-safe) and the app URL
  reach the client. No service-role key is ever used in client-reachable code.
  Sessions live in secure, httpOnly cookies via `@supabase/ssr`.
- **Magic link over password for the dad.** The primary user is non-technical;
  a link he clicks is the lowest-friction, lowest-failure sign-in. A password
  option is a deliberate later consideration, not a v1 gap.
- **Deployment Protection comes off only once the app self-guards.** The switch
  from platform-level to application-level protection happens at deploy, after
  the login is proven to cover every surface — so there is no window where the
  archive is public.
