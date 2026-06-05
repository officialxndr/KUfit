import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useActiveCaloriesStore } from '@/stores/activeCaloriesStore';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { health } from '@/lib/health';
import { caloriesBurnedFromDuration } from '@/lib/activities';
import { summarizeHeartRate, downsample } from '@/lib/heartRate';

/**
 * Finish the active workout: persist it (volume + PRs), then reconcile its calories and
 * heart-rate from Apple Health / Health Connect in the background. Returns the saved
 * session's localId (or null if there was nothing to save).
 *
 * Shared by the phone session screen (`src/app/session.tsx`) and the Apple Watch bridge
 * (`src/lib/watch.ts`), so a workout finished from either device gets the same MET estimate
 * up front and the same measured-energy/HR reconciliation once Health returns. When the
 * Apple Watch ran an `HKWorkoutSession`, that measured energy is what `getActiveEnergyBurned`
 * picks up here — the watch improves the stored calories for free. The caller handles any
 * navigation (the watch shows its own summary; the phone routes to /workout-summary).
 */
export function finishActiveWorkout(): string | null {
  const { startedAt } = useSessionStore.getState();
  const start = startedAt;
  const endIso = new Date().toISOString();
  const bodyWeightKg = healthRepo.getLatestWeightEntry()?.weightKg ?? 75;
  const durationMin = start
    ? Math.min(360, Math.max(1, Math.round((Date.now() - new Date(start).getTime()) / 60000)))
    : 0;
  const estimate = caloriesBurnedFromDuration(durationMin, bodyWeightKg);
  const id = useSessionStore.getState().finish(estimate);

  const calSource = useSettingsStore.getState().profile.activeCalorieSource;
  // Refresh the daily active-calorie eat-back now that a workout landed.
  useActiveCaloriesStore.getState().refresh(calSource);

  if (id && start) {
    health
      .getActiveEnergyBurned(start, endIso)
      .then((measured) => {
        if (measured && measured > 0) workoutRepo.setSessionCalories(id, Math.round(measured));
        useActiveCaloriesStore.getState().refresh(calSource);
      })
      .catch(() => {});
    // Pull the watch's heart-rate samples for the workout window → store summary + series.
    health
      .getHeartRateSamples(start, endIso)
      .then((bpms) => {
        if (!bpms?.length) return;
        const summary = summarizeHeartRate(bpms);
        if (summary) workoutRepo.setSessionHeartRate(id, { ...summary, samples: downsample(bpms) });
      })
      .catch(() => {});
  }
  return id;
}
