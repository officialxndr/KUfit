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
// US-tuned mirror for the legacy full-text coverage search — ranks US foods first
// (e.g. the McDonald's items the global index buries) and tends to be a bit more available.
const OFF_US_BASE = 'https://us.openfoodfacts.org';
const USER_AGENT = 'Hale/1.0 (haledevteam@protonmail.com)';

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
  servingText?: string | null;
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

const SAL_BASE = 'https://search.openfoodfacts.org';
const SEARCH_PAGE_SIZE = 30;
const SAL_FIELDS =
  'product_name,brands,code,nutriments,nutriscore_grade,nova_group,ecoscore_grade,nutrient_levels';
const CGI_FIELDS =
  'product_name,brands,nutriments,serving_size,code,nutriscore_grade,nova_group,ecoscore_grade,' +
  'nutrient_levels,ingredients_text,allergens_tags,additives_tags,labels_tags,ingredients_analysis_tags';

const salBrand = (b: unknown): string | null =>
  Array.isArray(b) ? (b[0] ?? null) : ((b as string) || null);

/** Map a search-a-licious hit (per-100g nutriments, no serving_size) to a candidate. */
function salHitToCandidate(h: any): FoodCandidate | null {
  const name = typeof h.product_name === 'string' ? h.product_name : null;
  if (!name || name.length > 120) return null; // missing / ingredient-dump names
  const n = h.nutriments ?? {};
  const calories = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0;
  if (!calories) return null; // no calorie data → not loggable
  const sodium = n.sodium_serving ?? n.sodium_100g;
  return {
    barcode: h.code || null,
    name,
    brand: salBrand(h.brands),
    servingSize: 100, // SAL doesn't index serving_size → per-100g base
    servingUnit: 'g',
    calories,
    protein: n.proteins_serving ?? n.proteins_100g ?? 0,
    carbs: n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0,
    fat: n.fat_serving ?? n.fat_100g ?? 0,
    fiber: n.fiber_serving ?? n.fiber_100g ?? null,
    sugar: n.sugars_serving ?? n.sugars_100g ?? null,
    sodium: sodium != null ? sodium * 1000 : null,
    saturatedFat: n['saturated-fat_serving'] ?? n['saturated-fat_100g'] ?? null,
    source: 'OPEN_FOOD_FACTS',
    isCustom: false,
    details: extractDetails(h),
  };
}

export interface SearchPage {
  items: FoodCandidate[];
  /** More OFF pages available for this query (drives infinite scroll). */
  hasMore: boolean;
}

/** search-a-licious: fast + reliable + paginated, but its index omits many products. */
async function searchSAL(q: string, page: number): Promise<SearchPage> {
  try {
    const { data } = await axios.get(`${SAL_BASE}/search`, {
      params: { q, page, page_size: SEARCH_PAGE_SIZE, fields: SAL_FIELDS },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000,
    });
    const items: FoodCandidate[] = [];
    for (const h of data?.hits ?? []) {
      const c = salHitToCandidate(h);
      if (c) items.push(c);
    }
    return { items, hasMore: (data?.page ?? page) < (data?.page_count ?? page) };
  } catch {
    return { items: [], hasMore: false };
  }
}

/** Legacy CGI full-text: complete coverage (US/branded items SAL's index lacks)
 *  but frequently 503s — best-effort with a quick retry (503s fail fast). */
async function searchCGI(q: string): Promise<FoodCandidate[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await axios.get(`${OFF_US_BASE}/cgi/search.pl`, {
        params: { search_terms: q, search_simple: 1, action: 'process', json: 1, page_size: 50, fields: CGI_FIELDS },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 3500,
      });
      const items: FoodCandidate[] = [];
      for (const p of data?.products ?? []) {
        const c = offProductToCandidate(p);
        if (c) items.push(c);
      }
      return items;
    } catch {
      /* 503 / timeout — retry once, then give up (SAL still covers us) */
    }
  }
  return [];
}

/** Relevance: token overlap drives multi-word brand queries; exact/prefix boosts short ones. */
function relevance(name: string, query: string): number {
  const n = name.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (n === q) return 1000;
  const qt = q.split(/[\s,()/]+/).filter(Boolean);
  const nt = new Set(n.split(/[\s,()/]+/).filter(Boolean));
  const overlap = qt.filter((t) => nt.has(t)).length;
  let s = overlap * 25;
  if (qt.length > 0 && overlap === qt.length) s += 60; // every query word present
  if (n.startsWith(q)) s += 100;
  else if (n.includes(q)) s += 40;
  return s;
}

/**
 * Search local cache + Open Food Facts, paginated. Page 1 queries BOTH OFF
 * endpoints in parallel — search-a-licious (fast/reliable but an incomplete
 * index) and the legacy CGI full-text (complete coverage, e.g. US/branded
 * items, but flaky) — then merges, de-dupes, and relevance-ranks. Later pages
 * page through search-a-licious only. On-device matches always rank first.
 */
export async function searchFood(query: string, page = 1): Promise<SearchPage> {
  const q = query.trim();
  if (!q) return { items: [], hasMore: false };

  if (page !== 1) return searchSAL(q, page);

  const local = foodRepo.searchFoodItems(q).map(fromLocal);
  const localBarcodes = new Set(local.map((l) => l.barcode).filter(Boolean));
  const localNames = new Set(local.map((l) => l.name.toLowerCase()));

  const [sal, cgi] = await Promise.all([searchSAL(q, 1), searchCGI(q)]);

  // Merge OFF results — CGI first so its richer entries (serving size, per-serving) win de-dupe.
  const off: FoodCandidate[] = [];
  const seen = new Set<string>();
  for (const c of [...cgi, ...sal.items]) {
    const key = c.barcode || c.name.toLowerCase();
    // Also collapse same name+brand entries — OFF often lists a product under several barcodes.
    const brandKey = c.brand ? `${c.name.toLowerCase()}|${c.brand.toLowerCase()}` : null;
    if (seen.has(key) || (brandKey && seen.has(brandKey))) continue;
    if ((c.barcode && localBarcodes.has(c.barcode)) || localNames.has(c.name.toLowerCase())) continue;
    seen.add(key);
    if (brandKey) seen.add(brandKey);
    off.push(c);
  }

  const localRanked = local.sort((a, b) => relevance(b.name, q) - relevance(a.name, q));
  const offRanked = off.sort((a, b) => relevance(b.name, q) - relevance(a.name, q));
  return { items: [...localRanked, ...offRanked], hasMore: sal.hasMore };
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
