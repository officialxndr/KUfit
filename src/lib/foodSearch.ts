import axios from 'axios';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { extractDetails } from '@/lib/offNutrients';
import type { FoodDetails, FoodItem, FoodSource } from '@/types';

/**
 * Open Food Facts food search + barcode lookup, ported from the web API
 * (apps/api/src/routes/food.ts). Runs DIRECTLY on the device — no server.
 *
 * Quality strategy preserved verbatim from the web app:
 *  - sort_by=unique_scans_n (most-scanned/popular first)
 *  - skip products with no name, or name > 120 chars (ingredient-list dumps)
 *  - skip products with no calorie data
 *  - prefer per-serving nutriments, fall back to per-100g
 *  - relevance score() ranks by how closely the name matches the query
 *
 * Results are ephemeral candidates; we only persist a FoodItem to SQLite when
 * the user actually logs it (see ensureFoodItem).
 */

const OFF_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'Hale/1.0 (zander.halverson99@gmail.com)';

// Optional USDA fallback — left disabled by default (embedding a key in the
// client is undesirable). Set via app config extra if the user opts in.
const USDA_API_KEY: string | null = null;

export interface FoodCandidate {
  localId?: string; // present when sourced from the local cache / custom foods
  barcode: string | null;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  saturatedFat: number | null;
  source: FoodSource;
  isCustom: boolean;
  isFavorite?: boolean;
  details?: FoodDetails | null;
  lastAmount?: number | null;
  lastUnit?: string | null;
}

function fromLocal(fi: FoodItem): FoodCandidate {
  return { ...fi, localId: fi.id, barcode: fi.barcode ?? null, brand: fi.brand ?? null,
    fiber: fi.fiber ?? null, sugar: fi.sugar ?? null, sodium: fi.sodium ?? null,
    saturatedFat: fi.saturatedFat ?? null, isFavorite: fi.isFavorite ?? false, details: fi.details ?? null };
}

function offProductToCandidate(p: any): FoodCandidate | null {
  if (!p.product_name) return null;
  if (p.product_name.length > 120) return null; // skip ingredient-list dumps
  const n = p.nutriments ?? {};
  const calories = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0;
  if (!calories) return null; // skip items with no calorie data
  return {
    barcode: p.code || null,
    name: p.product_name,
    brand: p.brands || null,
    servingSize: parseFloat(p.serving_size) || 100,
    servingUnit: 'g',
    calories,
    protein: n.proteins_serving ?? n.proteins_100g ?? 0,
    carbs: n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0,
    fat: n.fat_serving ?? n.fat_100g ?? 0,
    fiber: n.fiber_serving ?? n.fiber_100g ?? null,
    sugar: n.sugars_serving ?? n.sugars_100g ?? null,
    sodium: n.sodium_serving != null ? n.sodium_serving * 1000 : null,
    saturatedFat: n['saturated-fat_serving'] ?? n['saturated-fat_100g'] ?? null,
    source: 'OPEN_FOOD_FACTS',
    isCustom: false,
    details: extractDetails(p),
  };
}

/** Search the local cache + Open Food Facts, merged and relevance-ranked. */
export async function searchFood(query: string): Promise<FoodCandidate[]> {
  const q = query.trim();
  if (!q) return [];

  const local = foodRepo.searchFoodItems(q).map(fromLocal);
  const localBarcodes = new Set(local.map((l) => l.barcode).filter(Boolean));
  const localNames = new Set(local.map((l) => l.name.toLowerCase()));

  let offItems: FoodCandidate[] = [];
  try {
    const { data } = await axios.get(`${OFF_BASE}/cgi/search.pl`, {
      params: {
        search_terms: q,
        search_simple: 1,
        action: 'process',
        json: 1,
        page_size: 100,
        sort_by: 'unique_scans_n',
        fields: 'product_name,brands,nutriments,serving_size,code,nutriscore_grade,'
          + 'nova_group,ecoscore_grade,nutrient_levels,ingredients_text,allergens_tags,'
          + 'additives_tags,labels_tags,ingredients_analysis_tags',
      },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    const products: any[] = data?.products ?? [];
    for (const p of products) {
      const c = offProductToCandidate(p);
      if (!c) continue;
      if (c.barcode && localBarcodes.has(c.barcode)) continue;
      if (localNames.has(c.name.toLowerCase())) continue;
      offItems.push(c);
    }
  } catch {
    /* offline or OFF unavailable — local results still returned */
  }

  // Relevance score (verbatim from web): exact > startsWith > first-word > word > prefix > substring
  const score = (name: string): number => {
    const n = name.toLowerCase().trim();
    const q2 = q.toLowerCase();
    if (n === q2) return 100;
    if (n.startsWith(q2 + ' ') || n.startsWith(q2 + ',') || n.startsWith(q2 + '(')) return 90;
    const words = n.split(/[\s,()/]+/).filter(Boolean);
    if (words[0] === q2) return 85;
    if (words.some((w) => w === q2)) return 70;
    if (words.some((w) => w.startsWith(q2))) return 50;
    if (n.includes(q2)) return 30;
    return 10;
  };

  // Local-first: every on-device match (custom/base/cached) ranks above OFF results.
  const localRanked = local.sort((a, b) => score(b.name) - score(a.name));
  const offRanked = offItems.sort((a, b) => score(b.name) - score(a.name));
  return [...localRanked, ...offRanked].slice(0, 60);
}

/** Barcode lookup: local cache → Open Food Facts (→ USDA if enabled). */
export async function barcodeLookup(barcode: string): Promise<FoodCandidate | null> {
  const cached = foodRepo.getFoodItemByBarcode(barcode);
  if (cached) return fromLocal(cached);

  try {
    const { data } = await axios.get(`${OFF_BASE}/api/v0/product/${barcode}.json`, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 6000,
    });
    if (data.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments ?? {};
      return {
        barcode,
        name: p.product_name ?? p.product_name_en ?? 'Unknown product',
        brand: p.brands || null,
        servingSize: n.serving_size ? parseFloat(n.serving_size) || 100 : 100,
        servingUnit: 'g',
        calories: n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0,
        protein: n.proteins_serving ?? n.proteins_100g ?? 0,
        carbs: n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0,
        fat: n.fat_serving ?? n.fat_100g ?? 0,
        fiber: n.fiber_serving ?? n.fiber_100g ?? null,
        sugar: n.sugars_serving ?? n.sugars_100g ?? null,
        sodium: n.sodium_serving != null ? n.sodium_serving * 1000 : null,
        saturatedFat: n['saturated-fat_serving'] ?? n['saturated-fat_100g'] ?? null,
        source: 'OPEN_FOOD_FACTS',
        isCustom: false,
        details: extractDetails(p),
      };
    }
  } catch {
    /* fall through */
  }

  if (USDA_API_KEY) {
    try {
      const { data } = await axios.get('https://api.nal.usda.gov/fdc/v1/foods/search', {
        params: { query: barcode, api_key: USDA_API_KEY, pageSize: 1 },
        timeout: 6000,
      });
      const f = data.foods?.[0];
      if (f) {
        const g = (id: number) => f.foodNutrients?.find((x: any) => x.nutrientId === id)?.value ?? 0;
        return {
          barcode,
          name: f.description,
          brand: f.brandOwner || null,
          servingSize: f.servingSize ?? 100,
          servingUnit: f.servingSizeUnit ?? 'g',
          calories: g(1008),
          protein: g(1003),
          carbs: g(1005),
          fat: g(1004),
          fiber: g(1079) || null,
          sugar: g(2000) || null,
          sodium: g(1093) ? g(1093) * 1000 : null,
          saturatedFat: g(1258) || null,
          source: 'USDA',
          isCustom: false,
        };
      }
    } catch {
      /* not found */
    }
  }

  return null;
}

/** Persist a candidate into SQLite if needed, returning its localId. */
export function ensureFoodItem(c: FoodCandidate): string {
  if (c.localId) return c.localId;
  return foodRepo.upsertFoodItem({
    name: c.name,
    brand: c.brand,
    barcode: c.barcode,
    servingSize: c.servingSize,
    servingUnit: c.servingUnit,
    calories: c.calories,
    protein: c.protein,
    carbs: c.carbs,
    fat: c.fat,
    fiber: c.fiber,
    sugar: c.sugar,
    sodium: c.sodium,
    saturatedFat: c.saturatedFat,
    source: c.source,
    isCustom: c.isCustom,
    details: c.details ?? null,
  });
}
