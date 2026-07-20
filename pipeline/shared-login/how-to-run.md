# How to run — Shared Login

Magic-link email sign-in + an invite allowlist in front of the whole app. This
note covers the local-dev bypass and the real production flow.

## TL;DR

- **Local dev / tests:** leave all Supabase env vars UNSET. A dev-only bypass
  signs you in automatically as a synthetic invited user. `npm run dev` and
  `npm run test` just work — no Supabase project needed.
- **Production (Vercel):** set the three env vars below. Real magic-link auth is
  always enforced; the bypass is dead. Missing config fails closed (denies).

## The local-dev bypass (must be provably inert in production)

`getInvitedUser()` and the middleware activate a bypass **only when BOTH**:

1. `process.env.NODE_ENV !== "production"`, AND
2. Supabase is not configured (`NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` blank or missing).

When active, `getInvitedUser()` returns a synthetic invited user
(`dev@localhost`) so the log, stats, and export all work locally with no auth
service. It is keyed purely on server-side values an attacker cannot set at
runtime in production: on Vercel `NODE_ENV=production`, so condition (1) is
always false and the real gate always runs. The bypass path is DEAD in prod.
See the `[AUDITOR: dev bypass]` comments in `src/lib/auth.ts` and
`src/lib/supabase/middleware.ts`.

Note: the bypass is keyed on Supabase config, not on `ALLOWED_EMAILS`. Setting
`ALLOWED_EMAILS` locally while Supabase stays unset does **not** turn the bypass
off (dev still loads as the synthetic user). To exercise the real login screen
locally, set the two `NEXT_PUBLIC_SUPABASE_*` vars (see below).

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000 — signed in as the synthetic dev user
```

To preview the real login UI locally, set a Supabase project's public vars in
`.env.local` (this disables the bypass); you then sign in with a real magic
link. Add `http://localhost:3000/**` to the Supabase redirect-URL allowlist.

## The real flow (production)

1. **Enter email** on `/login` → the client form calls
   `supabase.auth.signInWithOtp({ email, emailRedirectTo: <origin>/auth/callback?next=/ })`.
   The "check your email" confirmation is shown **identically** whether or not
   the address is on the allowlist (no enumeration).
2. **Click the link** → `GET /auth/callback` (server) exchanges the one-time
   code for a session in secure httpOnly cookies, then applies the allowlist:
   invited → redirect to a validated same-origin path (default `/`); not invited
   → sign out + `/login?notice=not-invited`; bad/expired code →
   `/login?error=link`. The redirect target is sanitized by `safeNext()` — no
   open redirect.
3. **Every request** is gated by `src/middleware.ts` (refreshes the session,
   redirects unauthenticated/uninvited to `/login`) AND independently re-checked
   at each boundary — the log page, `/stats`, `/api/export`, and all three server
   actions each call `getInvitedUser()` before any DB access (defense in depth).
4. **Sign out** — the ghost control in the log/stats header POSTs to
   `/auth/signout`, which clears the session server-side and returns to `/login`.

## Environment variables

| Var | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL (public-safe). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key (public-safe; designed to ship to browsers). |
| `ALLOWED_EMAILS` | **server only** | Comma-separated, case-insensitive, trimmed invite list. **Never** `NEXT_PUBLIC_`. |
| `DATABASE_URL` | server only | Unchanged — Neon in prod, PGlite when unset. |

There is **no service-role key** anywhere. If the Supabase vars or
`ALLOWED_EMAILS` are missing in production, the app **fails closed** (denies
access) rather than exposing the archive.

## Supabase dashboard (one-time, by the owner)

- Auth → Providers → Email: enable magic link / email OTP (passwordless).
- Auth → URL Configuration: Site URL = the production URL; Redirect URLs =
  `https://<prod-domain>/**` and `http://localhost:3000/**`.
- Keep the service-role key in the dashboard only; never copy it out.

## Deploy ordering (flip protection last, FR-21)

Set the three env vars in Vercel and configure the Supabase dashboard, redeploy,
confirm a signed-out stranger lands on `/login` (not the archive), and **only
then** turn OFF Vercel Deployment Protection — so there is no window where the
archive is unguarded.

## Verify

```bash
npm install
npx tsc --noEmit          # 0 errors
npm run build             # /login, /auth/callback, /auth/signout, middleware all compile
npm run test              # all suites incl. tests/auth.test.ts
npm run db:generate       # "No schema changes, nothing to migrate"
```
