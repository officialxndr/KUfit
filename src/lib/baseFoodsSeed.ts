import { foodRepo } from '@/lib/repositories/FoodRepo';
import { getMeta, setMeta } from '@/lib/db';
import { NUTRIENT_DEFS } from '@/lib/offNutrients';
import baseFoods from '@/assets/foods/base-ingredients.json';
import type { FoodDetails, NutrimentEntry } from '@/types';

// Bump whenever assets/foods/base-ingredients.json changes so existing installs
// re-seed (update-in-place) instead of keeping stale rows.
const BASE_FOODS_VERSION = '5';

interface BaseFood {
  slug: string;
  name: string;
  category: string;
  fdcId?: number; // USDA FoodData Central id the values were pulled from (traceability)
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
  portions?: { label: string; grams: number }[];
}

// Allergens by tag → slugs (inverted below), so base foods get the same
// "Contains gluten / nuts / milk" badges as scanned products. A food can carry
// several (e.g. soy sauce = soybeans + gluten). Coconut is an FDA tree nut.
const ALLERGEN_GROUPS: Record<string, string[]> = {
  'en:milk': [
    'milk-2', 'skim-milk', 'whole-milk', 'milk-1', 'greek-yogurt', 'whole-greek-yogurt', 'plain-yogurt',
    'cottage-cheese', 'cheddar-cheese', 'mozzarella', 'butter', 'heavy-cream', 'sour-cream', 'cream-cheese',
    'ricotta', 'feta', 'parmesan', 'swiss-cheese', 'provolone', 'american-cheese', 'milk-chocolate', 'ranch',
  ],
  'en:eggs': ['egg', 'egg-white', 'mayonnaise', 'ranch'],
  'en:nuts': ['almonds', 'walnuts', 'cashews', 'pistachios', 'pecans', 'hazelnuts', 'almond-butter',
    'almond-milk', 'coconut', 'coconut-milk'],
  'en:peanuts': ['peanut-butter', 'peanuts'],
  'en:soybeans': ['tofu', 'edamame', 'tempeh', 'soy-milk', 'soy-sauce'],
  'en:sesame-seeds': ['tahini'],
  'en:fish': ['salmon', 'cod', 'tuna-canned', 'tilapia', 'sardines', 'tuna-steak', 'halibut', 'mahi-mahi',
    'trout', 'canned-salmon', 'smoked-salmon', 'anchovies'],
  'en:crustaceans': ['shrimp', 'crab', 'lobster'],
  'en:molluscs': ['scallops', 'mussels', 'calamari'],
  'en:gluten': ['whole-wheat-bread', 'white-bread', 'flour-tortilla', 'couscous', 'bagel', 'pasta',
    'sourdough-bread', 'rye-bread', 'multigrain-bread', 'english-muffin', 'pita', 'naan', 'pancake', 'waffle',
    'crackers', 'cornbread', 'barley', 'farro', 'granola', 'soy-sauce'],
};
const ALLERGENS: Record<string, string[]> = {};
for (const [tag, slugs] of Object.entries(ALLERGEN_GROUPS))
  for (const s of slugs) (ALLERGENS[s] ??= []).push(tag);

// Naturally gluten-free staples worth a positive badge (the grains/starches people check).
const GLUTEN_FREE = new Set(['white-rice', 'brown-rice', 'quinoa', 'oats', 'rice-cakes', 'popcorn']);

/** Derive OFF-style diet labels (vegan / vegetarian / gluten-free) from category + allergens,
 *  so base foods show the same positive diet badges scanned products get. */
function dietLabels(f: BaseFood, allergens: string[] | null): string[] {
  const a = new Set(allergens ?? []);
  const labels: string[] = [];
  const animal = f.category === 'Meat' || f.category === 'Fish';
  if (!animal) {
    labels.push('en:vegetarian');
    if (!a.has('en:milk') && !a.has('en:eggs') && f.slug !== 'honey') labels.push('en:vegan');
  }
  if (GLUTEN_FREE.has(f.slug)) labels.push('en:gluten-free');
  return labels;
}

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
  const labels = dietLabels(f, allergens);
  const details: FoodDetails = {
    nutriments,
    nutriScore: f.nutriScore ?? null,
    novaGroup: f.nova ?? null,
    ecoScore: null,
    nutrientLevels: null,
    ingredientsText: null,
    allergens,
    additives: null,
    labels: labels.length ? labels : null,
    portions: f.portions?.length ? f.portions : null,
  };
  const hasAny = nutriments.length || details.nutriScore || details.novaGroup || allergens || labels.length || f.portions?.length;
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
  const foods = baseFoods as unknown as BaseFood[];
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
