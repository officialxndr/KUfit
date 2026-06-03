import { db } from '@/lib/db';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Profile } from '@/stores/settingsStore';

/**
 * Sample-data seeder for the hidden Developer tools — fills ~10 weeks of realistic
 * food logs, weigh-ins, measurements and progressive-overload workouts so every
 * screen looks alive (for the feature tour and App Store screenshots). Idempotent:
 * `loadDemoData` clears logged data first, and demo foods dedupe by a synthetic
 * `demo:` barcode. Not shown to normal users.
 */

const DAY_MS = 86_400_000;
const SPAN = 70; // days of history
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dateAgo = (d: number) => iso(new Date(Date.now() - d * DAY_MS));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const r1 = (n: number) => Math.round(n * 10) / 10;

// Demo meals are built from the **enriched base foods** (per 100 g, barcode
// `base:<slug>`) so each logged item carries the full Open-Food-Facts-style detail
// — extended micronutrients, Nutri-Score, NOVA group and allergen badges — exactly
// like a scanned product. `key → base slug`:
const BASE_SLUGS: Record<string, string> = {
  oats: 'oats', egg: 'egg', banana: 'banana', greekYogurt: 'greek-yogurt', pb: 'peanut-butter',
  apple: 'apple', bread: 'whole-wheat-bread', chicken: 'chicken-breast', rice: 'white-rice',
  brownrice: 'brown-rice', broccoli: 'broccoli', salmon: 'salmon', sweetpotato: 'sweet-potato',
  spinach: 'spinach', lettuce: 'lettuce', beef: 'ground-beef-90-10', oil: 'olive-oil', almonds: 'almonds',
};

// One branded, processed item to also show the additive / label / nutrient-level
// badges that whole foods (all Nutri-Score A, NOVA 1) don't carry.
const SHAKE = {
  name: 'Whey Protein Shake', brand: 'Demo Nutrition', barcode: 'demo:whey-shake',
  servingSize: 30, servingUnit: 'g', calories: 120, protein: 24, carbs: 3, fat: 1.5,
  fiber: 1, sugar: 2, sodium: 80, saturatedFat: 0.5,
  details: {
    nutriments: [{ key: 'potassium', value: 0.22 }, { key: 'calcium', value: 0.12 }, { key: 'iron', value: 0.004 }],
    nutriScore: 'b', novaGroup: 4, ecoScore: 'c',
    nutrientLevels: { fat: 'low', 'saturated-fat': 'low', sugars: 'low', salt: 'moderate' } as Record<string, 'low' | 'moderate' | 'high'>,
    ingredientsText: 'Whey protein concentrate, cocoa powder, natural flavor, sunflower lecithin, stevia leaf extract.',
    allergens: ['en:milk'], additives: ['en:e322'], labels: ['en:high-protein', 'en:no-added-sugar'],
  },
};

// Meal templates as { key, grams }. `key` is a BASE_SLUGS key, or 'shake'.
type MealItems = { key: string; g: number }[];
const BREAKFASTS: MealItems[] = [
  [{ key: 'oats', g: 80 }, { key: 'egg', g: 100 }, { key: 'banana', g: 120 }],
  [{ key: 'greekYogurt', g: 170 }, { key: 'pb', g: 32 }, { key: 'apple', g: 180 }],
  [{ key: 'egg', g: 150 }, { key: 'bread', g: 56 }, { key: 'banana', g: 120 }],
];
const LUNCHES: MealItems[] = [
  [{ key: 'chicken', g: 150 }, { key: 'rice', g: 180 }, { key: 'broccoli', g: 100 }],
  [{ key: 'salmon', g: 150 }, { key: 'sweetpotato', g: 150 }, { key: 'spinach', g: 60 }],
  [{ key: 'beef', g: 150 }, { key: 'brownrice', g: 180 }, { key: 'broccoli', g: 100 }],
];
const DINNERS: MealItems[] = [
  [{ key: 'salmon', g: 150 }, { key: 'rice', g: 180 }, { key: 'lettuce', g: 80 }, { key: 'oil', g: 14 }],
  [{ key: 'chicken', g: 200 }, { key: 'sweetpotato', g: 150 }, { key: 'broccoli', g: 120 }],
  [{ key: 'beef', g: 170 }, { key: 'rice', g: 180 }, { key: 'spinach', g: 60 }, { key: 'oil', g: 14 }],
];
const SNACKS: MealItems[] = [
  [{ key: 'shake', g: 30 }], [{ key: 'almonds', g: 28 }], [{ key: 'apple', g: 180 }, { key: 'pb', g: 32 }], [{ key: 'greekYogurt', g: 170 }],
];

// Workout splits: [name-key, base kg (0 = bodyweight), sets, reps]. Exercises are
// matched loosely by name against the seeded catalog; missing ones are skipped.
const SPLITS: { name: string; lifts: [string, number, number, number][] }[] = [
  { name: 'Push Day', lifts: [['bench press', 60, 4, 8], ['overhead press', 35, 4, 8], ['lateral raise', 8, 3, 15], ['triceps', 25, 3, 12]] },
  { name: 'Pull Day', lifts: [['deadlift', 100, 3, 5], ['row', 62, 4, 8], ['lat pulldown', 50, 3, 10], ['curl', 15, 3, 12]] },
  { name: 'Leg Day', lifts: [['squat', 80, 4, 6], ['leg press', 150, 3, 10], ['leg curl', 40, 3, 12], ['calf raise', 60, 3, 15]] },
];

// Profile fields the demo fills in **only when unset** so the target-driven visuals
// (calorie ring, macro bars — they need weight + height + sex + birth date to resolve a
// calorie/macro target) look complete, plus a goal/training target for Reports. Listed so
// the tour preview can snapshot and restore exactly these. `goalType` is left alone
// (MAINTAIN default already yields a TDEE-based target).
export const DEMO_PROFILE_KEYS = ['heightCm', 'sex', 'birthDate', 'goalWeightKg', 'weeklySessionTarget'] as const;
const DEMO_PROFILE_DEFAULTS: Pick<Profile, (typeof DEMO_PROFILE_KEYS)[number]> = {
  heightCm: 178,
  sex: 'MALE',
  birthDate: '1994-01-01', // ~30 yrs → drives BMR/TDEE so the calorie target resolves
  goalWeightKg: 78,
  weeklySessionTarget: 4,
};

export function clearLoggedData(): void {
  db.withTransactionSync(() => {
    foodRepo.clearAllLogs();
    workoutRepo.clearAllSessions();
    healthRepo.clearAllWeightEntries();
    healthRepo.clearAllMeasurements();
  });
}

export function loadDemoData(): void {
  clearLoggedData();

  // Fill in demographics + a goal/training target only where the user hasn't set them
  // (so the calorie ring, macro bars and Reports look complete) — never overwrite real
  // values. Without height/sex/birth date, `resolveTargets` can't compute a calorie
  // target and those visuals render empty ("No goal set").
  const { profile, setProfile } = useSettingsStore.getState();
  const patch: Partial<Profile> = {};
  for (const k of DEMO_PROFILE_KEYS) {
    if (profile[k] == null) (patch as Record<string, unknown>)[k] = DEMO_PROFILE_DEFAULTS[k];
  }
  if (Object.keys(patch).length) setProfile(patch);

  db.withTransactionSync(() => {
    // Resolve key → { localId, servingSize }: enriched base foods (by `base:` barcode,
    // carrying full OFF-style details) + the one branded shake (upserted with details).
    const foods: Record<string, { localId: string; servingSize: number }> = {};
    for (const [key, slug] of Object.entries(BASE_SLUGS)) {
      const item = foodRepo.getFoodItemByBarcode(`base:${slug}`);
      if (item) foods[key] = { localId: item.id, servingSize: item.servingSize || 100 };
    }
    foods.shake = {
      localId: foodRepo.upsertFoodItem({
        name: SHAKE.name, brand: SHAKE.brand, barcode: SHAKE.barcode, servingSize: SHAKE.servingSize,
        servingUnit: SHAKE.servingUnit, calories: SHAKE.calories, protein: SHAKE.protein, carbs: SHAKE.carbs,
        fat: SHAKE.fat, fiber: SHAKE.fiber, sugar: SHAKE.sugar, sodium: SHAKE.sodium, saturatedFat: SHAKE.saturatedFat,
        source: 'OPEN_FOOD_FACTS', isCustom: false, details: SHAKE.details,
      }),
      servingSize: SHAKE.servingSize,
    };
    const logMeal = (date: string, meal: string, items: MealItems) => {
      for (const it of items) {
        const f = foods[it.key];
        if (!f) continue;
        foodRepo.addLog({ date, meal, foodItemLocalId: f.localId, servingQty: Math.round((it.g / f.servingSize) * 100) / 100 });
      }
    };
    for (let d = SPAN; d >= 0; d--) {
      // Skip a few days (more in the distant past) for realistic adherence.
      if (Math.random() < (d > 40 ? 0.22 : 0.08)) continue;
      const date = dateAgo(d);
      logMeal(date, 'BREAKFAST', pick(BREAKFASTS));
      logMeal(date, 'LUNCH', pick(LUNCHES));
      logMeal(date, 'DINNER', pick(DINNERS));
      if (Math.random() < 0.8) logMeal(date, 'SNACK', pick(SNACKS));
    }

    // Weight trend: ~84 → ~79.5 kg over the span, with daily noise + weekly body-fat.
    for (let d = SPAN; d >= 0; d--) {
      if (Math.random() < 0.18) continue;
      const t = (SPAN - d) / SPAN; // 0 (oldest) → 1 (today)
      const base = 84 - 4.5 * t;
      const bf = d % 7 === 0 ? r1(18 - 3 * t) : undefined;
      healthRepo.upsertWeightEntry(dateAgo(d), r1(base + rand(-0.35, 0.35)), bf);
    }

    // Body measurements every ~2 weeks (waist trends down).
    for (let d = SPAN; d >= 0; d -= 14) {
      const t = (SPAN - d) / SPAN;
      healthRepo.addMeasurement({
        date: dateAgo(d), neck: 38, chest: r1(102 - 2 * t), waist: r1(89 - 5 * t),
        hips: r1(101 - 3 * t), leftArm: r1(35 + t), rightArm: r1(35 + t), leftThigh: 59, rightThigh: 59,
      });
    }

    // Workouts: 4/week (Mon/Tue/Thu/Sat) with progressive overload → realistic PRs.
    const exercises = workoutRepo.getAllExercises();
    const findEx = (key: string) => exercises.find((e) => e.name.toLowerCase().includes(key));
    const bestKg: Record<string, number> = {};
    let splitIdx = 0;
    for (let d = SPAN; d >= 1; d--) {
      const day = new Date(Date.now() - d * DAY_MS);
      if (![1, 2, 4, 6].includes(day.getDay())) continue; // Mon, Tue, Thu, Sat
      const progressed = Math.max(0, Math.floor((SPAN - d) / 7)); // weeks elapsed
      const split = SPLITS[splitIdx % SPLITS.length];
      splitIdx++;
      const exPayload: Parameters<typeof workoutRepo.seedFinishedSession>[0]['exercises'] = [];
      let order = 0;
      for (const [key, baseW, sets, reps] of split.lifts) {
        const ex = findEx(key);
        if (!ex) continue;
        const w = baseW > 0 ? baseW + Math.floor(progressed / 2) * 2.5 : 0;
        const setArr = [];
        for (let s = 1; s <= sets; s++) {
          const isTop = s === sets;
          const pr = isTop && w > 0 && w > (bestKg[ex.id] ?? 0);
          if (pr) bestKg[ex.id] = w;
          setArr.push({ setNumber: s, weightKg: w, reps, isPersonalBest: pr });
        }
        exPayload.push({ exerciseLocalId: ex.id, order: order++, sets: setArr });
      }
      if (!exPayload.length) continue;
      const startedAt = new Date(day); startedAt.setHours(17, 30, 0, 0);
      const finishedAt = new Date(startedAt.getTime() + 55 * 60_000);
      workoutRepo.seedFinishedSession({
        name: split.name, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
        caloriesBurned: Math.round(rand(280, 460)), exercises: exPayload,
      });
    }
  });
}
