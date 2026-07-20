import { LogOut } from "lucide-react";

/**
 * The in-app sign-out affordance (FR-19). A quiet ghost control showing the
 * signed-in email, implemented as a server-side POST form to /auth/signout — a
 * POST (not a GET link) so a prefetch or forged image can't log the user out,
 * and so the session is cleared server-side. It never wears the reserved aloe
 * accent (that stays on "Log a play" / "Send me a link").
 *
 * No hooks or handlers, so it renders in both server and client component trees
 * (the stats page and the log masthead) without prop plumbing.
 */
export function SignOutControl({ email }: { email: string }) {
  return (
    <div className="signout-cluster">
      <span className="signedas">
        Signed in{email ? <span className="who">{email}</span> : null}
      </span>
      <form className="signout" method="post" action="/auth/signout">
        <button type="submit" className="btn btn-ghost btn-sm">
          <LogOut size={15} strokeWidth={1.8} aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
