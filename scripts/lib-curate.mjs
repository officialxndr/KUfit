/**
 * Curate the raw ExerciseDB catalog into a clean, generalized library.
 *
 * ExerciseDB ships ~1500 entries riddled with noise: surface gimmicks
 * ("…on Exercise Ball"), cosmetic dupes ("(male)", "- Lateral Variation", "V. 2"),
 * mislabeled equipment (the "Sled" family is really the leg-press machine; many
 * "Rope"/"Assisted" rows are actually stretches), encoding mojibake ("45в°"), and
 * outright junk ("Otis Up", "…with Throw Down"). `curate()` applies, in order:
 *
 *   1. fix-ups   — mojibake + common typos
 *   2. reclassify — repair wrong equipment facets (Sled→Machine, stretch tools→Bodyweight)
 *   3. drop       — whole families we don't want (balls/wheel/cardio machines) + name denylist
 *   4. generalize — strip cosmetic/surface tags from names (the "Balanced" policy)
 *   5. dedupe     — collapse the now-identical names, keeping the best-sourced row
 *
 * Generalization is a *rename in place* (the seed upserts by exerciseDbId, so GIFs +
 * user history survive). Dedupe keeps one representative per (name|equipment),
 * preferring a row with a GIF + instructions so we never lose the animation.
 *
 * "Balanced": keep standard named variations (incline/decline, close/wide grip,
 * hammer, sumo, RDL, front/back squat, Bulgarian, preacher, concentration,
 * seated/standing) — only surface/cosmetic noise is stripped.
 */

// ── 1. fix-ups ──────────────────────────────────────────────────────────────
const FIXUPS = [
  [/в°/g, '°'],            // utf-8 mojibake for the degree sign
  [/Â°/g, '°'],
  [/\bв\b/g, ''],
  [/\bSitted\b/gi, 'Seated'],
  [/\bSquad\b/g, 'Squat'],
  [/\bRollerer\b/gi, 'Roller'],
  [/\bDepresor\b/gi, 'Depressor'],
  [/\bRevers\b/g, 'Reverse'],
  [/\bFlyes\b/gi, 'Fly'],
  [/\bFlies\b/gi, 'Fly'],
  [/\bTwisted\b/gi, 'Twist'],
  [/\bSingle[- ]Arm\b/gi, 'One Arm'],
  [/\bSingle[- ]Leg\b/gi, 'One Leg'],
  [/\bBicep\b/g, 'Biceps'],          // singular → plural (won't touch "Biceps")
  [/\bTricep\b/g, 'Triceps'],
  [/\b(Close|Wide|Reverse|Neutral|Narrow|Mixed)-Grip\b/gi, '$1 Grip'],
];

// ── 2. reclassify equipment ─────────────────────────────────────────────────
// The "Sled" facet is the 45° leg-press / hack machine; "Lever" in a name is a
// leverage machine. Stretches carry junk equipment facets — normalize to Bodyweight.
const EQUIP_RECLASS = { Sled: 'Machine', Hammer: 'Machine' };
const STRETCH_EQUIP_TO_BODYWEIGHT = new Set(['Rope', 'Assisted', 'Roller', 'Weighted', 'Stability Ball']);

// ── 3. drops ────────────────────────────────────────────────────────────────
const DROP_EQUIPMENT = new Set([
  'Stability Ball', 'Medicine Ball', 'BOSU Ball', 'Ab Wheel', 'Roller',
  'Elliptical', 'SkiErg', 'Stationary Bike', 'Stepmill', 'Upper Body Ergometer',
]);
// Outright junk / non-trackable, regardless of equipment.
const DROP_NAME = [
  /throw\s*down/i,
  /\botis up\b/i,
  /london bridge/i,
  /sledge hammer/i,
  /wrist roller/i,
  /body saw/i,
  /^exercise ball/i,      // the ball *is* the exercise (and the family is dropped)
];

// ── 4. generalize (name strips, applied in order) ───────────────────────────
// Style/marketing adjectives ExerciseDB sprinkles in, removed anywhere.
const FLUFF = /\b(?:fierce|macro style|sharp style|gentle style|hyght|controlled|powerful|blunt|intensive|intermediate|advanced|athletic style|self[- ]?assisted|dynamic|explosive|improved|classic|focused|isolation|style)\b/gi;
// Surface/cosmetic versions, removed anywhere (not just trailing).
const VERSION = /\s+(?:v\.?\s*\d+|version\s*\d+)\b/gi;
// ExerciseDB parentheticals are essentially always noise (grip lives inline).
const STRIP_PARENS = /\s*\([^)]*\)/g;
// The "ball" surface gimmick in any phrasing ("on/with/over … exercise/stability/swiss ball").
const ON_BALL = /\s*(?:\b(?:on|with|over|using|onto)\b\s+)?(?:an?\s+|the\s+)?(?:exercise|stability|swiss|bosu)\s+ball/gi;
const DASH_VARIATION = /\s*-\s*[\w\s/]*\bvariation\b\s*$/i;
const TRAILING_JUNK = /\s+(?:horizontal|resistance|pointed|wide pov|reps)\s*$/i;
// Dangling connectors/fragments left after a strip ("…Triceps Extension with" → "…Triceps Extension").
const TRAILING_DANGLE = /\s+(?:with|over|to|and|the|of|for|a|an|on|double|bent)\s*$/i;
const LEVER_PREFIX = /^lever\s+/i;
const SLED_PREFIX = /^sled\s*(?:45\s*(?:degrees|°)\s*)?/i;

function generalizeName(name) {
  let n = name;
  n = n.replace(ON_BALL, '');
  n = n.replace(STRIP_PARENS, '');
  n = n.replace(VERSION, '');
  n = n.replace(DASH_VARIATION, '');
  n = n.replace(FLUFF, '');
  n = n.replace(TRAILING_JUNK, '');
  // "Lever Chest Press" → "Machine Chest Press"; "Sled 45° Leg Press" → "Leg Press".
  if (LEVER_PREFIX.test(n)) n = n.replace(LEVER_PREFIX, 'Machine ');
  n = n.replace(SLED_PREFIX, '');
  n = tidy(n);
  while (TRAILING_DANGLE.test(n)) n = tidy(n.replace(TRAILING_DANGLE, ''));
  return n;
}

function tidy(name) {
  return name
    .replace(/\s*\(\s*\)/g, ' ')        // emptied parens
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim();
}

function applyFixups(name) {
  let n = name;
  for (const [re, to] of FIXUPS) n = n.replace(re, to);
  return n;
}

// ── 5. dedupe ranking ───────────────────────────────────────────────────────
const key = (e) => `${e.name}|${e.equipment ?? ''}`.toLowerCase();
const instrLen = (e) => (Array.isArray(e.instructions) ? e.instructions.join(' ').length : 0);
// Lower = better (kept). Prefer a GIF, then instructions, then STRENGTH, then a
// shorter (more canonical) name, then a stable id.
function rank(e) {
  return [e.gifUrl ? 0 : 1, instrLen(e) > 0 ? 0 : 1, e.category === 'STRENGTH' ? 0 : 1, e.name.length];
}
function better(a, b) {
  const ra = rank(a), rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? a : b;
  return a.exerciseDbId <= b.exerciseDbId ? a : b;
}

export function curate(list) {
  const report = { input: list.length, droppedEquip: 0, droppedName: 0, reclassified: 0, renamed: 0, deduped: 0 };

  // 1 + 2 + 3 (fix-ups, reclassify, drop)
  const kept = [];
  for (const raw of list) {
    const e = { ...raw, name: applyFixups(raw.name) };

    if (DROP_EQUIPMENT.has(e.equipment)) { report.droppedEquip++; continue; }
    if (DROP_NAME.some((re) => re.test(e.name))) { report.droppedName++; continue; }

    let equipment = e.equipment;
    if (EQUIP_RECLASS[equipment]) { equipment = EQUIP_RECLASS[equipment]; report.reclassified++; }
    if (e.category === 'STRETCHING' && STRETCH_EQUIP_TO_BODYWEIGHT.has(equipment)) {
      equipment = 'Bodyweight'; report.reclassified++;
    }
    kept.push({ ...e, equipment });
  }

  // 4 (generalize names)
  const renamed = kept.map((e) => {
    const g = generalizeName(e.name);
    // Guard against a strip that ate the name down to just an equipment word; fall
    // back to a parens-stripped original (never the raw "(equipment)" leftover).
    const core = g.replace(/^(?:dumbbell|barbell|cable|machine|band|kettlebell|smith|ez bar|weighted|assisted)\s*/i, '').trim();
    const name = g && core.length >= 2 ? g : (tidy(applyFixups(e.name).replace(STRIP_PARENS, '')) || e.name);
    if (name !== e.name) report.renamed++;
    return { ...e, name };
  });

  // 5 (dedupe by name|equipment, keep best)
  const byKey = new Map();
  for (const e of renamed) {
    const k = key(e);
    const cur = byKey.get(k);
    if (!cur) byKey.set(k, e);
    else { byKey.set(k, better(cur, e)); report.deduped++; }
  }

  const out = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  report.output = out.length;
  return { list: out, report };
}
