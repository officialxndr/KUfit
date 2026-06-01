import type { FoodDetails, NutrimentEntry } from '@/types';

/**
 * Open Food Facts extended-nutriment catalog + extraction helpers.
 *
 * OFF stores every `<key>_100g` / `<key>_serving` value in GRAMS (the same basis
 * the core macros use — that's why FoodRepo multiplies sodium by 1000 to get mg).
 * So we store each extended nutriment as grams-per-serving and apply a per-nutrient
 * display `factor` (1 → g, 1000 → mg, 1e6 → µg) only when rendering.
 *
 * The 8 "core" nutriments (energy-kcal, proteins, carbohydrates, fat, fiber,
 * sugars, sodium, saturated-fat) live in dedicated columns and are intentionally
 * excluded here to avoid double-counting.
 */

export interface NutrientDef {
  label: string;
  unit: 'g' | 'mg' | 'µg' | '% vol';
  factor: number; // multiply the stored gram value by this for display
  group: NutrientGroup;
}
export type NutrientGroup = 'Fats' | 'Carbohydrates' | 'Fiber & salt' | 'Vitamins' | 'Minerals' | 'Other';

// Ordered so the display groups read top-to-bottom in a sensible sequence.
export const NUTRIENT_DEFS: Record<string, NutrientDef> = {
  // Fats
  'trans-fat': { label: 'Trans fat', unit: 'g', factor: 1, group: 'Fats' },
  'monounsaturated-fat': { label: 'Monounsaturated', unit: 'g', factor: 1, group: 'Fats' },
  'polyunsaturated-fat': { label: 'Polyunsaturated', unit: 'g', factor: 1, group: 'Fats' },
  'omega-3-fat': { label: 'Omega-3', unit: 'g', factor: 1, group: 'Fats' },
  'omega-6-fat': { label: 'Omega-6', unit: 'g', factor: 1, group: 'Fats' },
  cholesterol: { label: 'Cholesterol', unit: 'mg', factor: 1000, group: 'Fats' },
  // Carbohydrates
  'added-sugars': { label: 'Added sugars', unit: 'g', factor: 1, group: 'Carbohydrates' },
  starch: { label: 'Starch', unit: 'g', factor: 1, group: 'Carbohydrates' },
  polyols: { label: 'Polyols', unit: 'g', factor: 1, group: 'Carbohydrates' },
  fructose: { label: 'Fructose', unit: 'g', factor: 1, group: 'Carbohydrates' },
  lactose: { label: 'Lactose', unit: 'g', factor: 1, group: 'Carbohydrates' },
  sucrose: { label: 'Sucrose', unit: 'g', factor: 1, group: 'Carbohydrates' },
  glucose: { label: 'Glucose', unit: 'g', factor: 1, group: 'Carbohydrates' },
  maltose: { label: 'Maltose', unit: 'g', factor: 1, group: 'Carbohydrates' },
  // Fiber & salt
  'soluble-fiber': { label: 'Soluble fiber', unit: 'g', factor: 1, group: 'Fiber & salt' },
  'insoluble-fiber': { label: 'Insoluble fiber', unit: 'g', factor: 1, group: 'Fiber & salt' },
  salt: { label: 'Salt', unit: 'g', factor: 1, group: 'Fiber & salt' },
  // Vitamins
  'vitamin-a': { label: 'Vitamin A', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  'beta-carotene': { label: 'Beta-carotene', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  'vitamin-d': { label: 'Vitamin D', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  'vitamin-e': { label: 'Vitamin E', unit: 'mg', factor: 1000, group: 'Vitamins' },
  'vitamin-k': { label: 'Vitamin K', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  'vitamin-c': { label: 'Vitamin C', unit: 'mg', factor: 1000, group: 'Vitamins' },
  'vitamin-b1': { label: 'Vitamin B1 (thiamin)', unit: 'mg', factor: 1000, group: 'Vitamins' },
  'vitamin-b2': { label: 'Vitamin B2 (riboflavin)', unit: 'mg', factor: 1000, group: 'Vitamins' },
  'vitamin-pp': { label: 'Niacin (B3)', unit: 'mg', factor: 1000, group: 'Vitamins' },
  'vitamin-b6': { label: 'Vitamin B6', unit: 'mg', factor: 1000, group: 'Vitamins' },
  'vitamin-b9': { label: 'Folate (B9)', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  'vitamin-b12': { label: 'Vitamin B12', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  biotin: { label: 'Biotin (B7)', unit: 'µg', factor: 1e6, group: 'Vitamins' },
  'pantothenic-acid': { label: 'Pantothenic acid (B5)', unit: 'mg', factor: 1000, group: 'Vitamins' },
  // Minerals
  calcium: { label: 'Calcium', unit: 'mg', factor: 1000, group: 'Minerals' },
  iron: { label: 'Iron', unit: 'mg', factor: 1000, group: 'Minerals' },
  magnesium: { label: 'Magnesium', unit: 'mg', factor: 1000, group: 'Minerals' },
  phosphorus: { label: 'Phosphorus', unit: 'mg', factor: 1000, group: 'Minerals' },
  potassium: { label: 'Potassium', unit: 'mg', factor: 1000, group: 'Minerals' },
  zinc: { label: 'Zinc', unit: 'mg', factor: 1000, group: 'Minerals' },
  copper: { label: 'Copper', unit: 'mg', factor: 1000, group: 'Minerals' },
  manganese: { label: 'Manganese', unit: 'mg', factor: 1000, group: 'Minerals' },
  selenium: { label: 'Selenium', unit: 'µg', factor: 1e6, group: 'Minerals' },
  iodine: { label: 'Iodine', unit: 'µg', factor: 1e6, group: 'Minerals' },
  fluoride: { label: 'Fluoride', unit: 'mg', factor: 1000, group: 'Minerals' },
  chloride: { label: 'Chloride', unit: 'mg', factor: 1000, group: 'Minerals' },
  // Other
  alcohol: { label: 'Alcohol', unit: '% vol', factor: 1, group: 'Other' },
  caffeine: { label: 'Caffeine', unit: 'mg', factor: 1000, group: 'Other' },
  taurine: { label: 'Taurine', unit: 'mg', factor: 1000, group: 'Other' },
};

export const NUTRIENT_GROUP_ORDER: NutrientGroup[] = [
  'Fats', 'Carbohydrates', 'Fiber & salt', 'Vitamins', 'Minerals', 'Other',
];

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && isFinite(n) ? n : null;
};

/** Build extended nutriments (per serving, grams) from an OFF `nutriments` object. */
function extractNutriments(n: Record<string, any>): NutrimentEntry[] {
  const out: NutrimentEntry[] = [];
  for (const key of Object.keys(NUTRIENT_DEFS)) {
    const v = num(n[`${key}_serving`]) ?? num(n[`${key}_100g`]);
    if (v != null && v > 0) out.push({ key, value: v });
  }
  return out;
}

/** Capture rich detail from an OFF product (search result or barcode payload). */
export function extractDetails(p: any): FoodDetails | null {
  const n = p?.nutriments ?? {};
  const nutriments = extractNutriments(n);
  const levels: FoodDetails['nutrientLevels'] =
    p?.nutrient_levels && Object.keys(p.nutrient_levels).length ? p.nutrient_levels : null;
  const allergens = arr(p?.allergens_tags);
  const additives = arr(p?.additives_tags);
  const labels = [...arr(p?.labels_tags), ...arr(p?.ingredients_analysis_tags)];

  const details: FoodDetails = {
    nutriments,
    nutriScore: grade(p?.nutriscore_grade ?? p?.nutrition_grade_fr),
    novaGroup: num(p?.nova_group),
    ecoScore: grade(p?.ecoscore_grade),
    nutrientLevels: levels,
    ingredientsText: (p?.ingredients_text || p?.ingredients_text_en || null)?.trim() || null,
    allergens: allergens.length ? allergens : null,
    additives: additives.length ? additives : null,
    labels: labels.length ? labels : null,
  };

  // Nothing useful captured → don't bother persisting an empty blob.
  const hasAny =
    nutriments.length || details.nutriScore || details.novaGroup || details.ecoScore ||
    details.ingredientsText || details.allergens || details.additives || details.labels;
  return hasAny ? details : null;
}

const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const grade = (g: any): string | null => {
  const s = typeof g === 'string' ? g.trim().toLowerCase() : '';
  return /^[a-e]$/.test(s) ? s : null;
};

// ── Display helpers ───────────────────────────────────────────────────────────

const fmt = (n: number) => (n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100);

/** Format a stored entry (grams/serving) for a given servings multiplier. */
export function formatNutriment(entry: NutrimentEntry, qty: number): { label: string; text: string; group: NutrientGroup } | null {
  const def = NUTRIENT_DEFS[entry.key];
  if (!def) return null;
  const amount = entry.value * qty * def.factor;
  return { label: def.label, text: `${fmt(amount)} ${def.unit}`, group: def.group };
}

export interface FoodBadge { label: string; tone: 'success' | 'warning' | 'danger'; }

// Major EU/US allergens worth a "Contains …" badge, mapped to friendly names.
const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'gluten', milk: 'milk', eggs: 'eggs', nuts: 'nuts', peanuts: 'peanuts',
  soybeans: 'soy', 'sesame-seeds': 'sesame', fish: 'fish', crustaceans: 'shellfish',
  molluscs: 'molluscs', celery: 'celery', mustard: 'mustard', lupin: 'lupin',
  'sulphur-dioxide-and-sulphites': 'sulphites',
};

const stripPrefix = (t: string) => t.replace(/^[a-z]{2}:/, '');

/** Derive diet/allergen badges (the "contains gluten / vegan / …" pills). */
export function foodBadges(details: FoodDetails | null | undefined): FoodBadge[] {
  if (!details) return [];
  const badges: FoodBadge[] = [];
  const labels = new Set((details.labels ?? []).map(stripPrefix));

  // Positive diet labels.
  if (labels.has('vegan')) badges.push({ label: 'Vegan', tone: 'success' });
  else if (labels.has('vegetarian')) badges.push({ label: 'Vegetarian', tone: 'success' });
  if (labels.has('gluten-free') || labels.has('no-gluten')) badges.push({ label: 'Gluten-free', tone: 'success' });
  if (labels.has('organic')) badges.push({ label: 'Organic', tone: 'success' });
  if (labels.has('palm-oil-free')) badges.push({ label: 'No palm oil', tone: 'success' });

  // Allergen warnings ("Contains …").
  for (const tag of details.allergens ?? []) {
    const name = ALLERGEN_LABELS[stripPrefix(tag)];
    if (name) badges.push({ label: `Contains ${name}`, tone: 'warning' });
  }
  return badges;
}
