/**
 * Build-time icon rasterizer (NOT shipped in the app runtime — sharp is a
 * devDependency and the app serves only the static PNGs it writes). Authors the
 * home-screen assets from the Direction B replay-loop mark and writes them into
 * public/:
 *   - apple-touch-icon.png   180x180  (iOS home screen)
 *   - icon-192.png           192x192  (manifest, purpose "any")
 *   - icon-512.png           512x512  (manifest, purpose "any")
 *   - icon-maskable-512.png  512x512  (manifest, purpose "maskable")
 *
 * The "any" / apple assets use a fully-filled square tile (no transparency), so
 * every platform masks them cleanly (iOS squircle, Android adaptive). The
 * maskable variant keeps the mark inside the ~80% safe area on a full-bleed
 * tile. Run with:  npm run gen:icons
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");

const TILE = `<radialGradient id="tile" cx="50%" cy="35%" r="80%">
      <stop offset="0%" stop-color="#FFFCF5"/>
      <stop offset="55%" stop-color="#E9DAC0"/>
      <stop offset="100%" stop-color="#E3D2B4"/>
    </radialGradient>`;

// The replay-loop mark: walnut arc + clay arrowhead + aloe play triangle.
const MARK = `<path d="M256 150 a106 106 0 1 1 -96 61" fill="none" stroke="#7A5233" stroke-width="30" stroke-linecap="round"/>
  <polygon points="256,120 300,150 256,180" fill="#A5502F"/>
  <polygon points="232,214 300,256 232,298" fill="#3B6B4C"/>`;

/** A full-bleed 512 tile with the mark, optionally scaled about the centre. */
function svg({ scale = 1 } = {}) {
  const mark =
    scale === 1
      ? MARK
      : `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${MARK}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${TILE}</defs>
  <rect width="512" height="512" fill="url(#tile)"/>
  ${mark}
</svg>`;
}

async function raster(svgString, size, outfile) {
  await sharp(Buffer.from(svgString))
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, outfile));
  console.log(`  wrote public/${outfile}  (${size}x${size})`);
}

async function main() {
  mkdirSync(publicDir, { recursive: true });
  const flat = svg({ scale: 1 });
  const maskable = svg({ scale: 0.8 }); // mark inside the ~80% maskable safe area
  await raster(flat, 180, "apple-touch-icon.png");
  await raster(flat, 192, "icon-192.png");
  await raster(flat, 512, "icon-512.png");
  await raster(maskable, 512, "icon-maskable-512.png");
  console.log("Icons generated into public/.");
}

main().catch((error) => {
  console.error("Icon generation failed:", error);
  process.exit(1);
});
