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
 * Active calories burned today to add back into the daily budget, per the user's
 * chosen source:
 * - `off`    → 0
 * - `inapp`  → in-app logged workouts only (MET/measured per session)
 * - `watch`  → the watch/Health whole-day active energy only
 * - `auto`   → watch whole-day energy, PLUS the app's MET estimate for any of
 *              today's workouts the watch didn't cover (e.g. watch dead/charging),
 *              so we never double-count energy the watch already saw.
 *
 * Async because watch reads (`health.getActiveEnergyBurned`) are async.
 */
export async function computeActiveCaloriesToday(source: ActiveCalorieSource): Promise<number> {
  if (source === 'off') return 0;
  if (source === 'inapp') return Math.min(MAX_DAILY_BURN, workoutRepo.getCaloriesBurnedToday());

  const startIso = startOfTodayIso();
  const nowIso = new Date().toISOString();
  const wholeDay = await health.getActiveEnergyBurned(startIso, nowIso);

  if (source === 'watch') return Math.round(Math.min(MAX_DAILY_BURN, wholeDay ?? 0));

  // auto
  let total = wholeDay ?? 0;
  const bodyWeightKg = healthRepo.getLatestWeightEntry()?.weightKg ?? 75;
  const todaysSessions = workoutRepo
    .getSessions(50)
    .filter((s) => s.finishedAt != null && s.finishedAt >= startIso);

  for (const s of todaysSessions) {
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
