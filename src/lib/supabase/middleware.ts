import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { isInvited } from "@/lib/auth";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/**
 * Build a redirect to /login, carrying any refreshed/cleared auth cookies from
 * `from` so the browser stays in sync (e.g. a sign-out clears cookies).
 */
function redirectToLogin(
  request: NextRequest,
  notice?: "not-invited",
  from?: NextResponse,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = notice ? `?notice=${notice}` : "";
  const res = NextResponse.redirect(url);
  from?.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
  return res;
}

/**
 * Middleware session refresh + FIRST gate (the outer door). Runs on every
 * matched request (all app + API routes except the public auth surfaces and
 * static assets — see `src/middleware.ts`). It:
 *
 *   1. Refreshes the Supabase session cookies (via `getUser()`), and
 *   2. Redirects unauthenticated (no session) or uninvited (session not on the
 *      allowlist) visitors to /login BEFORE any protected content runs (FR-09).
 *
 * Middleware is the first gate, NOT the only gate: every boundary re-checks
 * independently with `getInvitedUser()` (FR-10, NFR-02).
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  // Local-dev bypass — ACTIVE ONLY when NOT production AND Supabase is
  // unconfigured. Real auth is impossible locally (no keys) and unnecessary; let
  // matched requests through so `npm run dev`/tests work. DEAD in production
  // (NODE_ENV === "production" forces the real gate below). [AUDITOR: dev bypass]
  if (process.env.NODE_ENV !== "production" && !isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  // Fail closed (NFR-04): required Supabase env missing in production → no
  // session is possible, deny every protected surface.
  if (!isSupabaseConfigured()) {
    return redirectToLogin(request);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT (@supabase/ssr footgun): run NO code between createServerClient
  // and getUser(). getUser() revalidates the token and refreshes cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(request);
  }

  if (!isInvited(user.email)) {
    // Signed in but not on the allowlist → sign out and route to not-invited.
    // A non-allowlisted session gets no protected content anywhere (FR-08).
    await supabase.auth.signOut();
    return redirectToLogin(request, "not-invited", supabaseResponse);
  }

  // Invited: return the response as-is so refreshed cookies ride back.
  return supabaseResponse;
}
