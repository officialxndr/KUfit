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

/** Plain-English schema line embedded in the prompt (belt-and-suspenders with the grammar). */
export const SCHEMA_HINT =
  '{ servingSize?: number, servingUnit?: string, calories?: number, protein?: number, ' +
  'carbs?: number, fat?: number, saturatedFat?: number, fiber?: number, sugar?: number, ' +
  'sodium?: number }';

export type NutritionKey = keyof ParsedNutrition;
