/**
 * Dev helper: report which common "staple" exercises are missing from the
 * curated catalog + extra.json, per equipment. Drives what we backfill.
 *
 *   node scripts/coverage-check.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'assets', 'exercises');
const catalog = JSON.parse(await readFile(join(DIR, 'catalog.json'), 'utf8'));
const extra = JSON.parse(await readFile(join(DIR, 'extra.json'), 'utf8'));
const all = [...catalog, ...extra];

// Index lowercased names per equipment.
const byEq = {};
for (const e of all) (byEq[e.equipment] ??= []).push(e.name.toLowerCase());

// A staple is present if some name in that equipment contains every keyword.
const present = (eq, kws) => (byEq[eq] || []).some((n) => kws.every((k) => n.includes(k)));

// [equipment, label, ...keywords-that-must-all-appear]
const STAPLES = [
  // Squat
  ['Barbell', 'Back Squat', 'squat'], ['Barbell', 'Front Squat', 'front', 'squat'],
  ['Barbell', 'Box Squat', 'box', 'squat'], ['Barbell', 'Overhead Squat', 'overhead', 'squat'],
  ['Dumbbell', 'Goblet Squat', 'goblet'], ['Dumbbell', 'Sumo Squat', 'sumo', 'squat'],
  ['Dumbbell', 'Front Squat', 'front', 'squat'],
  ['Kettlebell', 'Goblet Squat', 'goblet'], ['Kettlebell', 'Sumo Squat', 'sumo', 'squat'],
  ['Kettlebell', 'Front Squat', 'front', 'squat'],
  ['Bodyweight', 'Air Squat', 'squat'], ['Bodyweight', 'Pistol Squat', 'pistol'],
  ['Bodyweight', 'Cossack Squat', 'cossack'], ['Bodyweight', 'Jump Squat', 'jump', 'squat'],
  ['Bodyweight', 'Wall Sit', 'wall sit'], ['Bodyweight', 'Sissy Squat', 'sissy'],
  ['Smith Machine', 'Squat', 'squat'], ['Machine', 'Leg Press', 'leg press'],
  // Hinge / deadlift
  ['Barbell', 'Deadlift', 'deadlift'], ['Barbell', 'Romanian Deadlift', 'romanian'],
  ['Barbell', 'Sumo Deadlift', 'sumo', 'deadlift'], ['Barbell', 'Stiff-Leg Deadlift', 'stiff', 'deadlift'],
  ['Barbell', 'Good Morning', 'good morning'], ['Barbell', 'Rack Pull', 'rack pull'],
  ['Dumbbell', 'Romanian Deadlift', 'romanian'], ['Dumbbell', 'Deadlift', 'deadlift'],
  ['Dumbbell', 'Stiff-Leg Deadlift', 'stiff', 'deadlift'],
  ['Kettlebell', 'Swing', 'swing'], ['Kettlebell', 'Deadlift', 'deadlift'],
  ['Kettlebell', 'Romanian Deadlift', 'romanian'],
  ['Cable', 'Pull-Through', 'pull-through'],
  ['Bodyweight', 'Glute Bridge', 'glute bridge'], ['Bodyweight', 'Hip Thrust', 'hip thrust'],
  ['Bodyweight', 'Back Extension', 'extension'], ['Bodyweight', 'Single-Leg RDL', 'deadlift'],
  // Horizontal press
  ['Barbell', 'Bench Press', 'bench press'], ['Barbell', 'Incline Bench Press', 'incline', 'bench'],
  ['Barbell', 'Decline Bench Press', 'decline', 'bench'], ['Barbell', 'Close-Grip Bench', 'close grip', 'bench'],
  ['Barbell', 'Floor Press', 'floor press'],
  ['Dumbbell', 'Bench Press', 'bench press'], ['Dumbbell', 'Incline Press', 'incline', 'press'],
  ['Dumbbell', 'Decline Press', 'decline', 'press'], ['Dumbbell', 'Floor Press', 'floor press'],
  ['Dumbbell', 'Chest Fly', 'fly'], ['Dumbbell', 'Incline Fly', 'incline', 'fly'],
  ['Machine', 'Chest Press', 'chest press'], ['Machine', 'Incline Chest Press', 'incline', 'chest press'],
  ['Cable', 'Chest Fly', 'fly'], ['Cable', 'Crossover', 'crossover'], ['Cable', 'Chest Press', 'chest press'],
  ['Smith Machine', 'Bench Press', 'bench press'], ['Smith Machine', 'Incline Bench Press', 'incline', 'bench'],
  ['Bodyweight', 'Push-Up', 'push'], ['Bodyweight', 'Incline Push-Up', 'incline', 'push'],
  ['Bodyweight', 'Decline Push-Up', 'decline', 'push'], ['Bodyweight', 'Diamond Push-Up', 'diamond', 'push'],
  ['Bodyweight', 'Pike Push-Up', 'pike', 'push'], ['Bodyweight', 'Archer Push-Up', 'archer', 'push'],
  ['Bodyweight', 'Chest Dip', 'dip'],
  // Vertical press / shoulders
  ['Barbell', 'Overhead Press', 'overhead press'], ['Barbell', 'Push Press', 'push press'],
  ['Dumbbell', 'Shoulder Press', 'shoulder press'], ['Dumbbell', 'Arnold Press', 'arnold'],
  ['Dumbbell', 'Lateral Raise', 'lateral raise'], ['Dumbbell', 'Front Raise', 'front raise'],
  ['Dumbbell', 'Rear Delt Fly', 'rear', 'fly'], ['Dumbbell', 'Upright Row', 'upright row'],
  ['Machine', 'Shoulder Press', 'shoulder press'], ['Machine', 'Lateral Raise', 'lateral raise'],
  ['Cable', 'Lateral Raise', 'lateral raise'], ['Cable', 'Front Raise', 'front raise'],
  ['Cable', 'Rear Delt Fly', 'reverse', 'fly'],
  ['Barbell', 'Upright Row', 'upright row'], ['Smith Machine', 'Shoulder Press', 'shoulder press'],
  ['Bodyweight', 'Handstand Push-Up', 'handstand'],
  // Horizontal pull
  ['Barbell', 'Bent-Over Row', 'row'], ['Barbell', 'Pendlay Row', 'pendlay'], ['Barbell', 'T-Bar Row', 't-bar', 'row'],
  ['Dumbbell', 'One-Arm Row', 'one arm', 'row'], ['Dumbbell', 'Bent-Over Row', 'bent over', 'row'],
  ['Cable', 'Seated Row', 'row'], ['Machine', 'Row', 'row'], ['Bodyweight', 'Inverted Row', 'inverted'],
  ['Smith Machine', 'Row', 'row'],
  // Vertical pull
  ['Bodyweight', 'Pull-Up', 'pull-up'], ['Bodyweight', 'Chin-Up', 'chin-up'],
  ['Bodyweight', 'Wide-Grip Pull-Up', 'wide', 'pull-up'],
  ['Cable', 'Lat Pulldown', 'pulldown'], ['Cable', 'Close-Grip Pulldown', 'close-grip', 'pulldown'],
  ['Cable', 'Straight-Arm Pulldown', 'straight', 'pulldown'],
  ['Machine', 'Lat Pulldown', 'pulldown'], ['Machine', 'Assisted Pull-Up', 'assisted', 'pull'],
  // Biceps
  ['Barbell', 'Curl', 'curl'], ['Barbell', 'Preacher Curl', 'preacher'],
  ['EZ Bar', 'Curl', 'curl'], ['EZ Bar', 'Preacher Curl', 'preacher'], ['EZ Bar', 'Reverse Curl', 'reverse', 'curl'],
  ['Dumbbell', 'Biceps Curl', 'biceps curl'], ['Dumbbell', 'Hammer Curl', 'hammer'],
  ['Dumbbell', 'Incline Curl', 'incline', 'curl'], ['Dumbbell', 'Concentration Curl', 'concentration'],
  ['Dumbbell', 'Preacher Curl', 'preacher'], ['Dumbbell', 'Zottman Curl', 'zottman'],
  ['Cable', 'Curl', 'curl'], ['Cable', 'Hammer Curl', 'hammer'],
  // Triceps
  ['Barbell', 'Skull Crusher', 'skull'], ['Dumbbell', 'Overhead Triceps Extension', 'overhead', 'triceps'],
  ['Dumbbell', 'Triceps Kickback', 'kickback'], ['Cable', 'Triceps Pushdown', 'pushdown'],
  ['Cable', 'Rope Pushdown', 'pushdown'], ['EZ Bar', 'Skull Crusher', 'triceps'],
  ['Bodyweight', 'Triceps Dip', 'dip'], ['Bodyweight', 'Bench Dip', 'bench dip'],
  // Legs iso / accessories
  ['Machine', 'Leg Extension', 'leg extension'], ['Machine', 'Lying Leg Curl', 'lying', 'leg curl'],
  ['Machine', 'Seated Leg Curl', 'seated', 'leg curl'], ['Machine', 'Calf Raise', 'calf raise'],
  ['Machine', 'Hip Abduction', 'abduction'], ['Machine', 'Hip Adduction', 'adduction'],
  ['Dumbbell', 'Walking Lunge', 'walking', 'lunge'], ['Dumbbell', 'Forward Lunge', 'forward', 'lunge'],
  ['Dumbbell', 'Lateral Lunge', 'lateral', 'lunge'], ['Dumbbell', 'Step-Up', 'step'],
  ['Dumbbell', 'Calf Raise', 'calf raise'], ['Dumbbell', 'Goblet Squat', 'goblet'],
  ['Barbell', 'Walking Lunge', 'walking', 'lunge'], ['Barbell', 'Lunge', 'lunge'],
  ['Barbell', 'Calf Raise', 'calf raise'], ['Barbell', 'Glute Bridge', 'glute bridge'],
  ['Bodyweight', 'Lunge', 'lunge'], ['Bodyweight', 'Step-Up', 'step'],
  ['Bodyweight', 'Calf Raise', 'calf raise'], ['Bodyweight', 'Nordic Curl', 'nordic'],
  // Core
  ['Bodyweight', 'Plank', 'plank'], ['Bodyweight', 'Side Plank', 'side plank'],
  ['Bodyweight', 'Hanging Leg Raise', 'hanging leg raise'], ['Bodyweight', 'Russian Twist', 'russian twist'],
  ['Bodyweight', 'Bicycle Crunch', 'bicycle'], ['Bodyweight', 'Crunch', 'crunch'],
  ['Bodyweight', 'Sit-Up', 'sit-up'], ['Bodyweight', 'Mountain Climber', 'mountain climber'],
  ['Bodyweight', 'Dead Bug', 'dead bug'], ['Bodyweight', 'V-Up', 'v-up'],
  ['Bodyweight', 'Leg Raise', 'leg raise'], ['Bodyweight', 'Flutter Kick', 'flutter'],
  // Olympic / power / kb
  ['Barbell', 'Power Clean', 'power clean'], ['Barbell', 'Clean', 'clean'],
  ['Barbell', 'Snatch', 'snatch'], ['Barbell', 'Hang Clean', 'hang clean'],
  ['Kettlebell', 'Clean', 'clean'], ['Kettlebell', 'Snatch', 'snatch'],
  ['Kettlebell', 'Clean and Press', 'clean', 'press'], ['Kettlebell', 'Turkish Get-Up', 'turkish'],
  ['Dumbbell', 'Snatch', 'snatch'],
  // Carry / conditioning
  ['Dumbbell', "Farmer's Carry", 'farmer'], ['Bodyweight', 'Burpee', 'burpee'],
  ['Bodyweight', 'Box Jump', 'box jump'], ['Bodyweight', 'Bear Crawl', 'bear crawl'],
  ['Bodyweight', 'High Knees', 'high knee'],
];

const missing = STAPLES.filter(([eq, , ...kws]) => !present(eq, kws));
console.log(`Checked ${STAPLES.length} staples — missing ${missing.length}:\n`);
const grp = {};
for (const [eq, label] of missing) (grp[eq] ??= []).push(label);
for (const [eq, labels] of Object.entries(grp)) {
  console.log(`[${eq}] (${labels.length})`);
  labels.forEach((l) => console.log('   -', l));
}
