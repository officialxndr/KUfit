import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';
import type { FoodItem, FoodLog, MealType, Recipe, RecipeIngredient } from '@/types';

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
    source: row.source ?? 'MANUAL',
    isCustom: !!row.isCustom,
    createdAt: row.updatedAt ?? new Date().toISOString(),
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
        source: row.fi_source ?? 'MANUAL',
        isCustom: !!row.fi_isCustom,
        createdAt: row.fi_updatedAt ?? new Date().toISOString(),
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
         fl.localId, fl.date, fl.meal, fl.servingQty, fl.updatedAt,
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
         fi.source    AS fi_source,
         fi.isCustom  AS fi_isCustom,
         fi.updatedAt AS fi_updatedAt
       FROM food_logs fl
       LEFT JOIN food_items fi ON fl.foodItemLocalId = fi.localId
       WHERE fl.date = ? AND fl.deleted = 0
       ORDER BY fl.rowid`,
      [date]
    );
    return (rows as any[]).map(mapFoodLog);
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
          calories, protein, carbs, fat, fiber, sugar, sodium, source, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
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
        item.source ?? 'MANUAL',
        item.isCustom ? 1 : 0,
        new Date().toISOString(),
      ]
    );
    return localId;
  }

  createCustomFoodItem(item: Omit<FoodItem, 'id' | 'createdAt'>): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO food_items
         (localId, name, brand, barcode, servingSize, servingUnit,
          calories, protein, carbs, fat, fiber, sugar, sodium, source, isCustom, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', 1, 'pending', ?)`,
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

  getDayTotals(date: string): { calories: number; protein: number; carbs: number; fat: number } {
    const row = db.getFirstSync(
      `SELECT
         COALESCE(SUM(fi.calories * fl.servingQty), 0) AS calories,
         COALESCE(SUM(fi.protein  * fl.servingQty), 0) AS protein,
         COALESCE(SUM(fi.carbs    * fl.servingQty), 0) AS carbs,
         COALESCE(SUM(fi.fat      * fl.servingQty), 0) AS fat
       FROM food_logs fl
       LEFT JOIN food_items fi ON fl.foodItemLocalId = fi.localId
       WHERE fl.date = ? AND fl.deleted = 0`,
      [date]
    ) as any;
    return {
      calories: row?.calories ?? 0,
      protein: row?.protein ?? 0,
      carbs: row?.carbs ?? 0,
      fat: row?.fat ?? 0,
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
                fi.updatedAt AS fi_updatedAt
         FROM recipe_ingredients ri
         JOIN food_items fi ON ri.foodItemLocalId = fi.localId
         WHERE ri.recipeLocalId = ?`,
        [row.localId]
      ) as any[];
      const ingredients: RecipeIngredient[] = ingRows.map((ir) => ({
        id: ir.localId,
        foodItem: mapFoodItem({ ...ir, localId: ir.fi_localId, name: ir.fi_name, servingSize: ir.fi_servingSize, servingUnit: ir.fi_servingUnit, calories: ir.fi_calories, protein: ir.fi_protein, carbs: ir.fi_carbs, fat: ir.fi_fat, brand: ir.fi_brand, barcode: ir.fi_barcode, source: ir.fi_source, isCustom: ir.fi_isCustom, fiber: ir.fi_fiber, sugar: ir.fi_sugar, sodium: ir.fi_sodium, updatedAt: ir.fi_updatedAt }),
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
