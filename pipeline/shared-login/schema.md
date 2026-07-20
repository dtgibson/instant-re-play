# Schema / Architecture — Shared Login

**Feature:** shared-login
**Date:** 2026-07-19
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md
**Depends on:** design-system.md (Neutra), src/db/index.ts, src/app/{page,layout}.tsx, src/app/actions.ts, src/app/api/export/route.ts, src/app/stats/page.tsx

---

## 0. The headline: THIS FEATURE ADDS NO DATA-SCHEMA CHANGE

There is **no database migration in this feature.** Read this section first so the
Builder does not reach for Drizzle by reflex.

- The Drizzle tables **`plays`** and **`play_actors`** are **unchanged** — no new
  columns, no `user_id`, no `owner_id`, no per-row scoping, no new tables, no
  indexes, no enums.
- **`src/db/schema.ts` is not edited.** The `/drizzle` migrations folder is not
  touched. Running **`npm run db:generate` (drizzle-kit generate) MUST produce no
  new migration** — an empty diff is the pass condition. If `db:generate` emits a
  file, something was changed that should not have been; revert it.
- **`getDb()` and `src/db/index.ts` are untouched.** Neon (prod) / PGlite (dev)
  stay exactly as they are. The Neon connection, the `AppDatabase` type, the
  repository (`src/db/repository.ts`), `listPlays`, and every existing read/write
  keep their current behaviour for a signed-in, invited user (NFR-07).
- **The data stays a single SHARED log in Neon.** Every invited user reads and
  writes the *same* archive. Identity governs **access only**, never *which rows*
  are shown. There is no per-user data separation (FR-20).
- **Supabase is used ONLY for identity.** Supabase Auth keeps its own users /
  sessions in **its own managed Postgres**, which Drizzle never sees and which
  never lives in Neon. Two databases, two jobs: **Neon = the plays** (unchanged),
  **Supabase = who is signing in** (new). They never share a schema or a
  connection.

Everything below is an **application-layer auth architecture** bolted in front of
the existing app. No SQL, no ORM changes.

---

## 1. Packages

Add two runtime dependencies (both maintained by Supabase, both work in the
Next.js App Router with Node):

| Package | Why |
|---|---|
| `@supabase/supabase-js` | The core client the auth helpers wrap. |
| `@supabase/ssr` | App-Router cookie-aware clients (`createServerClient`, `createBrowserClient`) and the middleware session-refresh pattern. **This is the package that makes sessions live in httpOnly cookies instead of client storage.** |

No other new dependencies. **No service-role SDK, no admin client, nothing that
would need the service-role key.**

---

## 2. Supabase Auth via `@supabase/ssr` — the three clients

`@supabase/ssr` gives us three thin client factories, one per execution context.
All three are constructed from the **public** URL + anon key only.

### 2.1 Browser client — `src/lib/supabase/client.ts`
`createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`.
Used **only** by the login form (a client component) to call
`supabase.auth.signInWithOtp(...)`. It never makes an access decision — it just
requests the magic-link email. All gating is server-side.

### 2.2 Server client — `src/lib/supabase/server.ts`
`createServerClient(url, anonKey, { cookies })` wired to Next's `cookies()` from
`next/headers`. Cookie adapter shape (the canonical `@supabase/ssr` pattern):

```ts
// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Writable in Route Handlers & Server Actions; a harmless no-op in a
          // pure Server Component (which cannot set cookies). Token *refresh* is
          // owned by middleware (§4), so the no-op path is fine.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    },
  );
}
```

Used by: the login page, the `/auth/callback` handler, the sign-out handler, the
`/api/export` route, the stats page, the log page, and every server action —
i.e. everywhere an authoritative check is made.

### 2.3 Middleware client — `src/lib/supabase/middleware.ts`
The `updateSession(request)` helper (§4). Same `createServerClient`, but the
cookie adapter reads from the incoming `NextRequest` and writes onto a
`NextResponse` so refreshed tokens ride back to the browser on every request.

### The one non-negotiable rule for all server-side checks

**Always gate on `supabase.auth.getUser()`, never `getSession()`.**
`getUser()` revalidates the token against the Supabase Auth server and returns an
authenticated user or nothing; `getSession()` only *reads the cookie* and trusts
it. Access decisions built on `getSession()` are forgeable — the Auditor will
reject them. (`getClaims()`, which verifies the JWT locally against Supabase's
published keys, is an acceptable faster equivalent if desired, but `getUser()` is
the simple, unambiguous default for this low-traffic family app.)

**Runtime:** every auth surface runs on **Node** — `export const runtime = "nodejs"`
on the callback/sign-out route handlers and the login/log/stats pages, and Node
runtime for the middleware (`export const config = { runtime: "nodejs", ... }`,
stable in Next 16). This matches the existing `/api/export` route and the Neon /
exceljs Node dependencies.

---

## 3. The allowlist gate (the real door)

A signed-in Supabase session is **necessary but never sufficient** (FR-07). The
authoritative gate is the `ALLOWED_EMAILS` allowlist, enforced server-side.

### 3.1 The parser + membership test — `src/lib/auth.ts` (shared helper)

```ts
// Fail CLOSED: a missing/blank ALLOWED_EMAILS yields an empty set → nobody is
// invited → every protected surface denies. Never fall open (NFR-04).
function invitedSet(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isInvited(email: string | null | undefined): boolean {
  if (!email) return false;
  return invitedSet().has(email.trim().toLowerCase());
}
```

`ALLOWED_EMAILS` is **comma-separated, case-insensitive, whitespace-trimmed**
(FR-06), e.g. `ALLOWED_EMAILS="Owner@Example.com, dad@example.com"`. Read
**server-side only** — it is *not* `NEXT_PUBLIC_`, never reaches the client
bundle.

### 3.2 The reusable guard — `src/lib/auth.ts`

The single helper every protected server boundary calls. One definition of
"invited", reused everywhere (defense in depth without copy-paste drift):

```ts
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** The authenticated, allowlisted user, or null. Uses getUser() (authoritative). */
export async function getInvitedUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isInvited(user.email)) return null;
  return user;
}
```

### 3.3 Where the allowlist is enforced (every layer)

1. **Middleware, on every request** (§4) — the first gate; redirects
   unauthenticated → `/login` and signs-out-and-redirects a non-allowlisted
   session.
2. **The `/auth/callback` consume** (§5) — the moment a session is minted, the
   email is tested; a non-allowlisted sign-in is signed out immediately, so a
   stranger who obtains a valid link never holds a usable session (FR-05, FR-08).
3. **Each protected boundary independently** (§6) — log page, stats page, export
   route, and each server action call `getInvitedUser()` themselves.

**Deliberate non-check at email-request time (FR-02):** the login form does **not**
consult the allowlist before calling `signInWithOtp`. The "check your email"
confirmation is shown **identically** for allowlisted and non-allowlisted
addresses, so the login screen never leaks who is on the list (no user
enumeration). The authoritative denial happens when the user **returns** with a
session (callback + middleware), not at request time. This is the correct reading
of "enforce at request/consume": enforce at **consume**, stay silent at request.

---

## 4. Middleware — session refresh + first gate

**File:** `src/middleware.ts` delegating to
`src/lib/supabase/middleware.ts#updateSession`.

`updateSession(request)`:

1. Create a `NextResponse.next({ request })`.
2. Create a `createServerClient` whose cookie adapter reads `request.cookies` and
   writes to **both** the request and that response (the standard pattern — do
   **not** create the response separately or you desync cookies).
3. **Immediately** call `const { data: { user } } = await supabase.auth.getUser();`
   — this refreshes expiring tokens and writes the new cookies onto the response.
   Run **no other code** between client creation and `getUser()` (a documented
   `@supabase/ssr` footgun).
4. Decide:
   - **No user** → redirect to `/login` (preserving the intended path as a
     sanitized `?next=` — see §5 open-redirect guard).
   - **User but `!isInvited(user.email)`** → **sign out** (clear the auth cookies)
     and redirect to `/login?notice=not-invited`. A non-allowlisted session gets
     no protected content anywhere (FR-08, "signed out and shown not invited").
   - **User and invited** → return the response unchanged (tokens refreshed).
5. **Return the `supabaseResponse` object as-is** (or copy its cookies onto any
   new redirect response), so refreshed cookies are never dropped.

**Matcher** (`export const config`): run on everything **except** the public auth
surfaces and static assets —

```ts
export const config = {
  runtime: "nodejs",
  matcher: [
    // all paths except: Next internals, common static files, the login screen,
    // and the /auth/* handlers (callback + signout), which must run un-gated.
    "/((?!_next/static|_next/image|favicon.ico|login|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
```

This covers `/`, `/stats`, and **`/api/export`** (all gated), while `/login`,
`/auth/callback`, and `/auth/signout` stay reachable without a session so there
is no redirect loop (FR-18).

> **Middleware is the first gate, not the only gate.** Next.js middleware is a
> convenience, not a security boundary for Server Actions and Route Handlers.
> §6 re-checks every boundary independently (FR-10, NFR-02).

---

## 5. The magic-link flow (end to end)

```mermaid
sequenceDiagram
  participant U as Visitor
  participant L as /login (client form)
  participant SB as Supabase Auth
  participant CB as /auth/callback (server)
  participant MW as middleware
  U->>L: enter email, "send link"
  L->>SB: signInWithOtp({ email, emailRedirectTo: /auth/callback?next=/ })
  SB-->>U: magic-link email (uniform "check your email" shown)
  U->>CB: click link (?code=... &next=/)
  CB->>SB: exchangeCodeForSession(code)  → sets httpOnly cookies
  CB->>CB: getUser(); isInvited(email)?
  alt invited
    CB-->>U: redirect to safeNext(next) (default "/")
  else not invited
    CB->>SB: signOut() (clear cookies)
    CB-->>U: redirect /login?notice=not-invited
  else no/expired code
    CB-->>U: redirect /login?error=link
  end
  U->>MW: subsequent request to "/"
  MW->>SB: getUser() + isInvited → refresh & allow
```

### 5.1 `/login` — `src/app/login/page.tsx` (+ `login-form.tsx` client child)
- A **server component** that reads the session (`getInvitedUser()` / `getUser()`)
  and the query params to choose which of the four states to render (§7). It is
  the **only** page besides the callback reachable without an invited session.
- If an **already-invited** session hits `/login`, redirect straight to `/`
  (don't show a login form to someone who is in).
- The email entry + "check your email" UI lives in a small **client component**
  (`login-form.tsx`) that owns the `createBrowserClient` and calls:
  ```ts
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      shouldCreateUser: true, // dad has never signed in before; the allowlist,
                              // not Supabase user-existence, is the gate.
    },
  });
  ```
  On success → swap to the "check your email" state. Malformed email → inline
  error, stay on enter-email (FR-02). The form response is **identical**
  regardless of allowlist membership.

### 5.2 `/auth/callback` — `src/app/auth/callback/route.ts` (GET route handler)
Node runtime. Steps:
1. Read `code` and `next` from the URL.
2. If no `code` → redirect `/login?error=link` (invalid/expired link state, FR-17).
   No session established.
3. `const supabase = await createClient(); const { error } =
   await supabase.auth.exchangeCodeForSession(code);` — the exchange happens
   **server-side**; cookies are set httpOnly via the adapter. On `error`
   (expired / already used) → redirect `/login?error=link` (FR-17).
4. `getUser()`; if `!isInvited(user.email)` → `supabase.auth.signOut()` then
   redirect `/login?notice=not-invited` (FR-05/FR-16). No lingering usable
   session for a stranger.
5. Invited → redirect to `safeNext(next)`.

> The email template's confirmation URL is the default `{{ .ConfirmationURL }}`,
> which carries the PKCE `code` back to `emailRedirectTo`. If the project is
> configured for the `token_hash` + `type` style instead, the equivalent handler
> lives at `/auth/confirm` and calls
> `supabase.auth.verifyOtp({ token_hash, type })`; the redirect/allowlist logic
> is identical. Pick one and keep the Supabase email template in agreement.

### 5.3 Open-redirect guard — `safeNext()` (in `src/lib/auth.ts`)
The callback (and the middleware's `?next=`) redirect **only to a validated,
same-origin, relative path** (FR-04, NFR-03). Anything absolute or
protocol-relative is discarded for the default `/`:

```ts
export function safeNext(next: string | null): string {
  if (!next) return "/";
  // Must be a single-leading-slash internal path. Reject "//evil.com",
  // "/\\evil.com", "https://...", "http:...", and any non-"/"-anchored value.
  if (!/^\/(?![/\\])/.test(next)) return "/";
  return next;
}
```

Supabase's own **Redirect URL allowlist** (dashboard, §8) is a *second* layer:
Supabase refuses to send a magic link whose `emailRedirectTo` isn't allowlisted,
so even a tampered request can't point the link off-origin.

---

## 6. Route protection — defense in depth at every boundary

Middleware (§4) is the outer gate. Each boundary below **independently**
re-verifies session + allowlist server-side, because middleware alone is not a
security boundary for actions/handlers (FR-10, NFR-01, NFR-02). All reuse the one
`getInvitedUser()` helper.

| Boundary | File | Guard | On deny |
|---|---|---|---|
| Log page `/` | `src/app/page.tsx` | `if (!(await getInvitedUser())) redirect("/login")` **before** `getDb()`/`listPlays` | redirect to `/login`, render **no** plays/counts/names (FR-11) |
| Stats page `/stats` | `src/app/stats/page.tsx` | same, before any `computeStats` read | redirect to `/login`, render nothing (FR-11) |
| Export route `/api/export` | `src/app/api/export/route.ts` | `if (!(await getInvitedUser())) return new Response(null,{status:401})` (or redirect) **before** `listPlays` | 401 / redirect, **stream no file, read no data** (FR-12) |
| `createPlayAction` | `src/app/actions.ts` | `if (!(await getInvitedUser())) return { ok:false, ... }` (or `throw`) **before** `getDb()` | no insert, no data returned (FR-13) |
| `updatePlayAction` | `src/app/actions.ts` | same, before `updatePlay` | no update (FR-13) |
| `deletePlayAction` | `src/app/actions.ts` | same, before `deletePlay` | no delete (FR-13) |

- The guard runs **before the first DB touch** in each — so an uninvited caller
  triggers zero DB work and receives zero archive bytes.
- The existing behaviour after the guard passes is **unchanged** (same
  `listPlays`, `revalidatePath("/")`, validation, export output). The guard is the
  only addition to `actions.ts`, the export route, and both pages.
- Server actions get their own guard even though they POST through a matched
  route: a Server Action is a public POST endpoint and **must not** trust that
  middleware ran (FR-10).

---

## 7. The login screen + four auth states (Neutra)

One route (`/login`) renders four states, all in the established Neutra system —
floating **plane** surface on the atmospheric ground, Jost uppercase micro-labels
in `--label-ink`, IBM Plex body, the **single `--aloe` `.btn-primary`** reserved
for the one primary action, `--focus` 3px aloe `:focus-visible` ring, usable at
360px with no horizontal scroll (FR-14–18, NFR-05, NFR-06).

| State | Trigger | Content |
|---|---|---|
| **Enter email** | default, unauthenticated | wordmark eyebrow, labeled single email input, aloe "Send the link" primary. No password field anywhere (FR-01/FR-14). |
| **Check your email** | after `signInWithOtp` succeeds | "We sent a link to `<email>` — open it to sign in." A ghost "use a different email" resets to enter-email. Shown **identically** whether or not invited (FR-02/FR-15). Announced to AT (`role="status"`). |
| **Not invited** | `?notice=not-invited` (callback/middleware signed them out) | Clear, non-technical: "This email isn't on the invite list." A "try a different email" control returns to enter-email. Grants no access (FR-16). |
| **Invalid / expired link** | `?error=link` | "That link didn't work — it may have expired or already been used." One action back to enter-email to request a fresh link. No session (FR-17). |

Accessibility (NFR-05): the email field is `<label>`-associated; validation/error
text is tied via `aria-describedby` and announced; state changes use a
`role="status"` live region; focus is keyboard-visible; **no state signalled by
colour alone** (icon/text always accompany).

**Sign-out control (FR-19):** a small, visible control in the log masthead
(`header.sky .brandrow` in `play-log.tsx`) **and** the stats header
(`stats/page.tsx`). Implemented as a tiny **`<form method="post"
action="/auth/signout">`** with a ghost button — a POST (not a GET link) so a
prefetch or a forged image can't log the user out, and so the session is cleared
**server-side**. Styled as a calm ghost action; it must **not** wear the reserved
aloe accent (the aloe stays on "Log a play" / "Send the link").

**Sign-out handler — `src/app/auth/signout/route.ts` (POST):** Node runtime.
`await supabase.auth.signOut()` (clears the httpOnly session cookies server-side)
then `redirect("/login")`. A subsequent request to any protected surface is then
unauthenticated (FR-19). A server action (`signOutAction`) is an acceptable
equivalent; the route handler keeps it JS-free and works from the client
component masthead without prop plumbing.

---

## 8. Env, secrets, and Supabase dashboard config

### 8.1 Environment variables

| Var | Scope | Public? | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | **public-safe** | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | **public-safe** | Supabase anon key — designed to ship to browsers; RLS/allowlist are the real gate. |
| `ALLOWED_EMAILS` | **server only** | **no** | Comma-separated invite list (owner + dad). Never `NEXT_PUBLIC_`. |
| `DATABASE_URL` | server only | no | **Unchanged** — Neon, as today. |

**No `SUPABASE_SERVICE_ROLE_KEY` anywhere** in the app, Vercel env, or client
bundle (NFR-03). Nothing in this feature needs admin privileges. Add these to
`.env.example` (values blank) so local dev + review know what to set; the local
dev fallback (PGlite) still works, and locally `ALLOWED_EMAILS` gates the same way.

### 8.2 Supabase dashboard (one-time, done by the owner)
- **Authentication → Providers → Email:** enable the Email provider with
  **magic link / email OTP** (passwordless). No password sign-in needed.
- **Authentication → URL Configuration:**
  - **Site URL:** `https://instant-re-play.vercel.app`
  - **Redirect URLs (allowlist):** add
    `https://instant-re-play.vercel.app/**` and `http://localhost:3000/**`
    (so `emailRedirectTo=.../auth/callback` is accepted in prod and dev). This is
    the provider-side open-redirect guard (§5.3).
- **Email template:** default magic-link `{{ .ConfirmationURL }}` is fine (PKCE
  code flow). If switching to `token_hash`/`verifyOtp`, adjust the template and
  the handler path in agreement.
- Keep the **service-role key** in the dashboard only; it is never copied out.

---

## 9. Deploy configuration (FR-21) — flip protection last

Ordering matters: the archive must never be briefly public.

1. Implement + verify the login covers **every** surface (`/`, `/stats`,
   `/api/export`, all three actions) in preview.
2. Set the three env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAILS`) in Vercel (Production).
3. Configure the Supabase dashboard (§8.2) for the production domain.
4. Redeploy; confirm a signed-out stranger lands on `/login`, not the archive.
5. **Only then** turn **off** Vercel **Deployment Protection** (Project Settings →
   Deployment Protection) — the app now self-guards. Do this step **last**, so
   there is no window where platform protection is off before app protection is
   proven.

---

## 10. File inventory

**New files**

| Path | Responsibility |
|---|---|
| `src/lib/supabase/client.ts` | `createBrowserClient` factory (login form only). |
| `src/lib/supabase/server.ts` | `createClient()` — cookie-wired server client from `next/headers`. |
| `src/lib/supabase/middleware.ts` | `updateSession(request)` — refresh tokens + first gate (§4). |
| `src/lib/auth.ts` | `isInvited()`, `getInvitedUser()`, `safeNext()` — the shared, reused gate logic (§3, §5.3). |
| `src/middleware.ts` | Root middleware delegating to `updateSession`; `config.matcher` + Node runtime (§4). |
| `src/app/login/page.tsx` | Server component choosing the four auth states; redirects an invited session to `/` (§7). |
| `src/app/login/login-form.tsx` | Client component: email input + `signInWithOtp` + enter-email/check-email UI (§5.1). |
| `src/app/auth/callback/route.ts` | GET: `exchangeCodeForSession` → allowlist consume → `safeNext` redirect (§5.2). |
| `src/app/auth/signout/route.ts` | POST: `signOut()` server-side → redirect `/login` (§7). |
| Login-state CSS | Neutra styles for the login plane + states, added to `globals.css` (reuse existing plane/label/btn tokens; no one-off hex). |

**Edited files (guard + sign-out only; behaviour otherwise unchanged)**

| Path | Change |
|---|---|
| `src/app/page.tsx` | `getInvitedUser()` guard before `getDb()`/`listPlays` (FR-11). |
| `src/app/stats/page.tsx` | Same guard before reading; add sign-out control to the header. |
| `src/app/api/export/route.ts` | Guard before `listPlays`; 401/redirect on deny (FR-12). |
| `src/app/actions.ts` | Guard at the top of `createPlayAction` / `updatePlayAction` / `deletePlayAction` before any DB call (FR-13). |
| `src/components/play-log.tsx` | Add the sign-out `<form>` control to the masthead `brandrow`. |
| `package.json` | Add `@supabase/supabase-js`, `@supabase/ssr`. |
| `.env.example` | Document the three new vars (blank values). |
| `pipeline.config.json` | Update the `auth` block (provider `supabase`, strategy `magic-link + allowlist`) — metadata only. |

**Explicitly NOT touched**

- `src/db/index.ts` (`getDb`), `src/db/schema.ts`, `src/db/repository.ts`,
  `/drizzle/**` — **no migration; `db:generate` produces nothing** (§0).
- Any play-log / export / stats behaviour beyond adding the guard and the
  sign-out control (NFR-07).

---

## 11. Security checklist (for the Auditor)

- [ ] Every access decision uses `getUser()` (or `getClaims()`), **never**
      `getSession()`, server-side.
- [ ] Session lives in **httpOnly, Secure** cookies via `@supabase/ssr`; not in
      `localStorage`/client-readable storage (NFR-03).
- [ ] Allowlist enforced in **middleware + callback + every boundary**; a valid
      session that isn't allowlisted is denied everywhere (FR-07/FR-08).
- [ ] **Fail closed:** blank `ALLOWED_EMAILS` or missing Supabase env → deny, not
      open (NFR-04).
- [ ] `/api/export` and all three server actions re-check independently of
      middleware (FR-10); guard runs **before** the first DB read/write.
- [ ] Callback redirects only via `safeNext()` — no open redirect; Supabase
      redirect-URL allowlist is the second layer (FR-04).
- [ ] **No service-role key** in app, env, or client bundle; only URL + anon key
      are `NEXT_PUBLIC_` (NFR-03).
- [ ] Sign-out is a server-side **POST** that clears cookies (FR-19).
- [ ] Login response is identical for invited vs non-invited at request time (no
      enumeration); denial is at consume/return (FR-02).
- [ ] `git diff` shows **no** change under `src/db/**` or `/drizzle/**`;
      `npm run db:generate` yields an empty diff (§0).
