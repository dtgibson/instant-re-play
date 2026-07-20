import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at /manifest.webmanifest. Gives Android/Chrome a
 * proper install identity (name, standalone display, theme, and the replay-loop
 * icons authored in public/). iOS reads the apple-touch-icon + apple-web-app
 * meta from layout.tsx instead; between them, Add-to-Home-Screen shows the
 * designed mark and "Instant Re-Play", never a generic screenshot.
 *
 * This route carries no user data, so it is served un-gated (see the middleware
 * matcher) — a manifest must be fetchable for install to work.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Instant Re-Play",
    short_name: "Re-Play",
    description: "A private theatre archive. A record of time well spent.",
    display: "standalone",
    start_url: "/",
    background_color: "#F3EAD8",
    theme_color: "#E9DAC0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
