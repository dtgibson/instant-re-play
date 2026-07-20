import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decideAccess, isInvited, safeNext } from "@/lib/auth";

// Snapshot and restore the env vars these tests mutate, so runs stay isolated.
const SAVED = {
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
};

beforeEach(() => {
  delete process.env.ALLOWED_EMAILS;
});

afterEach(() => {
  if (SAVED.ALLOWED_EMAILS === undefined) delete process.env.ALLOWED_EMAILS;
  else process.env.ALLOWED_EMAILS = SAVED.ALLOWED_EMAILS;
});

// ---------------------------------------------------------------------------
// Allowlist parsing (FR-06)
// ---------------------------------------------------------------------------
describe("isInvited — the allowlist parser (FR-06)", () => {
  it("admits a listed address, case-insensitively and whitespace-trimmed", () => {
    process.env.ALLOWED_EMAILS = "Owner@Example.com, dad@example.com";
    // different case, and the stray spaces in the list are trimmed
    expect(isInvited("owner@example.com")).toBe(true);
    expect(isInvited("  OWNER@EXAMPLE.COM  ")).toBe(true);
    expect(isInvited("dad@example.com")).toBe(true);
  });

  it("rejects an address that is not on the list", () => {
    process.env.ALLOWED_EMAILS = "owner@example.com";
    expect(isInvited("stranger@example.com")).toBe(false);
  });

  it("rejects null/undefined/empty email", () => {
    process.env.ALLOWED_EMAILS = "owner@example.com";
    expect(isInvited(null)).toBe(false);
    expect(isInvited(undefined)).toBe(false);
    expect(isInvited("")).toBe(false);
  });

  it("fails closed: a missing or blank ALLOWED_EMAILS invites nobody (NFR-04)", () => {
    delete process.env.ALLOWED_EMAILS;
    expect(isInvited("owner@example.com")).toBe(false);

    process.env.ALLOWED_EMAILS = "   ";
    expect(isInvited("owner@example.com")).toBe(false);

    process.env.ALLOWED_EMAILS = " , , ";
    expect(isInvited("owner@example.com")).toBe(false);
  });

  it("handles extra commas and blank entries without admitting the empty string", () => {
    process.env.ALLOWED_EMAILS = "owner@example.com,,dad@example.com,";
    expect(isInvited("owner@example.com")).toBe(true);
    expect(isInvited("dad@example.com")).toBe(true);
    expect(isInvited("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The access decision (FR-05/FR-07/FR-08, NFR-04) + dev bypass
// ---------------------------------------------------------------------------
describe("decideAccess — the getInvitedUser decision core", () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = "owner@example.com";
  });

  it("valid session + invited email → invited", () => {
    expect(
      decideAccess({
        nodeEnv: "production",
        supabaseConfigured: true,
        user: { email: "owner@example.com" },
      }),
    ).toBe("invited");
  });

  it("valid session + NOT invited email → denied (session necessary, not sufficient)", () => {
    expect(
      decideAccess({
        nodeEnv: "production",
        supabaseConfigured: true,
        user: { email: "stranger@example.com" },
      }),
    ).toBe("denied");
  });

  it("no session → denied", () => {
    expect(
      decideAccess({
        nodeEnv: "production",
        supabaseConfigured: true,
        user: null,
      }),
    ).toBe("denied");
  });

  it("missing Supabase env in production → denied (fail closed, NFR-04)", () => {
    expect(
      decideAccess({
        nodeEnv: "production",
        supabaseConfigured: false,
        user: { email: "owner@example.com" },
      }),
    ).toBe("denied");
  });

  it("dev-only bypass: NOT production AND Supabase unconfigured → dev-bypass", () => {
    expect(
      decideAccess({
        nodeEnv: "development",
        supabaseConfigured: false,
        user: null,
      }),
    ).toBe("dev-bypass");
    expect(
      decideAccess({
        nodeEnv: "test",
        supabaseConfigured: false,
        user: null,
      }),
    ).toBe("dev-bypass");
  });

  it("bypass is DEAD in production even when Supabase is unconfigured", () => {
    // The exact production misconfiguration: NODE_ENV=production, no Supabase.
    // Must deny, never bypass.
    expect(
      decideAccess({
        nodeEnv: "production",
        supabaseConfigured: false,
        user: { email: "owner@example.com" },
      }),
    ).toBe("denied");
  });

  it("configured in dev still requires real auth (no bypass once Supabase is set)", () => {
    expect(
      decideAccess({
        nodeEnv: "development",
        supabaseConfigured: true,
        user: null,
      }),
    ).toBe("denied");
    expect(
      decideAccess({
        nodeEnv: "development",
        supabaseConfigured: true,
        user: { email: "owner@example.com" },
      }),
    ).toBe("invited");
  });
});

// ---------------------------------------------------------------------------
// Open-redirect guard (FR-04, NFR-03)
// ---------------------------------------------------------------------------
describe("safeNext — the callback redirect guard (FR-04)", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/stats")).toBe("/stats");
    expect(safeNext("/stats?filter=venue&value=Almeida")).toBe(
      "/stats?filter=venue&value=Almeida",
    );
  });

  it("defaults to '/' for a missing target", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("http://evil.com/path")).toBe("/");
    expect(safeNext("http:evil")).toBe("/");
  });

  it("rejects protocol-relative and backslash-smuggled targets", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/\\/evil.com")).toBe("/");
  });

  it("rejects non-slash-anchored and scheme-like targets", () => {
    expect(safeNext("evil.com")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("../secret")).toBe("/");
  });
});
