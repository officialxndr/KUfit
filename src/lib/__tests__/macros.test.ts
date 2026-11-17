import { describe, it, expect } from '@jest/globals';
import {
  MACRO_PRESETS, macroKcal, macrosFromRatio, splitPct, rescaleToCalories, rebalanceMacro, presetMacros, activePresetKey,
} from '@/lib/macros';

const moderate = MACRO_PRESETS.find((p) => p.key === 'moderate')!;
const lower = MACRO_PRESETS.find((p) => p.key === 'lower')!;
// Gram rounding can move the total by a few kcal (one gram of fat = 9 kcal).
const nearTotal = (kcal: number, target: number) => expect(Math.abs(kcal - target)).toBeLessThanOrEqual(9);

describe('macrosFromRatio', () => {
  it('converts a % split into grams at 4/4/9 kcal per gram', () => {
    const m = macrosFromRatio(2000, moderate); // 30/35/35
    expect(m.protein).toBe(150); // 600 kcal / 4
    expect(m.fat).toBe(78); // 700 kcal / 9 ≈ 77.8
    nearTotal(macroKcal(m), 2000);
  });

  it('never goes negative', () => {
    const m = macrosFromRatio(-100, moderate);
    expect(m).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe('splitPct / activePresetKey', () => {
  it('round-trips every preset', () => {
    for (const p of MACRO_PRESETS) expect(activePresetKey(macrosFromRatio(2400, p))).toBe(p.key);
  });

  it('percentages add up to 100', () => {
    const s = splitPct({ protein: 180, carbs: 200, fat: 70 });
    expect(s.protein + s.carbs + s.fat).toBeCloseTo(100, 6);
  });

  it('falls back to the first preset when empty', () => {
    expect(splitPct({ protein: 0, carbs: 0, fat: 0 }).protein).toBe(MACRO_PRESETS[0].protein);
  });
});

describe('rescaleToCalories', () => {
  it('keeps the ratio when the calorie goal changes', () => {
    const m = macrosFromRatio(2000, lower);
    const r = rescaleToCalories(2500, m);
    nearTotal(macroKcal(r), 2500);
    expect(activePresetKey(r)).toBe('lower');
  });

  it('keeps a locked macro at its grams', () => {
    const m = macrosFromRatio(2000, moderate);
    const r = rescaleToCalories(2500, m, 'protein');
    expect(r.protein).toBe(m.protein);
    nearTotal(macroKcal(r), 2500);
  });
});

describe('rebalanceMacro', () => {
  it('pins the edited macro and keeps the total', () => {
    const m = macrosFromRatio(2000, moderate);
    const r = rebalanceMacro(2000, 'protein', 200, m);
    expect(r.protein).toBe(200);
    nearTotal(macroKcal(r), 2000);
  });

  it('with a different macro locked, only the third one moves', () => {
    const m = macrosFromRatio(2000, moderate);
    const r = rebalanceMacro(2000, 'protein', 200, m, 'fat');
    expect(r.fat).toBe(m.fat);
    expect(r.protein).toBe(200);
    nearTotal(macroKcal(r), 2000);
  });
});

describe('presetMacros', () => {
  it('applies a preset but respects a lock', () => {
    const m = { protein: 220, carbs: 150, fat: 60 };
    const r = presetMacros(2200, lower, m, 'protein');
    expect(r.protein).toBe(220);
    nearTotal(macroKcal(r), 2200);
  });
});
