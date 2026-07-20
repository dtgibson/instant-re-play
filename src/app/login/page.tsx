import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getInvitedUser } from "@/lib/auth";

import { LoginForm } from "./login-form";

// The login screen and the callback are the ONLY surfaces reachable without a
// valid, invited session (FR-18). Read auth live on every request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Instant Re-Play · Sign in",
  description: "A private theatre archive. Sign in with a one-time email link.",
};

type LoginState = "signin" | "denied" | "expired";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // An already-invited session never sees the login form — send them in (FR-18).
  if (await getInvitedUser()) {
    redirect("/");
  }

  const sp = await searchParams;
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  // The callback/middleware sign a non-allowlisted visitor out and land them
  // here with ?notice=not-invited (FR-16); an invalid/expired link lands here
  // with ?error=link (FR-17). Otherwise the default enter-email state (FR-14).
  const initialState: LoginState =
    notice === "not-invited" ? "denied" : error === "link" ? "expired" : "signin";

  return <LoginForm initialState={initialState} />;
}
