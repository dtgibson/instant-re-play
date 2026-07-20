import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Node runtime: clears the Supabase session server-side.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /auth/signout — clears the Supabase session server-side (Supabase
 * sign-out + cookie removal via the adapter) and returns the user to /login
 * (FR-19). A POST, not a GET link, so a prefetch or forged image can't log the
 * user out. A subsequent request to any protected surface is then
 * unauthenticated.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Same-origin guard: a cross-site forged POST can't force a sign-out. Compare
  // the Origin host to the Host header (both reflect the public domain behind a
  // proxy). A same-origin form omits or matches Origin; a cross-site one differs.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    } catch {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const dest = request.nextUrl.clone();
  dest.pathname = "/login";
  dest.search = "";
  // 303 so the browser issues a GET for the login screen after this POST.
  return NextResponse.redirect(dest, { status: 303 });
}
