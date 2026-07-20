/**
 * Supabase environment — read and validate in ONE place.
 *
 * Only the public-safe values are here: the project URL and the anon key. Both
 * are `NEXT_PUBLIC_` because Supabase designs the anon key to ship to browsers
 * (RLS + our server-side allowlist are the real gate). There is deliberately NO
 * service-role key anywhere in the app (NFR-03).
 *
 * `ALLOWED_EMAILS` lives in `src/lib/auth.ts`, read server-side only — it is
 * never imported here and never `NEXT_PUBLIC_`, so it can never reach the client
 * bundle through this module.
 */

/** The Supabase project URL (public-safe). May be an empty string if unset. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** The Supabase anon key (public-safe). May be an empty string if unset. */
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Is real Supabase auth wired up? True only when BOTH public values are present
 * and non-blank. Used to (a) fail closed in production when misconfigured
 * (NFR-04) and (b) gate the local-dev bypass (see `src/lib/auth.ts`).
 */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.trim().length > 0 && SUPABASE_ANON_KEY.trim().length > 0;
}
