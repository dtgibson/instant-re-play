"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  Clock,
  DoorClosed,
  Lock,
  Mail,
  Send,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type LoginState = "signin" | "sent" | "denied" | "expired";

// A tolerant client-side format check (UX only). The real gate is server-side:
// session + allowlist (see src/lib/auth.ts). Never the access boundary.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIVE_COPY: Record<LoginState, (email: string) => string> = {
  signin: () => "Sign in. Enter your email and we will send a sign-in link.",
  sent: (email) => `Check your email. We sent a sign-in link to ${email}.`,
  denied: () =>
    "This archive is invite-only. That email is not on the invite list.",
  expired: () =>
    "That sign-in link did not work or has expired. Request a fresh one.",
};

export function LoginForm({
  initialState = "signin",
}: {
  initialState?: LoginState;
}) {
  const [state, setState] = useState<LoginState>(initialState);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const liveRef = useRef<HTMLParagraphElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);

  // Announce every state change and move focus to the incoming heading/input,
  // except on the very first render (no focus steal on load — NFR-05).
  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = LIVE_COPY[state](sentTo || email);
    }
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (state === "signin") {
      emailRef.current?.focus();
    } else {
      headingRef.current?.focus();
    }
  }, [state, sentTo, email]);

  const backToSignin = useCallback(() => {
    setInvalid(false);
    setRequestError(null);
    setState("signin");
  }, []);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = email.trim();
      if (!EMAIL_RE.test(value)) {
        setInvalid(true); // stay on enter-email (FR-02)
        emailRef.current?.focus();
        return;
      }
      setInvalid(false);
      setRequestError(null);
      setSubmitting(true);
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: value,
          options: {
            // Server callback re-validates this target with safeNext (FR-04).
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
            // The allowlist, not Supabase user-existence, is the gate — an
            // invited person who has never signed in still gets a link. The
            // "check your email" confirmation is shown IDENTICALLY whether or
            // not the address is allowlisted, so the login never reveals who is
            // invited (FR-02, no enumeration).
            shouldCreateUser: true,
          },
        });
        if (error) {
          setRequestError(
            "We could not send a link just now. Please try again in a moment.",
          );
          return;
        }
        setSentTo(value);
        setState("sent");
      } finally {
        setSubmitting(false);
      }
    },
    [email],
  );

  return (
    <main className="login">
      <div className="doorwrap">
        {/* wordmark signage, over the open garden air */}
        <div className="signage">
          <p className="eyebrow">A private theatre archive</p>
          <h1 className="wordmark">
            Instant{" "}
            <span className="thin">
              Re<span className="dot">&middot;</span>Play
            </span>
          </h1>
          <p className="tagline">A record of time well spent.</p>
        </div>

        {/* the single floating plaster plane — the front door */}
        <section className="door" aria-labelledby="doorHeading">
          <p ref={liveRef} className="visually-hidden" role="status" aria-live="polite" />

          {state === "signin" && (
            <div className="panel panel--signin">
              <h2 id="doorHeading" ref={headingRef} tabIndex={-1}>
                Welcome in.
              </h2>
              <p className="lead" id="inviteHint">
                Instant Re-Play is private. If you have been invited, enter your
                email and we will send you a sign-in link.
              </p>

              <form className="form" onSubmit={onSubmit} noValidate>
                <div className={cn("field", invalid && "invalid")} id="emailField">
                  <label htmlFor="email">Email address</label>
                  <input
                    ref={emailRef}
                    className="input"
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    aria-invalid={invalid || undefined}
                    aria-describedby="inviteHint emailErr"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (invalid && EMAIL_RE.test(e.target.value.trim())) {
                        setInvalid(false);
                      }
                    }}
                  />
                  <span className="err" id="emailErr" role="alert">
                    <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
                    That does not look like an email address. Check it and try
                    again.
                  </span>
                  {requestError && (
                    <span className="err err-request" role="alert">
                      <CircleAlert
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {requestError}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block send-btn"
                  disabled={submitting}
                >
                  <Send size={16} strokeWidth={2} aria-hidden="true" />
                  {submitting ? "Sending the link" : "Send me a link"}
                </button>
              </form>
            </div>
          )}

          {state === "sent" && (
            <div className="panel panel--sent">
              <span className="glyph pos" aria-hidden="true">
                <Mail size={27} strokeWidth={1.6} />
              </span>
              <h2 ref={headingRef} tabIndex={-1}>
                Check your email
              </h2>
              <p className="lead">
                We sent a sign-in link to <strong>{sentTo}</strong>. Click it to
                come in.
              </p>
              <p className="micro">
                It can take a moment to arrive. If it is not there, check your
                spam folder.
              </p>
              <div className="back-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-md"
                  onClick={backToSignin}
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {state === "denied" && (
            <div className="panel panel--denied">
              <span className="glyph neutral" aria-hidden="true">
                <DoorClosed size={27} strokeWidth={1.6} />
              </span>
              <h2 ref={headingRef} tabIndex={-1}>
                You are not on the list
              </h2>
              <p className="lead">
                This archive is invite-only, and that email is not on the list.
                If you think that is a mistake, check with whoever invited you.
              </p>
              <div className="back-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-md"
                  onClick={backToSignin}
                >
                  Try a different email
                </button>
              </div>
            </div>
          )}

          {state === "expired" && (
            <div className="panel panel--expired">
              <span className="glyph neutral" aria-hidden="true">
                <Clock size={27} strokeWidth={1.6} />
              </span>
              <h2 ref={headingRef} tabIndex={-1}>
                That link did not work
              </h2>
              <p className="lead">
                That link did not work or has expired. Let us send a fresh one.
              </p>
              <div className="back-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-md"
                  onClick={backToSignin}
                >
                  Enter my email again
                </button>
              </div>
            </div>
          )}
        </section>

        {/* invite-only reassurance, tucked under the door */}
        <p className="doorfoot">
          <span className="lock" aria-hidden="true">
            <Lock size={13} strokeWidth={1.7} />
          </span>
          No passwords, ever. We only send a one-time link to an invited address.
        </p>
      </div>
    </main>
  );
}
