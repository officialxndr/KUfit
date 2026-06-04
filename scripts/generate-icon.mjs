/**
 * Hale app-icon generator. Designs the icon in SVG (an "H" whose crossbar is a
 * heartbeat/ECG pulse, white on an indigo gradient) and rasterizes every asset Expo
 * needs. Re-run after tweaking the constants below:  `node scripts/generate-icon.mjs`
 *
 * Outputs (paths referenced by app.json):
 *   assets/images/icon.png                    1024  full icon (gradient bg + glyph)
 *   assets/images/android-icon-foreground.png 1024  glyph only, padded for adaptive safe zone
 *   assets/images/android-icon-background.png 1024  solid indigo gradient
 *   assets/images/android-icon-monochrome.png 1024  glyph silhouette (themed icons)
 *   assets/images/splash-icon.png              512  glyph only, transparent (shown on #0a0a0a)
 *   assets/images/favicon.png                  196  full icon (web)
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'images');

const INDIGO_TOP = '#6366f1';
const INDIGO_BOTTOM = '#4f46e5';
const GLYPH = '#ffffff';

// Glyph geometry on a 1024 canvas (centered on 512,512).
const BAR_W = 96, BAR_RX = 48;
const LEFT_X = 282, RIGHT_X = 646;     // bar left edges
const BAR_TOP = 268, BAR_H = 488;      // bars span y 268..756
const PULSE_W = 56;                    // crossbar stroke
// ECG crossbar across the gap between the bars, baseline y=512.
const PULSE = 'M372,512 L430,512 L462,548 L502,420 L542,596 L574,512 L652,512';

/** The H + heartbeat glyph, optionally scaled about the canvas center. */
function glyph(color, scale = 1) {
  const inner = `
    <rect x="${LEFT_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}" rx="${BAR_RX}" fill="${color}"/>
    <rect x="${RIGHT_X}" y="${BAR_TOP}" width="${BAR_W}" height="${BAR_H}" rx="${BAR_RX}" fill="${color}"/>
    <path d="${PULSE}" fill="none" stroke="${color}" stroke-width="${PULSE_W}"
          stroke-linecap="round" stroke-linejoin="round"/>`;
  if (scale === 1) return inner;
  return `<g transform="translate(512,512) scale(${scale}) translate(-512,-512)">${inner}</g>`;
}

const gradientDef = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${INDIGO_TOP}"/>
      <stop offset="1" stop-color="${INDIGO_BOTTOM}"/>
    </linearGradient>
  </defs>`;

const bgRect = `<rect width="1024" height="1024" fill="url(#bg)"/>`;

const svgs = {
  // Full icon: gradient bg + glyph.
  full: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${gradientDef}${bgRect}${glyph(GLYPH)}</svg>`,
  // Android adaptive foreground: glyph only, scaled in for the safe zone.
  foreground: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${glyph(GLYPH, 0.78)}</svg>`,
  // Android adaptive background: gradient fill.
  background: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${gradientDef}${bgRect}</svg>`,
  // Android monochrome (themed icons): glyph silhouette, system tints it.
  monochrome: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${glyph(GLYPH, 0.78)}</svg>`,
  // Splash: glyph only on transparent (sits on the #0a0a0a splash bg).
  splash: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${glyph(GLYPH)}</svg>`,
};

const jobs = [
  ['full', 'icon.png', 1024],
  ['foreground', 'android-icon-foreground.png', 1024],
  ['background', 'android-icon-background.png', 1024],
  ['monochrome', 'android-icon-monochrome.png', 1024],
  ['splash', 'splash-icon.png', 512],
  ['full', 'favicon.png', 196],
];

for (const [key, file, size] of jobs) {
  await sharp(Buffer.from(svgs[key])).resize(size, size).png().toFile(join(OUT, file));
  console.log(`✓ ${file} (${size}px)`);
}
console.log('Done.');
