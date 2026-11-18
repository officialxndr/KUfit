import { describe, it, expect } from '@jest/globals';
import {
  householdUnit, unitsForFood, unitLabel,
  normalizeUnit, unitKind, unitsFor, isUnitValidFor, amountToServings, servingsToAmount, convertAmount,
  roundAmount, parseAmount, parseNonNegative, initialSheetEntry, describeLoggedAmount, describeServing,
  type ServingBasis,
} from '@/lib/servingUnits';
import baseFoods from '../../../assets/foods/base-ingredients.json';

/** A food as the quantity sheet sees it: nutrition per one serving of `servingSize servingUnit`. */
interface TestFood extends ServingBasis { name: string; calories: number; protein: number; carbs: number; fat: number }
const kcal = (f: TestFood, amount: number, unit: string) => f.calories * amountToServings(f, amount, unit);

// ── A pantry of realistic foods across every serving shape the app sees ─────────────────────
const chicken: TestFood = { name: 'Chicken breast (base, per 100 g)', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6 };
const rice: TestFood = { name: 'White rice cooked (base)', servingSize: 100, servingUnit: 'g', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 };
const proteinBar: TestFood = { name: 'Protein bar (OFF, 60 g serving)', servingSize: 60, servingUnit: 'g', calories: 210, protein: 20, carbs: 22, fat: 7 };
const milk: TestFood = { name: '2% milk (OFF, 240 ml serving)', servingSize: 240, servingUnit: 'ml', calories: 122, protein: 8, carbs: 12, fat: 4.8 };
const soda: TestFood = { name: 'Cola can (355 ml)', servingSize: 355, servingUnit: 'ml', calories: 140, protein: 0, carbs: 39, fat: 0 };
const oliveOil: TestFood = { name: 'Olive oil (custom, "1 Tbsp")', servingSize: 1, servingUnit: 'Tbsp', calories: 119, protein: 0, carbs: 0, fat: 13.5 };
const steak: TestFood = { name: 'Ribeye (custom, per 4 oz)', servingSize: 4, servingUnit: 'oz', calories: 310, protein: 24, carbs: 0, fat: 23 };
const groundBeef: TestFood = { name: 'Ground beef (custom, per 1 lb)', servingSize: 1, servingUnit: 'lbs', calories: 1152, protein: 77, carbs: 0, fat: 92 };
const granola: TestFood = { name: 'Granola (custom, "Grams")', servingSize: 45, servingUnit: 'Grams', calories: 200, protein: 5, carbs: 29, fat: 8 };
const bread: TestFood = { name: 'Sourdough (custom, per slice)', servingSize: 1, servingUnit: 'slice', calories: 120, protein: 4, carbs: 23, fat: 1 };
const quickAdd: TestFood = { name: 'Quick add', servingSize: 1, servingUnit: 'serving', calories: 650, protein: 30, carbs: 70, fat: 25 };
const chili: TestFood = { name: 'Chili recipe (350 g/serving)', servingSize: 350, servingUnit: 'g', calories: 420, protein: 32, carbs: 30, fat: 18 };
const offServingOnly: TestFood = { name: 'Candy (OFF, per-serving only)', servingSize: 1, servingUnit: 'serving', calories: 90, protein: 1, carbs: 18, fat: 2 };
const broth: TestFood = { name: 'Broth (custom, per cup)', servingSize: 1, servingUnit: 'cups', calories: 15, protein: 3, carbs: 0, fat: 0 };
const wine: TestFood = { name: 'Wine (custom, per 1 L bottle)', servingSize: 1, servingUnit: 'Liter', calories: 830, protein: 0, carbs: 26, fat: 0 };

describe('normalizeUnit', () => {
  it.each([
    ['g', 'g'], ['G', 'g'], ['gram', 'g'], ['Grams', 'g'], ['gr', 'g'], [' g ', 'g'],
    ['kg', 'kg'], ['Kilograms', 'kg'],
    ['oz', 'oz'], ['OZ', 'oz'], ['ounces', 'oz'], ['oz.', 'oz'],
    ['lb', 'lb'], ['lbs', 'lb'], ['Pounds', 'lb'],
    ['ml', 'ml'], ['mL', 'ml'], ['ML', 'ml'], ['millilitres', 'ml'], ['cc', 'ml'],
    ['l', 'l'], ['L', 'l'], ['litre', 'l'], ['Liters', 'l'],
    ['tsp', 'tsp'], ['Teaspoons', 'tsp'], ['t', 'tsp'],
    ['tbsp', 'tbsp'], ['Tbsp', 'tbsp'], ['TBSP', 'tbsp'], ['tbs', 'tbsp'], ['T', 'tbsp'], ['tablespoon', 'tbsp'],
    ['cup', 'cup'], ['Cups', 'cup'],
    ['fl oz', 'fl oz'], ['fl. oz.', 'fl oz'], ['FL OZ', 'fl oz'], ['floz', 'fl oz'], ['fluid ounces', 'fl oz'], ['fl  oz', 'fl oz'],
    ['serving', 'serving'], ['Servings', 'serving'],
  ])('%p → %p', (raw, want) => expect(normalizeUnit(raw)).toBe(want));

  it.each(['slice', 'bar', 'cookie', 'piece', 'container', '', '   ', 'gallon?'])('%p is not measurable', (raw) => {
    expect(normalizeUnit(raw)).toBeNull();
  });

  it('handles null/undefined', () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
  });
});

describe('unitsFor / unitKind', () => {
  it('mass foods get mass units, volume foods volume units, others serving only', () => {
    expect(unitsFor('g')).toEqual(['serving', 'g', 'oz', 'lb']);
    expect(unitsFor('Grams')).toEqual(['serving', 'g', 'oz', 'lb']); // free-text custom unit
    expect(unitsFor('oz')).toContain('g');
    expect(unitsFor('ml')).toEqual(['serving', 'ml', 'fl oz', 'cup', 'tbsp', 'tsp']);
    expect(unitsFor('Tbsp')).toContain('tsp');
    expect(unitsFor('slice')).toEqual(['serving']);
    expect(unitsFor('serving')).toEqual(['serving']);
    expect(unitsFor(undefined)).toEqual(['serving']);
  });

  it('never mixes mass and volume (no density data)', () => {
    expect(unitsFor('g')).not.toContain('ml');
    expect(unitsFor('g')).not.toContain('cup');
    expect(unitsFor('ml')).not.toContain('g');
    expect(isUnitValidFor('g', 'tbsp')).toBe(false);
    expect(isUnitValidFor('ml', 'oz')).toBe(false); // weight oz ≠ fluid oz
    expect(isUnitValidFor('ml', 'fl oz')).toBe(true);
    expect(isUnitValidFor('slice', 'g')).toBe(false);
    expect(isUnitValidFor('slice', 'serving')).toBe(true);
  });

  it('classifies', () => {
    expect(unitKind('lbs')).toBe('mass');
    expect(unitKind('fl. oz')).toBe('volume');
    expect(unitKind('bar')).toBe('serving');
  });
});

describe('logging real foods in different units', () => {
  // [food, amount, unit, expected kcal]
  it.each<[TestFood, number, string, number]>([
    // Base food per 100 g
    [chicken, 1, 'serving', 165],
    [chicken, 150, 'g', 247.5],
    [chicken, 6, 'oz', 280.6], // 170.1 g
    [chicken, 1, 'lb', 748.4],
    [chicken, 0.5, 'lb', 374.2],
    [rice, 158, 'g', 205.4], // "1 cup" quick portion
    [rice, 2.5, 'serving', 325],
    // OFF product with a 60 g serving
    [proteinBar, 1, 'serving', 210],
    [proteinBar, 30, 'g', 105],
    [proteinBar, 1, 'oz', 99.2],
    // Drinks (ml basis)
    [milk, 1, 'cup', 120.3],
    [milk, 8, 'fl oz', 120.3],
    [milk, 250, 'ml', 127.1],
    [milk, 2, 'tbsp', 15.0],
    [soda, 12, 'fl oz', 139.9],
    [soda, 1, 'serving', 140],
    // Custom foods with free-text units
    [oliveOil, 1, 'tbsp', 119],
    [oliveOil, 1, 'tsp', 39.7],
    [oliveOil, 2, 'tsp', 79.3],
    [oliveOil, 15, 'ml', 120.7],
    [steak, 8, 'oz', 620],
    [steak, 200, 'g', 546.8],
    [groundBeef, 0.25, 'lb', 288],
    [groundBeef, 113, 'g', 287.0],
    [granola, 45, 'g', 200],
    [granola, 90, 'g', 400],
    [broth, 2, 'cup', 30],
    [broth, 8, 'fl oz', 15.0],
    [wine, 150, 'ml', 124.5],
    // Recipe with a serving weight
    [chili, 175, 'g', 210],
    [chili, 1.5, 'serving', 630],
    // Serving-only foods
    [bread, 2, 'serving', 240],
    [quickAdd, 1, 'serving', 650],
    [offServingOnly, 3, 'serving', 270],
  ])('%#: %s × %p %s', (food, amount, unit, want) => {
    expect(kcal(food, amount, unit)).toBeCloseTo(want, 0);
  });

  it('an incompatible unit never yields a silently scaled number', () => {
    // Grams for a slice-based food falls back to servings (the picker never offers it anyway).
    expect(amountToServings(bread, 2, 'g')).toBe(2);
    expect(amountToServings(milk, 1, 'oz')).toBe(1);
  });

  it('zero, negative, NaN and Infinity amounts log nothing', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(amountToServings(chicken, bad, 'g')).toBe(0);
      expect(servingsToAmount(chicken, bad, 'g')).toBe(0);
    }
  });

  it('a corrupt serving size (0 / negative) does not divide by zero', () => {
    const broken = { ...chicken, servingSize: 0 };
    expect(Number.isFinite(amountToServings(broken, 150, 'g'))).toBe(true);
    expect(amountToServings({ ...chicken, servingSize: -5 }, 150, 'g')).toBe(150);
  });
});

describe('switching units keeps the same physical amount', () => {
  it.each<[TestFood, number, string, string, number]>([
    [chicken, 150, 'g', 'oz', 5.29],
    [chicken, 5.29, 'oz', 'g', 150],
    [chicken, 1, 'serving', 'g', 100],
    [chicken, 250, 'g', 'serving', 2.5],
    [chicken, 1, 'lb', 'g', 454],
    [oliveOil, 1, 'tbsp', 'ml', 14.8],
    [milk, 1, 'cup', 'ml', 237],
    [milk, 1, 'serving', 'fl oz', 8.12],
    [milk, 3, 'tsp', 'tbsp', 1],
    [oliveOil, 1, 'serving', 'tsp', 3],
    [proteinBar, 1, 'serving', 'g', 60],
  ])('%#: %s %p %s → %s', (food, amount, from, to, want) => {
    expect(convertAmount(food, amount, from, to)).toBeCloseTo(want, 1);
  });

  it('round-trips through every offered unit without drifting calories (>1%)', () => {
    for (const food of [chicken, rice, proteinBar, milk, soda, oliveOil, steak, granola, chili]) {
      const start = kcal(food, 1, 'serving');
      for (const u of unitsFor(food.servingUnit)) {
        const there = convertAmount(food, 1, 'serving', u);
        const back = kcal(food, there, u);
        expect(Math.abs(back - start) / start).toBeLessThan(0.01);
      }
    }
  });
});

describe('roundAmount', () => {
  it('whole grams/ml from 100, finer for small and household units', () => {
    expect(roundAmount(149.6, 'g')).toBe(150);
    expect(roundAmount(4.53, 'g')).toBe(4.5);
    expect(roundAmount(5.2911, 'oz')).toBe(5.29);
    expect(roundAmount(0.3333, 'serving')).toBe(0.333); // <1 of a coarse unit keeps 3 decimals
    expect(roundAmount(14.787, 'ml')).toBe(14.8); // 1 tbsp — a decimal under 100 g/ml
    expect(roundAmount(0.132, 'lb')).toBe(0.132);
    expect(roundAmount(0.25, 'cup')).toBe(0.25);
  });
});

describe('parseAmount (what users type)', () => {
  it.each<[string, number]>([
    ['150', 150], ['1.5', 1.5], ['1,5', 1.5], ['.5', 0.5], [',5', 0.5], ['2.', 2], ['0.25', 0.25],
    ['1/2', 0.5], ['3/4', 0.75], ['1 1/2', 1.5], ['2 1/4', 2.25], ['1 / 3', 1 / 3],
    ['½', 0.5], ['1½', 1.5], ['1 ½', 1.5], ['¾', 0.75], ['⅓', 1 / 3],
    ['  200  ', 200], ['1,250', 1250], ['2,500', 2500], ['1,000.5', 1000.5],
    ['0,125', 0.125], ['12,5', 12.5],
  ])('%p → %p', (text, want) => expect(parseAmount(text)).toBeCloseTo(want, 6));

  it.each(['', '   ', 'abc', '0', '-2', '1/0', '1.2.3', '1,2,3', '--', 'e5', '1e3', 'NaN'])('%p is rejected', (text) => {
    expect(parseAmount(text)).toBeNull();
  });

  it('null/undefined', () => {
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it('parseNonNegative accepts a real zero (label fields), still rejects garbage', () => {
    expect(parseNonNegative('0')).toBe(0);
    expect(parseNonNegative('0.0')).toBe(0);
    expect(parseNonNegative('0,0')).toBe(0);
    expect(parseNonNegative('8,5')).toBe(8.5);
    expect(parseNonNegative('')).toBeNull();
    expect(parseNonNegative('x')).toBeNull();
  });
});

describe('initialSheetEntry (what the quantity sheet opens at)', () => {
  it('add mode: default 1 serving', () => {
    expect(initialSheetEntry(chicken, 1, 0)).toEqual({ amount: '1', unit: 'serving' });
  });

  it('add mode: prefills the last amount + unit when it still fits the food', () => {
    expect(initialSheetEntry({ ...chicken, lastAmount: 180, lastUnit: 'g' }, 1, 0)).toEqual({ amount: '180', unit: 'g' });
    expect(initialSheetEntry({ ...milk, lastAmount: 1.5, lastUnit: 'cup' }, 1, 0)).toEqual({ amount: '1.5', unit: 'cup' });
  });

  it('add mode: ignores a remembered unit that no longer fits (e.g. after a food repair)', () => {
    expect(initialSheetEntry({ ...chicken, lastAmount: 2, lastUnit: 'tbsp' }, 1, 0).unit).toBe('serving');
    expect(initialSheetEntry({ ...bread, lastAmount: 30, lastUnit: 'g' }, 1, 0).unit).toBe('serving');
    expect(initialSheetEntry({ ...chicken, lastAmount: 0, lastUnit: 'g' }, 1, 0).unit).toBe('serving');
  });

  it('edit mode: reopens in the unit the entry was logged in, not as a raw multiplier', () => {
    // Logged 176 g of a per-100 g food → servingQty 1.76.
    expect(initialSheetEntry(chicken, 1.76, 1.76, { amount: 176, unit: 'g' })).toEqual({ amount: '176', unit: 'g' });
    expect(initialSheetEntry(milk, 1.0, 1.0, { amount: 8.12, unit: 'fl oz' })).toEqual({ amount: '8.12', unit: 'fl oz' });
    // Recomputes from servingQty (source of truth), so a stale entry amount can't mislead.
    expect(initialSheetEntry(chicken, 2, 2, { amount: 176, unit: 'g' })).toEqual({ amount: '200', unit: 'g' });
  });

  it('edit mode: an older entry with no saved unit opens as tidy servings', () => {
    expect(initialSheetEntry(chicken, 1.7636, 1.7636, null)).toEqual({ amount: '1.76', unit: 'serving' });
  });

  it('edit mode never uses the item-level last unit (that belongs to a different entry)', () => {
    expect(initialSheetEntry({ ...chicken, lastAmount: 500, lastUnit: 'g' }, 1, 1, null)).toEqual({ amount: '1', unit: 'serving' });
  });
});

describe('describeLoggedAmount (Today list subtitle)', () => {
  it('shows the unit the user entered', () => {
    expect(describeLoggedAmount(chicken, 1.5, { amount: 150, unit: 'g' })).toBe('150 g');
    expect(describeLoggedAmount(milk, 236.588 / 240, { amount: 1, unit: 'cup' })).toBe('1 cup');
    expect(describeLoggedAmount(chicken, 2, { amount: 2, unit: 'serving' })).toBe('2 servings');
    expect(describeLoggedAmount(chicken, 1, { amount: 1, unit: 'serving' })).toBe('1 serving');
  });

  it('older rows (no entry) show the amount in the food’s own unit, never a raw float', () => {
    expect(describeLoggedAmount(chicken, 1.7636)).toBe('176 g');
    expect(describeLoggedAmount(proteinBar, 0.5)).toBe('30 g');
    expect(describeLoggedAmount(oliveOil, 2)).toBe('2 tbsp');
    expect(describeLoggedAmount(bread, 1.333333)).toBe('1.33 servings');
  });

  it('falls back gracefully when the entered unit no longer fits', () => {
    expect(describeLoggedAmount(chicken, 1.5, { amount: 3, unit: 'tbsp' })).toBe('150 g');
  });
});

describe('describeServing', () => {
  it('reads naturally', () => {
    expect(describeServing(chicken)).toBe('100 g');
    expect(describeServing(oliveOil)).toBe('1 tbsp');
    expect(describeServing(quickAdd)).toBe('1 serving');
    expect(describeServing(bread)).toBe('1 slice');
    expect(describeServing({ servingSize: 2, servingUnit: 'serving' })).toBe('2 servings');
  });
});

// ── Every bundled base food, end to end ──────────────────────────────────────────────────────
interface BaseFood { slug: string; name: string; calories: number; protein: number; carbs: number; fat: number; fiber: number; portions?: { label: string; grams: number }[] }
const foods = baseFoods as unknown as BaseFood[];
const asSheet = (f: BaseFood): TestFood => ({ name: f.name, servingSize: 100, servingUnit: 'g', calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat });

describe(`all ${foods.length} base foods`, () => {
  it('have sane per-100 g nutrition', () => {
    for (const f of foods) {
      expect(f.calories).toBeGreaterThanOrEqual(0);
      expect(f.calories).toBeLessThanOrEqual(900); // pure fat is ~884 kcal/100 g
      expect(f.protein + f.carbs + f.fat).toBeLessThanOrEqual(100.5); // can't exceed 100 g of macros
    }
  });

  it('calories roughly agree with 4/4/9 macros (catches swapped/mis-keyed fields)', () => {
    const off: string[] = [];
    for (const f of foods) {
      const atwater = f.protein * 4 + f.carbs * 4 + f.fat * 9;
      // Fiber (~2 kcal/g, often counted in carbs) and alcohol widen the gap; allow 20% or 25 kcal.
      if (Math.abs(atwater - f.calories) > Math.max(25, f.calories * 0.2)) off.push(`${f.slug}: ${f.calories} kcal vs ${Math.round(atwater)} from macros`);
    }
    expect(off).toEqual([]);
  });

  it('every quick-portion chip logs the right calories', () => {
    for (const f of foods) {
      const food = asSheet(f);
      for (const p of f.portions ?? []) {
        expect(p.grams).toBeGreaterThan(0);
        expect(kcal(food, p.grams, 'g')).toBeCloseTo((f.calories * p.grams) / 100, 6);
      }
    }
  });

  it('quick portions are plausible for their label (no 1 tsp = 400 g)', () => {
    const odd: string[] = [];
    const limits: [RegExp, number][] = [[/\btsp\b/i, 15], [/\btbsp\b/i, 40], [/\bcup\b/i, 400], [/\boz\b/i, 30]];
    for (const f of foods) {
      for (const p of f.portions ?? []) {
        for (const [re, perUnit] of limits) {
          if (!re.test(p.label)) continue;
          const n = parseAmount(p.label.match(/^[\d½¼¾⅓⅔.\/ ]+/)?.[0]?.trim() ?? '1') ?? 1;
          if (p.grams > perUnit * n * 1.5) odd.push(`${f.slug} "${p.label}" = ${p.grams} g`);
        }
      }
    }
    expect(odd).toEqual([]);
  });

  it('logging in g / oz / lb / servings agrees for every food', () => {
    for (const f of foods) {
      const food = asSheet(f);
      const per100 = f.calories;
      expect(kcal(food, 100, 'g')).toBeCloseTo(per100, 6);
      expect(kcal(food, 1, 'serving')).toBeCloseTo(per100, 6);
      expect(kcal(food, 100 / 28.3495, 'oz')).toBeCloseTo(per100, 6);
      expect(kcal(food, 100 / 453.592, 'lb')).toBeCloseTo(per100, 6);
    }
  });
});

// ── Household units: "3 cookies" → log 1 cookie ─────────────────────────────────────────────
const cookies: TestFood = { name: 'Chocolate chip cookies (OFF: "3 cookies (30 g)")', servingSize: 30, servingUnit: 'g', servingText: '3 cookies', calories: 150, protein: 2, carbs: 20, fat: 7 };
const cereal: TestFood = { name: 'Cereal (label: "2/3 cup (55g)")', servingSize: 55, servingUnit: 'g', servingText: '2/3 cup', calories: 210, protein: 4, carbs: 46, fat: 2 };
const chips: TestFood = { name: 'Tortilla chips (OFF: "about 12 chips")', servingSize: 28, servingUnit: 'g', servingText: '12 chips', calories: 140, protein: 2, carbs: 18, fat: 7 };
const pbCustom: TestFood = { name: 'Peanut butter (custom "2 tbsp", 32 g)', servingSize: 32, servingUnit: 'g', servingText: '2 tbsp', calories: 190, protein: 7, carbs: 7, fat: 16 };
const barOne: TestFood = { name: 'Granola bar ("1 bar")', servingSize: 40, servingUnit: 'g', servingText: '1 bar', calories: 170, protein: 3, carbs: 26, fat: 6 };
const pizza: TestFood = { name: 'Pizza (serving-only, "2 slices")', servingSize: 1, servingUnit: 'serving', servingText: '2 slices', calories: 560, protein: 24, carbs: 64, fat: 22 };
const patties: TestFood = { name: 'Veggie patties ("2 patties")', servingSize: 142, servingUnit: 'g', servingText: '2 patties', calories: 260, protein: 22, carbs: 12, fat: 14 };
const crackers: TestFood = { name: 'Crackers ("1 1/2 crackers")', servingSize: 15, servingUnit: 'g', servingText: '1 1/2 crackers', calories: 60, protein: 1, carbs: 10, fat: 2 };
const juice: TestFood = { name: 'Juice (ml, "1 cup")', servingSize: 240, servingUnit: 'ml', servingText: '1 cup', calories: 110, protein: 0, carbs: 26, fat: 0 };
const steakOz: TestFood = { name: 'Steak (g, "4 oz")', servingSize: 113, servingUnit: 'g', servingText: '4 oz', calories: 280, protein: 26, carbs: 0, fat: 19 };

describe('household units', () => {
  it.each<[TestFood, string | null, number | null]>([
    [cookies, 'cookie', 3],
    [cereal, 'cup', 2 / 3],
    [chips, 'chip', 12],
    [pbCustom, 'tbsp', 2],
    [barOne, 'bar', 1],
    [pizza, 'slice', 2],
    [patties, 'patty', 2],
    [crackers, 'cracker', 1.5],
    [juice, null, null], // cup already converts for an ml food
    [steakOz, null, null], // oz already converts for a gram food
    [chicken, null, null], // no description
  ])('%#: %s', (food, key, per) => {
    const h = householdUnit(food);
    expect(h?.key ?? null).toBe(key);
    if (per != null) expect(h!.perServing).toBeCloseTo(per, 6);
  });

  it.each([
    '1 serving', '2 servings', '1 container', '30 g', '1 package', 'about', '', 'Serving size', '100 cookies please and thank you',
  ])('%p gives no household unit', (text) => {
    expect(householdUnit({ servingSize: 30, servingUnit: 'g', servingText: text })).toBeNull();
  });

  it('strips the gram part and parentheses: "3 cookies (30 g)"', () => {
    expect(householdUnit({ servingSize: 30, servingUnit: 'g', servingText: '3 Cookies (30 g)' })?.key).toBe('cookie');
  });

  it('is offered in the picker right after "serving"', () => {
    expect(unitsForFood(cookies)).toEqual(['serving', 'cookie', 'g', 'oz', 'lb']);
    expect(unitsForFood(pizza)).toEqual(['serving', 'slice']);
    expect(unitsForFood(chicken)).toEqual(['serving', 'g', 'oz', 'lb']);
  });

  it.each<[TestFood, number, string, number]>([
    [cookies, 1, 'cookie', 50],
    [cookies, 2, 'cookie', 100],
    [cookies, 5, 'cookie', 250],
    [cereal, 1, 'cup', 315],
    [cereal, 0.5, 'cup', 157.5],
    [chips, 6, 'chip', 70],
    [pbCustom, 1, 'tbsp', 95],
    [pizza, 1, 'slice', 280],
    [pizza, 3, 'slice', 840],
    [patties, 1, 'patty', 130],
    [crackers, 3, 'cracker', 120],
  ])('%#: %s × %p %s', (food, amount, unit, want) => {
    expect(kcal(food, amount, unit)).toBeCloseTo(want, 1);
  });

  it('converts between household, servings and grams', () => {
    expect(convertAmount(cookies, 1, 'cookie', 'g')).toBe(10);
    expect(convertAmount(cookies, 45, 'g', 'cookie')).toBe(4.5);
    expect(convertAmount(cookies, 1, 'serving', 'cookie')).toBe(3);
    expect(convertAmount(cereal, 110, 'g', 'cup')).toBeCloseTo(1.33, 2);
  });

  it('pluralizes nicely', () => {
    expect(unitLabel('cookie', 1, cookies)).toBe('cookie');
    expect(unitLabel('cookie', 2, cookies)).toBe('cookies');
    expect(unitLabel('patty', 3, patties)).toBe('patties');
    expect(unitLabel('cup', 2, cereal)).toBe('cup');
  });

  it('remembers and reopens in the household unit', () => {
    expect(initialSheetEntry({ ...cookies, lastAmount: 2, lastUnit: 'cookie' }, 1, 0)).toEqual({ amount: '2', unit: 'cookie' });
    // Logged 2 cookies = 2/3 serving; edit reopens as 2 cookies, not 0.667 servings.
    expect(initialSheetEntry(cookies, 2 / 3, 2 / 3, { amount: 2, unit: 'cookie' })).toEqual({ amount: '2', unit: 'cookie' });
    expect(describeLoggedAmount(cookies, 2 / 3, { amount: 2, unit: 'cookie' })).toBe('2 cookies');
    expect(describeLoggedAmount(pizza, 0.5, { amount: 1, unit: 'slice' })).toBe('1 slice');
  });

  it('a remembered household unit is dropped if the description changes', () => {
    expect(initialSheetEntry({ ...cookies, servingText: null, lastAmount: 2, lastUnit: 'cookie' }, 1, 0).unit).toBe('serving');
  });
});
