import type { ParsedNutrition } from '@/lib/nutritionOcr';

/**
 * JSON schema mirroring `ParsedNutrition`, fed to llama.rn's `response_format`
 * (`type: 'json_schema'`). llama.cpp converts it to a GBNF grammar internally and
 * constrains decoding, so the model can *only* emit a well-formed object with these
 * keys — the single biggest reliability win over "ask for JSON and hope". Every field
 * is optional (the model omits what it can't read); the parser still range-validates.
 */
export const NUTRITION_SCHEMA = {
  type: 'object',
  properties: {
    servingSize: { type: 'number', description: 'Serving weight (number only)' },
    servingUnit: { type: 'string', description: 'Serving unit, e.g. g, ml, oz, cup' },
    servingText: { type: 'string', description: 'Household serving description if the label shows one, e.g. "2 cookies", "3 crackers"' },
    calories: { type: 'number' },
    protein: { type: 'number', description: 'grams' },
    carbs: { type: 'number', description: 'grams' },
    fat: { type: 'number', description: 'grams' },
    saturatedFat: { type: 'number', description: 'grams' },
    fiber: { type: 'number', description: 'grams' },
    sugar: { type: 'number', description: 'grams' },
    sodium: { type: 'number', description: 'milligrams' },
  },
  additionalProperties: false,
} as const;

/** Whole-plate meal estimation — a name + total macros for the portion shown in a photo
 *  (vs. NUTRITION_SCHEMA which reads a printed label). Fed to the same vision pipeline. */
export const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    // First on purpose: making the model lay out its working before the totals
    // measurably improves the numbers (structured chain-of-thought under the grammar).
    breakdown: { type: 'string', description: 'Brief working: each visible food, its portion, and its calories, then summed — e.g. "8 pizza slices x ~285 = 2280; soda ~150 => 2430"' },
    name: { type: 'string', description: 'Short name of the dish or meal' },
    calories: { type: 'number', description: 'TOTAL kcal for the whole portion shown (the sum from breakdown)' },
    protein: { type: 'number', description: 'grams' },
    carbs: { type: 'number', description: 'grams' },
    fat: { type: 'number', description: 'grams' },
  },
  additionalProperties: false,
} as const;

export const MEAL_SCHEMA_HINT =
  '{ breakdown?: string, name?: string, calories: number, protein?: number, carbs?: number, fat?: number }';

/** Plain-English schema line embedded in the prompt (belt-and-suspenders with the grammar). */
export const SCHEMA_HINT =
  '{ servingSize?: number, servingUnit?: string, servingText?: string, calories?: number, protein?: number, ' +
  'carbs?: number, fat?: number, saturatedFat?: number, fiber?: number, sugar?: number, ' +
  'sodium?: number }';

export type NutritionKey = keyof ParsedNutrition;
