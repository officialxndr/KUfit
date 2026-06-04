/**
 * Rough App Store product-page mockup, composed from the real assets (icon, the
 * resized 6.9" screenshots) + the listing copy — just to sanity-check how it reads.
 * Not an exact App Store render; Apple has no true pre-publish preview.
 *   node scripts/appstore-mockup.mjs
 */
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const W = 1206, H = 1320;
const NAME = 'Hale';
const SUBTITLE = 'Private food, workouts & body';
const DEVELOPER = 'Zander Halverson';

const roundedMask = (w, h, r) =>
  Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
const rounded = (input, w, h, r) =>
  sharp(input).resize(w, h, { fit: 'cover' })
    .composite([{ input: roundedMask(w, h, r), blend: 'dest-in' }]).png().toBuffer();

// App icon
const ICON = 230;
const icon = await rounded('assets/images/icon.png', ICON, ICON, Math.round(ICON * 0.225));

// First 3 screenshots
const shotDir = 'screenshots/appstore-6.9';
const shots = readdirSync(shotDir).filter((f) => /\.png$/i.test(f)).sort().slice(0, 3);
const SW = 344, SH = Math.round(SW * 2868 / 1320), SGAP = 27, SY = 470;
const shotBufs = [];
for (const s of shots) shotBufs.push(await rounded(join(shotDir, s), SW, SH, 26));

// Text + chrome (renders with the system's default sans fallback)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="315" y="118" font-size="60" font-weight="700" fill="#111111">${esc(NAME)}</text>
  <text x="318" y="172" font-size="30" fill="#8a8a8e">${esc(SUBTITLE)}</text>
  <text x="318" y="214" font-size="26" fill="#3478f6">${esc(DEVELOPER)}</text>
  <rect x="318" y="244" width="150" height="60" rx="30" fill="#3478f6"/>
  <text x="393" y="284" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle">GET</text>
  <text x="${W - 60}" y="284" font-size="24" fill="#8a8a8e" text-anchor="end">In-App Purchases: None</text>
  <line x1="55" y1="360" x2="${W - 55}" y2="360" stroke="#e5e5ea" stroke-width="2"/>
  <text x="55" y="430" font-size="34" font-weight="700" fill="#111111">Preview</text>
</svg>`);

const composites = [{ input: icon, left: 55, top: 70 }, { input: overlay, left: 0, top: 0 }];
let x = 55;
for (const b of shotBufs) { composites.push({ input: b, left: x, top: SY }); x += SW + SGAP; }

await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } })
  .composite(composites).png().toFile('screenshots/appstore-mockup.png');
console.log('Wrote screenshots/appstore-mockup.png');
