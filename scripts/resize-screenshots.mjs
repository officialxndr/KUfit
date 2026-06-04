/**
 * Resize iPhone screenshots to an exact App Store Connect size.
 *
 * All modern iPhones share the same ~19.5:9 aspect ratio, so a screenshot from a
 * smaller device (e.g. iPhone 17 Pro, 1206×2622) scales up to the required 6.9"
 * size (1320×2868) with no visible distortion. ASC only checks the final pixel
 * dimensions. Originals are left untouched; output goes to <dir>/appstore-6.9.
 *
 *   node scripts/resize-screenshots.mjs [inputDir]   # default inputDir = screenshots
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// App Store Connect iPhone slots. The 6.9" set is the only one Apple requires (it
// auto-fills smaller sizes), but ASC still offers a separate 6.5" box, so we emit both.
const TARGETS = [
  { dir: 'appstore-6.9', w: 1320, h: 2868, slot: '6.9"' }, // iPhone 16/17 Pro Max — required
  { dir: 'appstore-6.5', w: 1284, h: 2778, slot: '6.5"' }, // iPhone 6.5" slot
];

const inDir = process.argv[2] ?? 'screenshots';
const files = readdirSync(inDir)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort(); // preserve capture order (IMG_#### sorts chronologically)

if (files.length === 0) { console.error(`No images in ./${inDir}`); process.exit(1); }

for (const { dir, w, h, slot } of TARGETS) {
  const outDir = join(inDir, dir);
  mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    const out = f.replace(/\.\w+$/, '.png');
    await sharp(join(inDir, f))
      .resize(w, h, { fit: 'fill' })       // exact dims; the sub-1% stretch is imperceptible
      .flatten({ background: '#000000' })  // drop any alpha (ASC wants opaque screenshots)
      .png()
      .toFile(join(outDir, out));
  }
  console.log(`✓ ${files.length} file(s) → ${outDir}/  (${w}×${h}, ${slot} slot)`);
}
