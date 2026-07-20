import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Jost } from "next/font/google";

import "./globals.css";

// Self-hosted (no runtime CDN). Jost = geometric display/signage; IBM Plex
// Sans = body. Exposed as CSS variables consumed by globals.css.
const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Instant Re-Play · The Play Log",
  description:
    "A private theatre archive. A record of time well spent.",
  applicationName: "Instant Re-Play",
  manifest: "/manifest.webmanifest",
  // Home-screen install identity (the replay-loop mark, authored in public/).
  // iOS reads apple-touch-icon + apple-web-app meta; Android/Chrome the manifest.
  appleWebApp: {
    capable: true,
    title: "Instant Re-Play",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Warm golden-hour tone so the browser chrome matches the header on launch.
  themeColor: "#E9DAC0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jost.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
