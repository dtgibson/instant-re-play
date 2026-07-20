import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Server Supabase client — cookie-wired to Next's `cookies()` from
 * `next/headers`. This is the client that makes sessions live in secure,
 * httpOnly cookies via `@supabase/ssr` (never client-readable storage, NFR-03).
 *
 * Used everywhere an authoritative check is made: the login page, the
 * `/auth/callback` handler, the sign-out handler, `/api/export`, the stats page,
 * the log page, and every server action.
 *
 * The one non-negotiable rule for access decisions: gate on
 * `supabase.auth.getUser()` (revalidates the token against Supabase), never
 * `getSession()` (only reads the cookie, forgeable). See `getInvitedUser()`.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Writable in Route Handlers & Server Actions; a harmless no-op in a
        // pure Server Component (which cannot set cookies). Token *refresh* is
        // owned by middleware, so the no-op path is fine here.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* called from a Server Component — ignore */
        }
      },
    },
  });
}
