import { foodRepo } from '@/lib/repositories/FoodRepo';
import { getMeta, setMeta } from '@/lib/db';
import { NUTRIENT_DEFS } from '@/lib/offNutrients';
import baseFoods from '@/assets/foods/base-ingredients.json';
import type { FoodDetails, NutrimentEntry } from '@/types';

// Bump whenever assets/foods/base-ingredients.json changes so existing installs
// re-seed (update-in-place) instead of keeping stale rows.
const BASE_FOODS_VERSION = '2';

interface BaseFood {
  slug: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  satFat: number;
  sodium: number;
  nova: number;
  fruitVegPct: number;
  nutriScore: string | null;
  micros: Record<string, number>;
}

// Obvious allergens by slug → OFF-style tags, so base foods get the same
// "Contains gluten / nuts / milk" badges as scanned products.
const ALLERGENS: Record<string, string[]> = {
  egg: ['en:eggs'], 'egg-white': ['en:eggs'],
  'milk-2': ['en:milk'], 'skim-milk': ['en:milk'], 'greek-yogurt': ['en:milk'],
  'cottage-cheese': ['en:milk'], 'cheddar-cheese': ['en:milk'], mozzarella: ['en:milk'], butter: ['en:milk'],
  almonds: ['en:nuts'], walnuts: ['en:nuts'], cashews: ['en:nuts'], 'peanut-butter': ['en:peanuts'],
  tofu: ['en:soybeans'], edamame: ['en:soybeans'],
  salmon: ['en:fish'], cod: ['en:fish'], 'tuna-canned': ['en:fish'], tilapia: ['en:fish'], sardines: ['en:fish'],
  shrimp: ['en:crustaceans'],
  'whole-wheat-bread': ['en:gluten'], 'white-bread': ['en:gluten'], 'flour-tortilla': ['en:gluten'],
  couscous: ['en:gluten'], bagel: ['en:gluten'], pasta: ['en:gluten'],
};

/** Build a FoodDetails blob from a base food's micros + score/nova + allergens. */
function buildDetails(f: BaseFood): FoodDetails | null {
  const nutriments: NutrimentEntry[] = [];
  for (const [key, displayVal] of Object.entries(f.micros)) {
    const def = NUTRIENT_DEFS[key];
    if (!def || !displayVal) continue;
    // JSON stores micros in display units (mg/µg/g); NutrimentEntry stores grams.
    nutriments.push({ key, value: displayVal / def.factor });
  }
  const allergens = ALLERGENS[f.slug] ?? null;
  const details: FoodDetails = {
    nutriments,
    nutriScore: f.nutriScore ?? null,
    novaGroup: f.nova ?? null,
    ecoScore: null,
    nutrientLevels: null,
    ingredientsText: null,
    allergens,
    additives: null,
    labels: null,
  };
  const hasAny = nutriments.length || details.nutriScore || details.novaGroup || allergens;
  return hasAny ? details : null;
}

/**
 * Seed a bundled database of common whole-food base ingredients (fruits, veg,
 * meats, fish, grains, legumes, dairy, fats) so staples are searchable offline
 * without depending on Open Food Facts. Values are per 100 g and now carry the
 * full extended-nutrient breakdown, NOVA group, a computed Nutri-Score, and
 * allergen badges — the same rich view scanned products get.
 *
 * Each item has a synthetic `base:<slug>` barcode; `upsertBaseFood` updates rows
 * in place, so bumping BASE_FOODS_VERSION refreshes existing installs.
 */
export function seedBaseFoodsIfNeeded() {
  const foods = baseFoods as BaseFood[];
  if (foods.length === 0) return;
  if (getMeta('baseFoodsVersion') === BASE_FOODS_VERSION) return;

  for (const f of foods) {
    foodRepo.upsertBaseFood({
      name: f.name,
      barcode: `base:${f.slug}`,
      servingSize: 100,
      servingUnit: 'g',
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      fiber: f.fiber,
      sugar: f.sugar,
      sodium: f.sodium,
      saturatedFat: f.satFat,
      details: buildDetails(f),
    });
  }
  setMeta('baseFoodsVersion', BASE_FOODS_VERSION);
}
