import { type NextRequest, NextResponse } from "next/server";

import { isInvited, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Node runtime: the exchange + allowlist check share the app's Node auth stack.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /auth/callback — the server-side magic-link callback (FR-03).
 *
 * Exchanges the one-time PKCE `code` for a Supabase session (cookies set
 * httpOnly by the adapter), applies the allowlist at consume time (FR-05), and
 * redirects ONLY to a validated same-origin relative path (FR-04 — no open
 * redirect). A missing/expired/used code establishes no session and lands on the
 * invalid-link state (FR-17).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  const loginRedirect = (query: string) => {
    const dest = request.nextUrl.clone();
    dest.pathname = "/login";
    dest.search = query;
    return NextResponse.redirect(dest);
  };

  // Fail closed if misconfigured, or if the link carried no code (FR-17).
  if (!isSupabaseConfigured() || !code) {
    return loginRedirect("?error=link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Expired, already used, or otherwise invalid — no session established.
    return loginRedirect("?error=link");
  }

  // Consume-time allowlist check: a stranger who obtains a valid link never
  // holds a usable session (FR-05/FR-08). Uses getUser() (authoritative).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isInvited(user.email)) {
    await supabase.auth.signOut();
    return loginRedirect("?notice=not-invited");
  }

  // Invited → redirect to the validated internal path (default "/"). Constructed
  // against this origin and re-checked, so it can never escape same-origin.
  const dest = new URL(next, request.nextUrl.origin);
  if (dest.origin !== request.nextUrl.origin) {
    dest.pathname = "/";
    dest.search = "";
  }
  return NextResponse.redirect(dest);
}
