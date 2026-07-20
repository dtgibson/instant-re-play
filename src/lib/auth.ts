import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * The application-level auth gate. A valid Supabase session is NECESSARY but
 * never SUFFICIENT (FR-07): access requires a valid session AND an email on the
 * server-only `ALLOWED_EMAILS` allowlist. Every protected boundary reuses the
 * one `getInvitedUser()` helper (defense in depth without copy-paste drift).
 *
 * This module is SERVER-ONLY. It reads `ALLOWED_EMAILS` (never `NEXT_PUBLIC_`)
 * and is imported only by server components, server actions, route handlers, and
 * middleware — never by a client component — so the allowlist never reaches the
 * client bundle (NFR-03). The pure helpers below (`isInvited`, `safeNext`,
 * `decideAccess`) carry no request state and are unit-tested directly.
 */

// ---------------------------------------------------------------------------
// The allowlist (the real door)
// ---------------------------------------------------------------------------

/**
 * Parse `ALLOWED_EMAILS` into a set of invited addresses.
 *
 * Comma-separated, case-insensitive, whitespace-trimmed (FR-06). FAIL CLOSED: a
 * missing/blank value yields an EMPTY set, so nobody is invited and every
 * protected surface denies. Never fall open (NFR-04).
 */
function invitedSet(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True IFF `email` is on the allowlist (case-insensitive, trimmed). */
export function isInvited(email: string | null | undefined): boolean {
  if (!email) return false;
  return invitedSet().has(email.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Open-redirect guard (FR-04, NFR-03)
// ---------------------------------------------------------------------------

/**
 * Reduce an untrusted `next` target to a validated, same-origin, RELATIVE path,
 * defaulting to the log at `/`. Anything absolute, protocol-relative, or not
 * anchored to a single leading "/" is discarded. No open redirect.
 *
 * Rejects: "https://evil.com", "http:evil", "//evil.com", "/\\evil.com",
 * "javascript:...", "" and any value whose first char is not exactly one "/".
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!/^\/(?![/\\])/.test(next)) return "/";
  return next;
}

// ---------------------------------------------------------------------------
// The access decision (pure — the unit-tested core)
// ---------------------------------------------------------------------------

export type AccessOutcome = "dev-bypass" | "invited" | "denied";

/**
 * Decide access from already-resolved inputs. Pure and side-effect free so the
 * decision logic is unit-tested without Supabase or a request.
 *
 * - `dev-bypass`: NOT production AND Supabase unconfigured — local dev/tests
 *   only (see `getInvitedUser`). DEAD in production.
 * - `denied`: fail closed when Supabase env is missing (NFR-04), when there is
 *   no valid session, or when the session email is not on the allowlist.
 * - `invited`: a valid session whose email is on the allowlist.
 */
export function decideAccess(input: {
  nodeEnv: string | undefined;
  supabaseConfigured: boolean;
  user: { email?: string | null } | null;
}): AccessOutcome {
  const { nodeEnv, supabaseConfigured, user } = input;

  // Local-dev bypass — ACTIVE ONLY when NOT production AND Supabase is
  // unconfigured. Keyed purely on server-side values an attacker cannot set at
  // runtime in production (NODE_ENV === "production" on Vercel forces the real
  // path). [AUDITOR: dev-only bypass — must be provably inert in production.]
  if (nodeEnv !== "production" && !supabaseConfigured) return "dev-bypass";

  // Fail closed (NFR-04): required Supabase env missing → deny, never open.
  if (!supabaseConfigured) return "denied";

  // Session necessary but NOT sufficient (FR-07): must also be allowlisted.
  if (user && isInvited(user.email)) return "invited";
  return "denied";
}

// ---------------------------------------------------------------------------
// The reusable server guard
// ---------------------------------------------------------------------------

/**
 * Synthetic invited user returned ONLY on the dev bypass path, so local dev and
 * the test suite exercise the app without a Supabase project. It never exists in
 * production because the bypass condition can never be true there.
 * [AUDITOR: dev-only bypass identity.]
 */
const DEV_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  aud: "authenticated",
  role: "authenticated",
  email: "dev@localhost",
  app_metadata: { provider: "dev-bypass" },
  user_metadata: { name: "Local Dev" },
  created_at: new Date(0).toISOString(),
} as unknown as User;

/**
 * The authenticated, allowlisted user, or `null`. The single guard every
 * protected server boundary calls BEFORE any database access (FR-10). Uses
 * `getUser()` (authoritative — revalidates the token), never `getSession()`.
 */
export async function getInvitedUser(): Promise<User | null> {
  const nodeEnv = process.env.NODE_ENV;
  const supabaseConfigured = isSupabaseConfigured();

  // Resolve the parts of the decision that do not need a Supabase round-trip.
  const preUser = decideAccess({ nodeEnv, supabaseConfigured, user: null });
  if (preUser === "dev-bypass") return DEV_USER;
  if (!supabaseConfigured) return null; // fail closed (production misconfig)

  // Lazily import the cookie-wired server client so this module carries no
  // `next/headers` dependency at import time — the pure helpers above stay
  // unit-testable in a plain Node/vitest environment.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return decideAccess({ nodeEnv, supabaseConfigured, user }) === "invited"
    ? user
    : null;
}
