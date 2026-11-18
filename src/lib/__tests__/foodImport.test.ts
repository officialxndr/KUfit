import { describe, it, expect, jest } from '@jest/globals';

// foodSearch / nutritionOcr pull in the SQLite repo and the native ML Kit module at import time;
// the pure parsers under test touch neither.
jest.mock('@/lib/repositories/FoodRepo', () => ({ foodRepo: {} }));
jest.mock('@react-native-ml-kit/text-recognition', () => ({ __esModule: true, default: { recognize: jest.fn() } }));

import { offNutrition, offServingText, offProductToCandidate } from '@/lib/foodSearch';
import { parseServing, parseNutritionText } from '@/lib/nutritionOcr';
import { amountToServings, householdUnit, unitsForFood } from '@/lib/servingUnits';

/** kcal logged for `amount unit` of a parsed candidate — the full import → log path. */
const logged = (c: { servingSize: number; servingUnit: string; servingText?: string | null; calories: number }, amount: number, unit: string) =>
  c.calories * amountToServings(c, amount, unit);

describe('Open Food Facts → candidate', () => {
  it('per-100 g + a numeric serving weight: scales to the serving, grams stay correct', () => {
    // Oreo-style: 3 cookies (34 g), 471 kcal/100 g.
    const c = offProductToCandidate({
      product_name: 'Chocolate Sandwich Cookies', code: '044000032029', brands: 'Oreo',
      serving_size: '3 cookies (34 g)', serving_quantity: 34, serving_quantity_unit: 'g',
      nutriments: { 'energy-kcal_100g': 471, proteins_100g: 2.9, carbohydrates_100g: 70.6, fat_100g: 20.6, sodium_100g: 0.38 },
    })!;
    expect(c.servingSize).toBe(34);
    expect(c.servingUnit).toBe('g');
    expect(c.calories).toBeCloseTo(160.1, 1);
    expect(c.sodium).toBeCloseTo(129.2, 1); // g → mg, scaled to the serving
    expect(c.servingText).toBe('3 cookies');
    expect(logged(c, 100, 'g')).toBeCloseTo(471, 6);
    expect(householdUnit(c)?.key).toBe('cookie');
    expect(logged(c, 1, 'cookie')).toBeCloseTo(53.4, 1);
    expect(unitsForFood(c)).toContain('cookie');
  });

  it('regression: free-text "30 g" serving never multiplies per-100 g calories into thousands', () => {
    const n = offNutrition({ serving_size: '30 g', nutriments: { 'energy-kcal_100g': 500, 'energy-kcal_serving': 150 } })!;
    expect(n.servingSize).toBe(100); // no numeric serving_quantity → stays on the per-100 g basis
    expect(n.calories).toBe(500);
    expect(n.calories / n.servingSize).toBeLessThanOrEqual(9); // ≤ 9 kcal/g, physically possible
  });

  it('per-serving data only, weight unknown → a serving-only item (no grams to mis-enter)', () => {
    const c = offProductToCandidate({
      product_name: 'Fruit Snacks', serving_size: '1 pouch',
      nutriments: { 'energy-kcal_serving': 80, carbohydrates_serving: 19, proteins_serving: 1, fat_serving: 0 },
    })!;
    expect(c.servingUnit).toBe('serving');
    expect(c.servingSize).toBe(1);
    expect(unitsForFood(c)).toEqual(['serving', 'pouch']);
    expect(logged(c, 2, 'pouch')).toBe(160);
  });

  it('per-serving data with a known weight keeps a gram basis', () => {
    const n = offNutrition({ serving_quantity: '40', nutriments: { 'energy-kcal_serving': 190, proteins_serving: 10 } })!;
    expect(n).toMatchObject({ servingSize: 40, servingUnit: 'g', calories: 190, protein: 10 });
  });

  it('drinks with serving_quantity_unit ml get a volume basis', () => {
    const c = offProductToCandidate({
      product_name: 'Cola', serving_size: '1 can (355 ml)', serving_quantity: 355, serving_quantity_unit: 'ml',
      nutriments: { 'energy-kcal_100g': 42, carbohydrates_100g: 10.6 },
    })!;
    expect(c.servingUnit).toBe('ml');
    expect(c.calories).toBeCloseTo(149.1, 1);
    expect(unitsForFood(c)).toContain('fl oz');
    expect(logged(c, 12, 'fl oz')).toBeCloseTo(149.4, 0);
    expect(logged(c, 1, 'can')).toBeCloseTo(149.1, 1);
  });

  it('older drink records missing serving_quantity_unit infer ml from the text', () => {
    const n = offNutrition({ serving_size: '250 ml', serving_quantity: 250, nutriments: { 'energy-kcal_100g': 45 } })!;
    expect(n.servingUnit).toBe('ml');
  });

  it('a serving text naming both g and ml stays on grams', () => {
    const n = offNutrition({ serving_size: '30 g (40 ml)', serving_quantity: 30, nutriments: { 'energy-kcal_100g': 400 } })!;
    expect(n.servingUnit).toBe('g');
  });

  it('skips products with no calorie data, explicit 0, no name, or ingredient-dump names', () => {
    expect(offNutrition({ nutriments: {} })).toBeNull();
    expect(offNutrition({ nutriments: { 'energy-kcal_100g': 0 } })).toBeNull();
    expect(offProductToCandidate({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    expect(offProductToCandidate({ product_name: 'x'.repeat(121), nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
  });

  it('a contradictory 0 per-100 g falls back to valid per-serving values', () => {
    const n = offNutrition({ serving_quantity: 50, nutriments: { 'energy-kcal_100g': 0, 'energy-kcal_serving': 220 } })!;
    expect(n.calories).toBe(220);
    expect(n.servingSize).toBe(50);
  });

  it('non-numeric junk in nutriments never becomes NaN', () => {
    const n = offNutrition({ serving_quantity: 'abc', nutriments: { 'energy-kcal_100g': 250, proteins_100g: 'n/a', fat_100g: null } })!;
    expect(n.servingSize).toBe(100);
    expect(n.protein).toBe(0);
    expect(n.fat).toBe(0);
    expect(Number.isNaN(n.calories)).toBe(false);
  });

  it('no household text when the serving is the 100 g fallback (it would describe a different amount)', () => {
    const c = offProductToCandidate({ product_name: 'Crackers', serving_size: '5 crackers', nutriments: { 'energy-kcal_100g': 440 } })!;
    expect(c.servingSize).toBe(100);
    expect(c.servingText).toBeNull();
  });
});

describe('offServingText', () => {
  it.each<[unknown, string | null]>([
    ['3 cookies (34 g)', '3 cookies'],
    ['1 bar (40g)', '1 bar'],
    ['2 tbsp (32 g)', '2 tbsp'],
    ['1 can (355 ml)', '1 can'],
    ['30 g', null],
    ['250ml', null],
    ['1 serving', null],
    ['1 portion (30 g)', null],
    ['(30 g)', null],
    ['', null],
    [null, null],
    [42, null],
    ['an extremely long serving description that nobody would ever type in', null],
  ])('%p → %p', (raw, want) => expect(offServingText(raw)).toBe(want));
});

describe('label scan: "Serving size" line', () => {
  it.each<[string, Record<string, unknown>]>([
    ['Serving size 2/3 cup (55g)', { servingSize: 55, servingUnit: 'g', servingText: '2/3 cup' }],
    ['Serving Size 1 bar (40 g)', { servingSize: 40, servingUnit: 'g', servingText: '1 bar' }],
    ['Serving size 8 fl oz (240mL)', { servingSize: 240, servingUnit: 'ml', servingText: '8 fl oz' }],
    ['Serving size 28g', { servingSize: 28, servingUnit: 'g' }],
    ['Serving size: 3 cookies (30g)', { servingSize: 30, servingUnit: 'g', servingText: '3 cookies' }],
    ['Serving size 27,5 g', { servingSize: 27.5, servingUnit: 'g' }],
    // No metric weight — regression: "2/3 cup" used to read as 2 g.
    ['Serving size 2/3 cup', { servingSize: 0.67, servingUnit: 'cup', servingText: '2/3 cup' }],
    ['Serving size 1 1/2 tbsp', { servingSize: 1.5, servingUnit: 'tbsp' }],
    ['Serving size 1 cup', { servingSize: 1, servingUnit: 'cup' }],
    ['Serving size 2 slices', { servingSize: 1, servingUnit: 'serving', servingText: '2 slices' }],
    ['Serving size 1', { servingSize: 1, servingUnit: 'serving' }],
  ])('%p', (line, want) => expect(parseServing([line])).toMatchObject(want));

  it('no serving line → nothing guessed', () => {
    expect(parseServing(['Calories 200'])).toEqual({});
  });

  it('a full scanned label imports and logs per cookie', () => {
    const p = parseNutritionText([
      'Nutrition Facts', '8 servings per container', 'Serving size 3 cookies (30g)',
      'Calories 140', 'Total Fat 7g 9%', 'Sodium 105mg 5%', 'Total Carbohydrate 19g 7%', 'Total Sugars 10g', 'Protein 2g',
    ].join('\n'));
    expect(p).toMatchObject({ servingSize: 30, servingUnit: 'g', servingText: '3 cookies', calories: 140, fat: 7, protein: 2 });
    const food = { servingSize: p.servingSize!, servingUnit: p.servingUnit!, servingText: p.servingText, calories: p.calories! };
    expect(logged(food, 1, 'cookie')).toBeCloseTo(46.7, 1);
    expect(logged(food, 45, 'g')).toBeCloseTo(210, 6);
  });
});
