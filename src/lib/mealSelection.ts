import { useCallback, useEffect, useState } from 'react';

import type { MealType } from '@/types';

/** How long a manual meal override sticks before snapping back to the time-of-day meal. */
const OVERRIDE_TTL_MS = 60 * 60 * 1000; // ~1 hour
const RECHECK_MS = 60 * 1000; // re-evaluate once a minute so it updates on its own

/** Pure: which meal does this time of day map to. */
export function mealForTime(d: Date = new Date()): MealType {
  const h = d.getHours();
  if (h < 11) return 'BREAKFAST';
  if (h < 15) return 'LUNCH';
  if (h < 21) return 'DINNER';
  return 'SNACK';
}

// Module-level so a manual pick survives navigating away and back (but resets on
// app restart). `at` is when the user overrode; it expires after OVERRIDE_TTL_MS.
let override: { meal: MealType; at: number } | null = null;

function effectiveMeal(): MealType {
  if (override && Date.now() - override.at < OVERRIDE_TTL_MS) return override.meal;
  override = null;
  return mealForTime();
}

/**
 * Meal selection that auto-follows the time of day, but honors a manual override
 * for ~1 hour before reverting to the time-based meal. Re-checks every minute so
 * the selection updates on its own when the override lapses or the clock crosses
 * a meal boundary — no interaction needed.
 */
export function useMealSelection(): [MealType, (m: MealType) => void] {
  const [meal, setMeal] = useState<MealType>(effectiveMeal);

  useEffect(() => {
    const id = setInterval(() => setMeal(effectiveMeal()), RECHECK_MS);
    return () => clearInterval(id);
  }, []);

  const pickMeal = useCallback((m: MealType) => {
    override = { meal: m, at: Date.now() };
    setMeal(m);
  }, []);

  return [meal, pickMeal];
}
