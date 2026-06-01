import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';
import type { FoodDetails, FoodItem, FoodLog, MealType, Recipe, RecipeIngredient } from '@/types';

/** Safely parse a stored `detailsJson` blob back into FoodDetails (null on absent/bad data). */
function parseDetails(raw: unknown): FoodDetails | null {
  if (typeof raw !== 'string' || !raw) return null;
  try { return JSON.parse(raw) as FoodDetails; } catch { return null; }
}

/** A day's (or per-serving) nutrient totals. */
export interface DayNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapFoodItem(row: any): FoodItem {
  return {
    id: row.localId,
    barcode: row.barcode ?? null,
    name: row.name,
    brand: row.brand ?? null,
    servingSize: row.servingSize,
    servingUnit: row.servingUnit ?? 'g',
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber ?? null,
    sugar: row.sugar ?? null,
    sodium: row.sodium ?? null,
    saturatedFat: row.saturatedFat ?? null,
    source: row.source ?? 'MANUAL',
    isCustom: !!row.isCustom,
    isFavorite: !!row.isFavorite,
    createdAt: row.updatedAt ?? new Date().toISOString(),
    details: parseDetails(row.detailsJson),
  };
}

function mapFoodLog(row: any): FoodLog {
  const foodItem: FoodItem | null = row.fi_localId
    ? {
        id: row.fi_localId,
        barcode: row.fi_barcode ?? null,
        name: row.fi_name,
        brand: row.fi_brand ?? null,
        servingSize: row.fi_servingSize,
        servingUnit: row.fi_servingUnit ?? 'g',
        calories: row.fi_calories,
        protein: row.fi_protein,
        carbs: row.fi_carbs,
        fat: row.fi_fat,
        fiber: row.fi_fiber ?? null,
        sugar: row.fi_sugar ?? null,
        sodium: row.fi_sodium ?? null,
        saturatedFat: row.fi_saturatedFat ?? null,
        source: row.fi_source ?? 'MANUAL',
        isCustom: !!row.fi_isCustom,
        createdAt: row.fi_updatedAt ?? new Date().toISOString(),
        details: parseDetails(row.fi_detailsJson),
      }
    : null;

  return {
    id: row.localId,
    date: row.date,
    meal: row.meal as MealType,
    foodItem,
    recipe: null, // recipes loaded separately when needed
    servingQty: row.servingQty,
    createdAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function mapRecipe(row: any, ingredients: RecipeIngredient[]): Recipe {
  return {
    id: row.localId,
    userId: 'local',
    name: row.name,
    description: row.description ?? null,
    servings: row.servings ?? 1,
    ingredients,
    nutrition: undefined,
    createdAt: row.updatedAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

export class FoodRepo {
  getLogs(date: string): FoodLog[] {
    const rows = db.getAllSync(
      `SELECT
         fl.localId, fl.date, fl.meal, fl.servingQty, fl.updatedAt, fl.recipeLocalId,
         fi.localId   AS fi_localId,
         fi.barcode   AS fi_barcode,
         fi.name      AS fi_name,
         fi.brand     AS fi_brand,
         fi.servingSize AS fi_servingSize,
         fi.servingUnit AS fi_servingUnit,
         fi.calories  AS fi_calories,
         fi.protein   AS fi_protein,
         fi.carbs     AS fi_carbs,
         fi.fat       AS fi_fat,
         fi.fiber     AS fi_fiber,
         fi.sugar     AS fi_sugar,
         fi.sodium    AS fi_sodium,
         fi.saturatedFat AS fi_saturatedFat,
         fi.detailsJson AS fi_detailsJson,
         fi.source    AS fi_source,
         fi.isCustom  AS fi_isCustom,
         fi.updatedAt AS fi_updatedAt
       FROM food_logs fl
       LEFT JOIN food_items fi ON fl.foodItemLocalId = fi.localId
       WHERE fl.date = ? AND fl.deleted = 0
       ORDER BY fl.rowid`,
      [date]
    );
    const logs = (rows as any[]).map(mapFoodLog);
    // Resolve recipe nutrition for any recipe-based logs (loaded lazily).
    if ((rows as any[]).some((r) => r.recipeLocalId)) {
      const recipeMap = new Map(this.getRecipes().map((r) => [r.id, r]));
      (rows as any[]).forEach((r, i) => {
        if (r.recipeLocalId) logs[i].recipe = recipeMap.get(r.recipeLocalId) ?? null;
      });
    }
    return logs;
  }

  addLog(payload: {
    date: string;
    meal: string;
    foodItemLocalId?: string;
    recipeLocalId?: string;
    servingQty: number;
  }): void {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO food_logs
         (localId, date, meal, foodItemLocalId, recipeLocalId, servingQty, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        localId,
        payload.date,
        payload.meal,
        payload.foodItemLocalId ?? null,
        payload.recipeLocalId ?? null,
        payload.servingQty,
        new Date().toISOString(),
      ]
    );
  }

  updateLog(localId: string, servingQty: number): void {
    db.runSync(
      `UPDATE food_logs SET servingQty = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [servingQty, new Date().toISOString(), localId]
    );
  }

  deleteLog(localId: string): void {
    db.runSync(
      `UPDATE food_logs SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  toggleFavorite(localId: string): void {
    db.runSync(
      `UPDATE food_items SET isFavorite = CASE WHEN isFavorite = 1 THEN 0 ELSE 1 END, updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  getFavoriteFoodItems(): FoodItem[] {
    return (db.getAllSync(
      `SELECT * FROM food_items WHERE isFavorite = 1 AND deleted IS NOT 1 ORDER BY name`
    ) as any[]).map(mapFoodItem);
  }

  // Distinct recently-logged food items (for quick-add)
  getRecentFoodItems(limit = 10): FoodItem[] {
    const rows = db.getAllSync(
      `SELECT fi.* FROM food_logs fl
       JOIN food_items fi ON fl.foodItemLocalId = fi.localId
       WHERE fl.deleted = 0
       GROUP BY fi.localId
       ORDER BY MAX(fl.updatedAt) DESC
       LIMIT ?`,
      [limit]
    ) as any[];
    return rows.map(mapFoodItem);
  }

  // ── Food Item search ────────────────────────────────────────────────────────

  searchFoodItems(q: string): FoodItem[] {
    const rows = db.getAllSync(
      `SELECT * FROM food_items WHERE name LIKE ? AND deleted IS NOT 1 LIMIT 40`,
      [`%${q}%`]
    );
    return (rows as any[]).map(mapFoodItem);
  }

  getFoodItemByBarcode(barcode: string): FoodItem | null {
    const row = db.getFirstSync(`SELECT * FROM food_items WHERE barcode = ?`, [barcode]);
    return row ? mapFoodItem(row as any) : null;
  }

  getFoodItemById(localId: string): FoodItem | null {
    const row = db.getFirstSync(`SELECT * FROM food_items WHERE localId = ?`, [localId]);
    return row ? mapFoodItem(row as any) : null;
  }

  upsertFoodItem(item: {
    name: string;
    brand?: string | null;
    barcode?: string | null;
    servingSize: number;
    servingUnit?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
    saturatedFat?: number | null;
    details?: FoodDetails | null;
    source?: string;
    isCustom?: boolean;
    serverId?: string | null;
  }): string {
    // Dedup by barcode
    if (item.barcode) {
      const existing = db.getFirstSync(
        `SELECT localId FROM food_items WHERE barcode = ?`,
        [item.barcode]
      ) as any;
      if (existing) return existing.localId;
    }
    // Dedup by serverId
    if (item.serverId) {
      const existing = db.getFirstSync(
        `SELECT localId FROM food_items WHERE serverId = ?`,
        [item.serverId]
      ) as any;
      if (existing) return existing.localId;
    }
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT OR IGNORE INTO food_items
         (localId, serverId, name, brand, barcode, servingSize, servingUnit,
          calories, protein, carbs, fat, fiber, sugar, sodium, saturatedFat, detailsJson, source, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        localId,
        item.serverId ?? null,
        item.name,
        item.brand ?? null,
        item.barcode ?? null,
        item.servingSize,
        item.servingUnit ?? 'g',
        item.calories,
        item.protein,
        item.carbs,
        item.fat,
        item.fiber ?? null,
        item.sugar ?? null,
        item.sodium ?? null,
        item.saturatedFat ?? null,
        item.details ? JSON.stringify(item.details) : null,
        item.source ?? 'MANUAL',
        item.isCustom ? 1 : 0,
        new Date().toISOString(),
      ]
    );
    return localId;
  }

  /**
   * Insert or **update-in-place** a bundled base ingredient (keyed by its
   * `base:<slug>` barcode). Unlike `upsertFoodItem` (insert-or-ignore), this
   * refreshes existing rows with new nutrition/details when the seed is bumped —
   * without deleting them, so existing food logs/recipes keep referencing them.
   */
  upsertBaseFood(item: {
    name: string;
    barcode: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number | null;
    sugar?: number | null;
    sodium?: number | null;
    saturatedFat?: number | null;
    details?: FoodDetails | null;
  }): void {
    const detailsJson = item.details ? JSON.stringify(item.details) : null;
    const now = new Date().toISOString();
    const res = db.runSync(
      `UPDATE food_items SET
         name = ?, servingSize = ?, servingUnit = ?, calories = ?, protein = ?, carbs = ?, fat = ?,
         fiber = ?, sugar = ?, sodium = ?, saturatedFat = ?, detailsJson = ?,
         source = 'BASE', isCustom = 0, updatedAt = ?
       WHERE barcode = ?`,
      [
        item.name, item.servingSize, item.servingUnit, item.calories, item.protein, item.carbs, item.fat,
        item.fiber ?? null, item.sugar ?? null, item.sodium ?? null, item.saturatedFat ?? null, detailsJson,
        now, item.barcode,
      ]
    );
    if (res.changes > 0) return;
    db.runSync(
      `INSERT INTO food_items
         (localId, barcode, name, servingSize, servingUnit, calories, protein, carbs, fat,
          fiber, sugar, sodium, saturatedFat, detailsJson, source, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BASE', 0, 'synced', ?)`,
      [
        Crypto.randomUUID(), item.barcode, item.name, item.servingSize, item.servingUnit,
        item.calories, item.protein, item.carbs, item.fat,
        item.fiber ?? null, item.sugar ?? null, item.sodium ?? null, item.saturatedFat ?? null,
        detailsJson, now,
      ]
    );
  }

  createCustomFoodItem(item: Omit<FoodItem, 'id' | 'createdAt'>): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO food_items
         (localId, name, brand, barcode, servingSize, servingUnit,
          calories, protein, carbs, fat, fiber, sugar, sodium, saturatedFat, detailsJson, source, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1, 'pending', ?)`,
      [
        localId,
        item.name,
        item.brand ?? null,
        item.barcode ?? null,
        item.servingSize,
        item.servingUnit ?? 'g',
        item.calories,
        item.protein,
        item.carbs,
        item.fat,
        item.fiber ?? null,
        item.sugar ?? null,
        item.sodium ?? null,
        item.saturatedFat ?? null,
        item.details ? JSON.stringify(item.details) : null,
        new Date().toISOString(),
      ]
    );
    return localId;
  }

  // ── Daily stats ─────────────────────────────────────────────────────────────

  getDailyCalories(from: string, to: string): { date: string; calories: number }[] {
    return db.getAllSync(
      `SELECT fl.date,
              COALESCE(SUM(fi.calories * fl.servingQty), 0) AS calories
       FROM food_logs fl
       LEFT JOIN food_items fi ON fl.foodItemLocalId = fi.localId
       WHERE fl.date >= ? AND fl.date <= ? AND fl.deleted = 0
       GROUP BY fl.date
       ORDER BY fl.date`,
      [from, to]
    ) as any[];
  }

  getDayTotals(date: string): DayNutrients {
    const row = db.getFirstSync(
      `SELECT
         COALESCE(SUM(fi.calories * fl.servingQty), 0) AS calories,
         COALESCE(SUM(fi.protein  * fl.servingQty), 0) AS protein,
         COALESCE(SUM(fi.carbs    * fl.servingQty), 0) AS carbs,
         COALESCE(SUM(fi.fat      * fl.servingQty), 0) AS fat,
         COALESCE(SUM(fi.fiber    * fl.servingQty), 0) AS fiber,
         COALESCE(SUM(fi.sugar    * fl.servingQty), 0) AS sugar,
         COALESCE(SUM(fi.sodium   * fl.servingQty), 0) AS sodium,
         COALESCE(SUM(fi.saturatedFat * fl.servingQty), 0) AS saturatedFat
       FROM food_logs fl
       LEFT JOIN food_items fi ON fl.foodItemLocalId = fi.localId
       WHERE fl.date = ? AND fl.deleted = 0`,
      [date]
    ) as any;
    const totals: DayNutrients = {
      calories: row?.calories ?? 0,
      protein: row?.protein ?? 0,
      carbs: row?.carbs ?? 0,
      fat: row?.fat ?? 0,
      fiber: row?.fiber ?? 0,
      sugar: row?.sugar ?? 0,
      sodium: row?.sodium ?? 0,
      saturatedFat: row?.saturatedFat ?? 0,
    };
    // Add recipe-based logs (per-serving nutrition × servings logged).
    const recipeLogs = db.getAllSync(
      `SELECT recipeLocalId, servingQty FROM food_logs
       WHERE date = ? AND deleted = 0 AND recipeLocalId IS NOT NULL`,
      [date]
    ) as any[];
    if (recipeLogs.length) {
      const nutri = this.getRecipeNutritionMap();
      for (const r of recipeLogs) {
        const n = nutri.get(r.recipeLocalId);
        if (!n) continue;
        totals.calories += n.calories * r.servingQty;
        totals.protein += n.protein * r.servingQty;
        totals.carbs += n.carbs * r.servingQty;
        totals.fat += n.fat * r.servingQty;
        totals.fiber += n.fiber * r.servingQty;
        totals.sugar += n.sugar * r.servingQty;
        totals.sodium += n.sodium * r.servingQty;
        totals.saturatedFat += n.saturatedFat * r.servingQty;
      }
    }
    return totals;
  }

  /** Per-serving nutrition for every recipe, in one query. */
  getRecipeNutritionMap(): Map<string, DayNutrients> {
    const rows = db.getAllSync(
      `SELECT r.localId AS rid, r.servings AS servings,
              COALESCE(SUM(fi.calories * ri.quantity), 0) AS cal,
              COALESCE(SUM(fi.protein  * ri.quantity), 0) AS p,
              COALESCE(SUM(fi.carbs    * ri.quantity), 0) AS c,
              COALESCE(SUM(fi.fat      * ri.quantity), 0) AS f,
              COALESCE(SUM(fi.fiber    * ri.quantity), 0) AS fib,
              COALESCE(SUM(fi.sugar    * ri.quantity), 0) AS sug,
              COALESCE(SUM(fi.sodium   * ri.quantity), 0) AS sod,
              COALESCE(SUM(fi.saturatedFat * ri.quantity), 0) AS satf
       FROM recipes r
       LEFT JOIN recipe_ingredients ri ON ri.recipeLocalId = r.localId
       LEFT JOIN food_items fi ON ri.foodItemLocalId = fi.localId
       WHERE r.deleted = 0
       GROUP BY r.localId`
    ) as any[];
    const map = new Map<string, DayNutrients>();
    for (const row of rows) {
      const s = row.servings || 1;
      map.set(row.rid, {
        calories: row.cal / s, protein: row.p / s, carbs: row.c / s, fat: row.f / s,
        fiber: row.fib / s, sugar: row.sug / s, sodium: row.sod / s, saturatedFat: row.satf / s,
      });
    }
    return map;
  }

  /**
   * Aggregate a recipe's full nutrition **per serving** from its ingredients:
   * core extras (fiber/sugar/sodium/sat-fat) + extended nutriments (grams) summed
   * × ingredient quantity ÷ servings, plus the union of ingredient allergens/additives.
   * Lets a recipe render in the rich `FoodQuantitySheet` like any scanned food.
   */
  getRecipeBreakdown(recipeLocalId: string): {
    core: { fiber: number | null; sugar: number | null; sodium: number | null; saturatedFat: number | null };
    details: FoodDetails | null;
  } | null {
    const recipe = db.getFirstSync(
      `SELECT servings FROM recipes WHERE localId = ? AND deleted = 0`, [recipeLocalId]
    ) as any;
    if (!recipe) return null;
    const servings = recipe.servings || 1;
    const rows = db.getAllSync(
      `SELECT ri.quantity AS qty, fi.fiber, fi.sugar, fi.sodium, fi.saturatedFat, fi.detailsJson
       FROM recipe_ingredients ri
       JOIN food_items fi ON ri.foodItemLocalId = fi.localId
       WHERE ri.recipeLocalId = ?`,
      [recipeLocalId]
    ) as any[];

    const acc = { fiber: 0, sugar: 0, sodium: 0, saturatedFat: 0 };
    const has = { fiber: false, sugar: false, sodium: false, saturatedFat: false };
    const nutriSum = new Map<string, number>();
    const allergens = new Set<string>();
    const additives = new Set<string>();

    for (const r of rows) {
      const q = r.qty || 0;
      (['fiber', 'sugar', 'sodium', 'saturatedFat'] as const).forEach((k) => {
        if (r[k] != null) { acc[k] += r[k] * q; has[k] = true; }
      });
      const d = parseDetails(r.detailsJson);
      d?.nutriments?.forEach((n) => nutriSum.set(n.key, (nutriSum.get(n.key) ?? 0) + n.value * q));
      d?.allergens?.forEach((a) => allergens.add(a));
      d?.additives?.forEach((a) => additives.add(a));
    }

    const perServing = (v: number) => v / servings;
    const nutriments = [...nutriSum].map(([key, value]) => ({ key, value: perServing(value) }));
    const details: FoodDetails = {
      nutriments,
      nutriScore: null, novaGroup: null, ecoScore: null, nutrientLevels: null, ingredientsText: null,
      allergens: allergens.size ? [...allergens] : null,
      additives: additives.size ? [...additives] : null,
      labels: null, // diet labels need AND across ingredients — omit to avoid false positives
    };
    return {
      core: {
        fiber: has.fiber ? perServing(acc.fiber) : null,
        sugar: has.sugar ? perServing(acc.sugar) : null,
        sodium: has.sodium ? perServing(acc.sodium) : null,
        saturatedFat: has.saturatedFat ? perServing(acc.saturatedFat) : null,
      },
      details: nutriments.length || details.allergens || details.additives ? details : null,
    };
  }

  // ── Recipes ─────────────────────────────────────────────────────────────────

  getRecipes(): Recipe[] {
    const rows = db.getAllSync(
      `SELECT * FROM recipes WHERE deleted = 0 ORDER BY name`
    ) as any[];
    return rows.map((row) => {
      const ingRows = db.getAllSync(
        `SELECT ri.*, fi.localId AS fi_localId, fi.name AS fi_name,
                fi.servingSize AS fi_servingSize, fi.servingUnit AS fi_servingUnit,
                fi.calories AS fi_calories, fi.protein AS fi_protein,
                fi.carbs AS fi_carbs, fi.fat AS fi_fat,
                fi.brand AS fi_brand, fi.barcode AS fi_barcode,
                fi.source AS fi_source, fi.isCustom AS fi_isCustom,
                fi.fiber AS fi_fiber, fi.sugar AS fi_sugar, fi.sodium AS fi_sodium,
                fi.saturatedFat AS fi_saturatedFat,
                fi.updatedAt AS fi_updatedAt
         FROM recipe_ingredients ri
         JOIN food_items fi ON ri.foodItemLocalId = fi.localId
         WHERE ri.recipeLocalId = ?`,
        [row.localId]
      ) as any[];
      const ingredients: RecipeIngredient[] = ingRows.map((ir) => ({
        id: ir.localId,
        foodItem: mapFoodItem({ ...ir, localId: ir.fi_localId, name: ir.fi_name, servingSize: ir.fi_servingSize, servingUnit: ir.fi_servingUnit, calories: ir.fi_calories, protein: ir.fi_protein, carbs: ir.fi_carbs, fat: ir.fi_fat, brand: ir.fi_brand, barcode: ir.fi_barcode, source: ir.fi_source, isCustom: ir.fi_isCustom, fiber: ir.fi_fiber, sugar: ir.fi_sugar, sodium: ir.fi_sodium, saturatedFat: ir.fi_saturatedFat, updatedAt: ir.fi_updatedAt }),
        quantity: ir.quantity,
      }));
      const recipe = mapRecipe(row, ingredients);
      // Compute nutrition
      const total = ingredients.reduce(
        (acc, ing) => ({
          cal: acc.cal + ing.foodItem.calories * ing.quantity,
          p: acc.p + ing.foodItem.protein * ing.quantity,
          c: acc.c + ing.foodItem.carbs * ing.quantity,
          f: acc.f + ing.foodItem.fat * ing.quantity,
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      );
      const s = recipe.servings || 1;
      recipe.nutrition = {
        totalCalories: total.cal,
        totalProtein: total.p,
        totalCarbs: total.c,
        totalFat: total.f,
        perServingCalories: total.cal / s,
        perServingProtein: total.p / s,
        perServingCarbs: total.c / s,
        perServingFat: total.f / s,
      };
      return recipe;
    });
  }

  createRecipe(input: {
    name: string;
    description?: string | null;
    servings: number;
    ingredients: Array<{ foodItemLocalId: string; quantity: number }>;
  }): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO recipes (localId, name, description, servings, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [localId, input.name, input.description ?? null, input.servings, new Date().toISOString()]
    );
    for (const ing of input.ingredients) {
      db.runSync(
        `INSERT INTO recipe_ingredients (localId, recipeLocalId, foodItemLocalId, quantity)
         VALUES (?, ?, ?, ?)`,
        [Crypto.randomUUID(), localId, ing.foodItemLocalId, ing.quantity]
      );
    }
    return localId;
  }

  updateRecipe(localId: string, input: {
    name: string;
    description?: string | null;
    servings: number;
    ingredients: Array<{ foodItemLocalId: string; quantity: number }>;
  }): void {
    db.runSync(
      `UPDATE recipes SET name = ?, description = ?, servings = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [input.name, input.description ?? null, input.servings, new Date().toISOString(), localId]
    );
    db.runSync(`DELETE FROM recipe_ingredients WHERE recipeLocalId = ?`, [localId]);
    for (const ing of input.ingredients) {
      db.runSync(
        `INSERT INTO recipe_ingredients (localId, recipeLocalId, foodItemLocalId, quantity)
         VALUES (?, ?, ?, ?)`,
        [Crypto.randomUUID(), localId, ing.foodItemLocalId, ing.quantity]
      );
    }
  }

  deleteRecipe(localId: string): void {
    db.runSync(
      `UPDATE recipes SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  upsertRecipeFromServer(recipe: Recipe): string {
    const existing = recipe.id
      ? (db.getFirstSync(`SELECT localId FROM recipes WHERE serverId = ?`, [recipe.id]) as any)
      : null;
    const localId = existing?.localId ?? Crypto.randomUUID();
    db.runSync(
      `INSERT OR REPLACE INTO recipes (localId, serverId, name, description, servings, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'synced', ?)`,
      [localId, recipe.id, recipe.name, recipe.description ?? null, recipe.servings, recipe.updatedAt]
    );
    return localId;
  }

  // Upsert food items from a server sync response (bulk)
  upsertManyFoodItems(items: FoodItem[]): void {
    for (const item of items) {
      this.upsertFoodItem({
        ...item,
        serverId: item.id,
      });
    }
  }
}

export const foodRepo = new FoodRepo();
