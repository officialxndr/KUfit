import { health } from '@/lib/health';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { caloriesBurnedFromDuration } from '@/lib/activities';
import type { ActiveCalorieSource } from '@/types';

/** Sanity ceiling for a day's active-calorie eat-back (kcal). Guards bad data. */
const MAX_DAILY_BURN = 4000;

const startOfTodayIso = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/**
 * Active calories burned in a time range to add back into that day's budget, per the user's
 * chosen source:
 * - `off`    → 0
 * - `inapp`  → in-app logged workouts only (MET/measured per session)
 * - `watch`  → the watch/Health active energy over the range
 * - `auto`   → watch energy, PLUS the app's MET estimate for any workout in the range the watch
 *              didn't cover (e.g. watch dead/charging), so we never double-count energy the watch saw.
 *
 * Async because watch reads (`health.getActiveEnergyBurned`) are async. Use for a specific day by
 * passing that local day's start/end; `computeActiveCaloriesToday` is the today wrapper.
 */
export async function computeActiveCaloriesForRange(
  source: ActiveCalorieSource,
  startIso: string,
  endIso: string
): Promise<number> {
  if (source === 'off') return 0;
  if (source === 'inapp') return Math.min(MAX_DAILY_BURN, workoutRepo.getCaloriesBurnedBetween(startIso, endIso));

  const wholeDay = await health.getActiveEnergyBurned(startIso, endIso);

  if (source === 'watch') return Math.round(Math.min(MAX_DAILY_BURN, wholeDay ?? 0));

  // auto
  let total = wholeDay ?? 0;
  const bodyWeightKg = healthRepo.getLatestWeightEntry()?.weightKg ?? 75;
  // Cheap timestamp-only range read (no exercise/set hydration; not capped to recent sessions).
  const sessions = workoutRepo.getSessionTimesBetween(startIso, endIso);

  for (const s of sessions) {
    const covered = await health.getActiveEnergyBurned(s.startedAt, s.finishedAt!);
    // Watch had no (or negligible) data for this window → add the app's MET estimate.
    if (covered == null || covered <= 1) {
      // Cap at 6h so a session left open across days can't blow up the estimate.
      const durationMin = Math.min(
        360,
        Math.max(1, Math.round((new Date(s.finishedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000))
      );
      total += caloriesBurnedFromDuration(durationMin, bodyWeightKg);
    }
  }
  return Math.round(Math.min(MAX_DAILY_BURN, total));
}

/** Active calories burned so far today (the today wrapper of `computeActiveCaloriesForRange`). */
export async function computeActiveCaloriesToday(source: ActiveCalorieSource): Promise<number> {
  return computeActiveCaloriesForRange(source, startOfTodayIso(), new Date().toISOString());
}
