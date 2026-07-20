import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root middleware — refreshes the Supabase session and gates every matched
 * request (FR-09). Delegates to `updateSession`.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Node runtime: the auth path uses `getUser()` and shares the app's Node
  // dependencies (matches /api/export and the Neon/exceljs stack).
  runtime: "nodejs",
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static, _next/image (build assets)
     * - favicon.ico and common static file extensions
     * - the web app manifest (.webmanifest — public install identity, no user
     *   data; must be fetchable for Add-to-Home-Screen to work)
     * - login (the login screen) and auth/ (callback + signout)
     * so those public auth surfaces run un-gated and there is no redirect loop
     * (FR-18). Everything else — /, /stats, /api/export — is gated.
     */
    "/((?!_next/static|_next/image|favicon.ico|login|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|webmanifest)$).*)",
  ],
};
