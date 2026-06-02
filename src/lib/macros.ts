/**
 * Preset macro splits (percent of calories). Carbs is the distinguishing macro
 * (lower 20% → moderate 35% → higher 50%). Applying one recomputes the gram
 * targets from the current calorie goal, so the macros always sum to it.
 */
export interface MacroRatio {
  key: string;
  label: string;
  /** Percent of total calories. */
  protein: number;
  carbs: number;
  fat: number;
}

export const MACRO_PRESETS: MacroRatio[] = [
  { key: 'moderate', label: 'Moderate Carb', protein: 30, carbs: 35, fat: 35 },
  { key: 'lower', label: 'Lower Carb', protein: 40, carbs: 20, fat: 40 },
  { key: 'higher', label: 'Higher Carb', protein: 30, carbs: 50, fat: 20 },
];

export interface Macros { protein: number; carbs: number; fat: number }

/** kcal per gram. */
const KCAL = { protein: 4, carbs: 4, fat: 9 } as const;
export type MacroKey = keyof Macros;
const ORDER: MacroKey[] = ['protein', 'carbs', 'fat'];
const othersOf = (k: MacroKey): [MacroKey, MacroKey] => {
  const o = ORDER.filter((x) => x !== k);
  return [o[0], o[1]];
};

/**
 * Keep `locked` fixed at its current grams and fill the remaining calories across
 * the other two macros using the given weights (their current kcal, or a preset's
 * percentages). Always totals `calories` (the locked macro can push it over only
 * if it alone exceeds the goal).
 */
function distributeLocked(calories: number, m: Macros, locked: MacroKey, w0: number, w1: number): Macros {
  const [a, b] = othersOf(locked);
  const lockedKcal = m[locked] * KCAL[locked];
  const remaining = Math.max(0, calories - lockedKcal);
  const wTotal = w0 + w1;
  const aKcal = wTotal <= 0 ? remaining / 2 : (remaining * w0) / wTotal;
  const out = { ...m };
  out[a] = Math.max(0, Math.round(aKcal / KCAL[a]));
  out[b] = Math.max(0, Math.round((calories - lockedKcal - out[a] * KCAL[a]) / KCAL[b]));
  return out;
}

/** Total kcal of a macro set. */
export const macroKcal = (m: Macros): number => m.protein * KCAL.protein + m.carbs * KCAL.carbs + m.fat * KCAL.fat;

/** Grams of each macro for `calories` at the given ratio (4/4/9 kcal per gram). */
export function macrosFromRatio(calories: number, r: MacroRatio): Macros {
  const cal = Math.max(0, calories);
  // Derive carbs last from the remainder so the three always sum to `cal`.
  const protein = Math.round((cal * r.protein / 100) / 4);
  const fat = Math.round((cal * r.fat / 100) / 9);
  const carbs = Math.max(0, Math.round((cal - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
}

/** Percent-of-calories split for a macro set (falls back to the first preset when empty). */
export function splitPct(m: Macros): Macros {
  const t = macroKcal(m);
  if (t <= 0) { const r = MACRO_PRESETS[0]; return { protein: r.protein, carbs: r.carbs, fat: r.fat }; }
  return {
    protein: (m.protein * KCAL.protein) / t * 100,
    carbs: (m.carbs * KCAL.carbs) / t * 100,
    fat: (m.fat * KCAL.fat) / t * 100,
  };
}

/**
 * Rescale macros to a new calorie total, preserving the current ratio. If a macro
 * is `locked`, it keeps its grams and only the other two rescale to fill the rest.
 */
export function rescaleToCalories(calories: number, m: Macros, locked: MacroKey | null = null): Macros {
  if (locked) {
    const [a, b] = othersOf(locked);
    return distributeLocked(calories, m, locked, m[a] * KCAL[a], m[b] * KCAL[b]);
  }
  const s = splitPct(m);
  return macrosFromRatio(calories, { key: 'cur', label: '', protein: s.protein, carbs: s.carbs, fat: s.fat });
}

/**
 * Edit one macro while keeping the calorie total fixed. The edited macro is pinned;
 * the remaining kcal is split across the other two in proportion to their current
 * ratio (equal split if both 0). When a *different* macro is `locked`, it stays put
 * and the single remaining macro absorbs the change. Always sums to `calories`.
 */
export function rebalanceMacro(calories: number, field: MacroKey, grams: number, m: Macros, locked: MacroKey | null = null): Macros {
  const fixed = Math.max(0, Math.round(grams));
  if (locked && locked !== field) {
    const other = ORDER.find((k) => k !== field && k !== locked)!;
    const out = { ...m, [field]: fixed };
    out[locked] = m[locked];
    const remaining = Math.max(0, calories - fixed * KCAL[field] - m[locked] * KCAL[locked]);
    out[other] = Math.max(0, Math.round(remaining / KCAL[other]));
    return out;
  }
  // No lock, or editing the locked macro itself → split the rest over the other two.
  const out: Macros = { ...m, [field]: fixed };
  const [a, b] = othersOf(field);
  const oTotal = m[a] * KCAL[a] + m[b] * KCAL[b];
  const remaining = Math.max(0, calories - fixed * KCAL[field]);
  const aKcal = oTotal <= 0 ? remaining / 2 : (remaining * m[a] * KCAL[a]) / oTotal;
  out[a] = Math.max(0, Math.round(aKcal / KCAL[a]));
  out[b] = Math.max(0, Math.round((calories - fixed * KCAL[field] - out[a] * KCAL[a]) / KCAL[b]));
  return out;
}

/**
 * Apply a preset split to `calories`. If a macro is `locked`, keep its grams and
 * distribute the rest across the other two using the preset's ratio between them.
 */
export function presetMacros(calories: number, r: MacroRatio, m: Macros, locked: MacroKey | null = null): Macros {
  if (!locked) return macrosFromRatio(calories, r);
  const [a, b] = othersOf(locked);
  return distributeLocked(calories, m, locked, r[a], r[b]);
}

/** Which preset (if any) the current split matches, within ~2 percentage points. */
export function activePresetKey(m: Macros): string | null {
  const s = splitPct(m);
  const hit = MACRO_PRESETS.find(
    (r) => Math.abs(s.protein - r.protein) <= 2 && Math.abs(s.carbs - r.carbs) <= 2 && Math.abs(s.fat - r.fat) <= 2
  );
  return hit?.key ?? null;
}
