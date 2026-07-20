import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM build of Postgres; keep it external so Next never tries
  // to bundle the .wasm/native asset into the server build. Neon's serverless
  // driver is likewise kept external.
  serverExternalPackages: ["@electric-sql/pglite", "@neondatabase/serverless"],

  // Dev-only: allow the tailnet hostname to load /_next dev resources (JS/HMR)
  // when the local dev server is previewed over Tailscale. Next 16 blocks
  // cross-origin dev-resource requests by default. Ignored in production.
  allowedDevOrigins: ["hephaestus-developer.giraffe-chuckwalla.ts.net"],

  // Baseline security response headers on every route. frame-ancestors 'none'
  // (+ X-Frame-Options) blocks clickjacking of the login/app; the rest are safe,
  // app-agnostic hardening. Kept deliberately narrow (no script/style CSP) so it
  // cannot break the app.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
