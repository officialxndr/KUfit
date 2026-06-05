// Generates per-accent iOS app icons by compositing the white Hale logo (the Android
// adaptive-icon foreground) over each accent's solid background. iOS alternate icons must be
// fully opaque (no alpha), so we flatten onto the accent color.
//
//   node scripts/gen-accent-icons.mjs
//
// Output: assets/icons/accent-<key>.png (1024×1024). Re-run if the logo or accents change.
// The default "indigo" accent keeps the polished brand icon (assets/images/icon.png), so it's
// intentionally not generated here.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FG = path.join(root, 'assets/images/android-icon-foreground.png');
const OUT_DIR = path.join(root, 'assets/icons');

// Mirror ACCENT_PRESETS in src/theme/tokens.ts (minus indigo = default brand icon).
const ACCENTS = {
  violet: '#8b5cf6',
  sky: '#0ea5e9',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const fg = PNG.sync.read(fs.readFileSync(FG));
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [key, color] of Object.entries(ACCENTS)) {
  const [br, bg, bb] = hex(color);
  const out = new PNG({ width: fg.width, height: fg.height });
  for (let i = 0; i < fg.width * fg.height; i++) {
    const o = i * 4;
    const a = fg.data[o + 3] / 255; // logo alpha
    out.data[o] = Math.round(fg.data[o] * a + br * (1 - a));
    out.data[o + 1] = Math.round(fg.data[o + 1] * a + bg * (1 - a));
    out.data[o + 2] = Math.round(fg.data[o + 2] * a + bb * (1 - a));
    out.data[o + 3] = 255; // opaque — required for iOS icons
  }
  const file = path.join(OUT_DIR, `accent-${key}.png`);
  fs.writeFileSync(file, PNG.sync.write(out));
  console.log('wrote', path.relative(root, file));
}
console.log('done');
