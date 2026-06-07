#!/usr/bin/env node
/**
 * Seed the bundled exercise catalog from the open-source ExerciseDB
 * (https://oss.exercisedb.dev) — free, no API key, public GIF CDN.
 *
 * Run on your dev machine (NOT at app runtime):
 *
 *   node scripts/seed-exercises.mjs              # write catalog.json (GIFs stay remote, cached on device on first view)
 *   node scripts/seed-exercises.mjs --download   # also download every GIF and bundle it for full offline use
 *
 * Output:
 *   assets/exercises/catalog.json     — exercise metadata (always)
 *   assets/exercises/gifs/<id>.gif    — GIFs (only with --download)
 *   assets/exercises/gifMap.ts        — id → require() map (only with --download)
 *
 * The catalog is imported into SQLite on first app launch (src/lib/exerciseSeed.ts).
 * GIFs are public CDN URLs (no key), so the app can also lazily cache them to the
 * device filesystem on first view — bundling via --download is optional and only
 * needed if you want a fully offline library out of the box (larger app binary).
 *
 * PAGINATION: the list endpoint is cursor-paged via `after=<nextCursor>` (NOT the
 * `cursor`/`offset`/`page`/`limit` params, which the API silently ignores — those return
 * only the first 25 rows, which is what made an earlier version top out at ~437 via a
 * filter fan-out). Walking `after` exposes the full ~1500 with GIFs. Page size is fixed
 * at 25, so expect ~60 requests; the source rate-limits (429), so we pace + back off.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { debake } from './lib-debake.mjs';
import { curate } from './lib-curate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets', 'exercises');
const GIF_DIR = join(OUT_DIR, 'gifs');
const CATALOG = join(OUT_DIR, 'catalog.json');
const GIF_MAP = join(OUT_DIR, 'gifMap.ts');

const BASE = 'https://oss.exercisedb.dev/api/v1';
const DOWNLOAD = process.argv.includes('--download');
const UA = 'Hale-seed/2.0';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true).catch(() => false);

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && attempt <= 4) {
    const wait = 5000 * attempt;
    console.log(`Rate limited, waiting ${wait / 1000}s…`);
    await sleep(wait);
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── Cleanup helpers ───────────────────────────────────────────────────────────

const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'up', 'vs', 'with']);
// Tokens (lowercased, punctuation-stripped) that should render as fixed forms.
const FIXED_TOKENS = {
  db: 'DB', ez: 'EZ', rdl: 'RDL', ohp: 'OHP', bb: 'BB', kb: 'KB',
  'v-bar': 'V-Bar', 'v-handle': 'V-Handle', 'd-handle': 'D-Handle',
  bosu: 'BOSU', iso: 'Iso', ii: 'II', iii: 'III', iv: 'IV',
};

function titleCase(raw) {
  if (!raw) return raw;
  const words = raw.trim().split(/\s+/);
  return words
    .map((w, i) => {
      const bare = w.replace(/[(),.]/g, '');
      const key = bare.toLowerCase();
      if (FIXED_TOKENS[key]) return w.replace(bare, FIXED_TOKENS[key]);
      // Keep minor words lowercase unless first/last.
      if (i !== 0 && i !== words.length - 1 && MINOR_WORDS.has(key)) return w.toLowerCase();
      // Title-case hyphenated parts ("cross-over" → "Cross-Over").
      return w
        .split('-')
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
        .join('-');
    })
    .join(' ');
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);

// Normalize the source's 28 messy equipment strings into a tidy, consistent facet.
const EQUIPMENT_MAP = {
  'body weight': 'Bodyweight',
  weighted: 'Weighted',
  assisted: 'Assisted',
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  'ez barbell': 'EZ Bar',
  'olympic barbell': 'Barbell',
  'trap bar': 'Trap Bar',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  band: 'Band',
  'resistance band': 'Band',
  'leverage machine': 'Machine',
  'smith machine': 'Smith Machine',
  'sled machine': 'Sled',
  'stability ball': 'Stability Ball',
  'bosu ball': 'BOSU Ball',
  'medicine ball': 'Medicine Ball',
  rope: 'Rope',
  roller: 'Roller',
  'wheel roller': 'Ab Wheel',
  hammer: 'Hammer',
  tire: 'Tire',
  'elliptical machine': 'Elliptical',
  'stationary bike': 'Stationary Bike',
  'stepmill machine': 'Stepmill',
  'skierg machine': 'SkiErg',
  'upper body ergometer': 'Upper Body Ergometer',
};
function normalizeEquipment(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return EQUIPMENT_MAP[key] ?? titleCase(raw);
}

// Cardio machines: even though the source tags a body part, these are cardio by nature.
const CARDIO_EQUIPMENT = new Set([
  'Elliptical', 'Stationary Bike', 'Stepmill', 'SkiErg', 'Upper Body Ergometer',
]);
function inferCategory(bodyPart, equipment, name) {
  const n = (name || '').toLowerCase();
  if ((bodyPart || '').toLowerCase() === 'cardio') return 'CARDIO';
  if (equipment && CARDIO_EQUIPMENT.has(equipment)) return 'CARDIO';
  if (/\bstretch\b|\bstretches\b/.test(n)) return 'STRETCHING';
  return 'STRENGTH';
}

// Known cable/handle attachments. Used to *extract* the attachment baked into a source
// name into structured metadata (the app lets you pick the attachment at log time and
// tracks each one as its own progress line — so the name shouldn't bury it).
const ATTACHMENTS = [
  { canon: 'Rope', re: /\b(rope)\b/i },
  { canon: 'V-Bar', re: /\bv[-\s]?bar\b/i },
  { canon: 'Straight Bar', re: /\bstraight\s*bar\b/i },
  { canon: 'EZ Bar', re: /\bez[-\s]?bar\b/i },
  { canon: 'Lat Bar', re: /\b(pro\s*lat\s*bar|lat\s*bar|lat\s*pulldown\s*bar|wide\s*grip\s*bar)\b/i },
  { canon: 'D-Handle', re: /\bd[-\s]?handle\b/i },
  { canon: 'Stirrup Handle', re: /\bstirrup\b/i },
  { canon: 'Single Handle', re: /\b(single\s*handle|single\s*grip)\b/i },
  { canon: 'Dual Handle', re: /\b(dual\s*handle|double\s*handle)\b/i },
  { canon: 'Ankle Strap', re: /\bankle\s*strap\b/i },
];

/** Pull the first recognized attachment token from a name (or null). Non-destructive. */
function detectAttachment(name) {
  for (const a of ATTACHMENTS) if (a.re.test(name)) return a.canon;
  return null;
}

function cleanInstructions(list) {
  return (list ?? [])
    .map((s) => s.replace(/^Step:\s*\d+\s*/i, '').trim())
    .filter(Boolean);
}

function normalize(ex) {
  const name = titleCase(ex.name);
  const equipment = normalizeEquipment(ex.equipments?.[0]);
  const bodyPart = ex.bodyParts?.[0] ?? null;
  return {
    exerciseDbId: ex.exerciseId,
    name,
    muscleGroup: cap(bodyPart),
    equipment,
    category: inferCategory(bodyPart, equipment, ex.name),
    musclesPrimary: (ex.targetMuscles ?? []).map(cap),
    musclesSecondary: (ex.secondaryMuscles ?? []).map(cap),
    description: null,
    instructions: cleanInstructions(ex.instructions),
    tips: [],
    attachment: detectAttachment(ex.name),
    gifUrl: ex.gifUrl ?? null,
  };
}

// ── Fetch ───────────────────────────────────────────────────────────────────

/** Walk the whole list via `after=<nextCursor>`, deduping by exerciseId. */
async function fetchAll() {
  const seen = new Map();
  const usedCursors = new Set();
  let after = null;
  let page = 0;
  while (true) {
    const url = `${BASE}/exercises?${after ? `after=${encodeURIComponent(after)}` : ''}`;
    const body = await fetchJson(url);
    for (const ex of body.data ?? []) {
      if (ex.exerciseId && !seen.has(ex.exerciseId)) seen.set(ex.exerciseId, normalize(ex));
    }
    page += 1;
    process.stdout.write(`\r  page ${page}: ${seen.size} unique`);
    const next = body.meta?.hasNextPage ? body.meta.nextCursor : null;
    if (!next || usedCursors.has(next)) break; // end of list (or a stuck cursor — safety)
    usedCursors.add(next);
    after = next;
    await sleep(300); // pace to avoid the source's 429 rate limit
  }
  process.stdout.write('\n');
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadGif(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`gif HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('Fetching exercises from oss.exercisedb.dev …');
  const all = await fetchAll();
  console.log(`Got ${all.length} exercises.`);
  const { list: debaked, changed } = debake(all);
  console.log(`De-baked ${changed} attachment-bearing names.`);
  const { list: cleaned, report } = curate(debaked);
  console.log(`Curated: ${report.input} → ${report.output} (dropped ${report.droppedEquip + report.droppedName}, renamed ${report.renamed}, deduped ${report.deduped}).`);
  await writeFile(CATALOG, JSON.stringify(cleaned, null, 2));
  console.log(`Wrote ${CATALOG}`);

  if (DOWNLOAD) {
    await mkdir(GIF_DIR, { recursive: true });
    const mapEntries = [];
    let done = 0;
    for (const ex of all) {
      const dest = join(GIF_DIR, `${ex.exerciseDbId}.gif`);
      if (ex.gifUrl && !(await exists(dest))) {
        try {
          await downloadGif(ex.gifUrl, dest);
          await sleep(80);
        } catch (e) {
          console.warn(`\n  gif fail ${ex.exerciseDbId}: ${e.message}`);
        }
      }
      if (await exists(dest)) {
        mapEntries.push(`  '${ex.exerciseDbId}': require('./gifs/${ex.exerciseDbId}.gif'),`);
      }
      if (++done % 100 === 0) process.stdout.write(`\r  downloaded ${done}/${all.length}`);
    }
    process.stdout.write('\n');
    const ts = `/* AUTO-GENERATED by scripts/seed-exercises.mjs */\nexport const GIF_MAP: Record<string, number> = {\n${mapEntries.join('\n')}\n};\n`;
    await writeFile(GIF_MAP, ts);
    console.log(`Wrote ${GIF_MAP} (${mapEntries.length} bundled GIFs)`);
  } else {
    console.log('Skipped GIF download (run with --download to bundle GIFs offline).');
  }
  console.log('Done. Catalog imports into SQLite on first app launch.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
