import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Browser Supabase client — used ONLY by the login form (a client component) to
 * call `supabase.auth.signInWithOtp(...)` and request a magic-link email.
 *
 * It never makes an access decision. All gating (session + allowlist) is
 * computed server-side in middleware and re-checked at every protected boundary
 * (see `src/lib/auth.ts`). Constructed from the public URL + anon key only.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
