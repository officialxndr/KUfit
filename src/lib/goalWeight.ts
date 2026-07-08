/**
 * Body-fat-goal ⇆ goal-weight bridge.
 *
 * The user can express their goal either as a scale weight (`goalMode: 'weight'`) or as
 * a target body-fat % (`goalMode: 'bodyfat'`). The whole weight/calorie/pacing engine
 * reads a single field — `profile.goalWeightKg` — so in body-fat mode we keep that field
 * *derived and fresh*: the target total mass to reach `goalBodyFat`, holding the user's
 * current lean (fat-free) mass constant. Recompute + persist it whenever body composition
 * changes (a weigh-in / DEXA) or the goal is edited, and nothing downstream has to change.
 */
import { leanMassKg, targetWeightForBodyFat } from '@/lib/bodyComposition';
import { computeBodyFatView } from '@/lib/bodyFatResolve';
import { useSettingsStore, type Profile } from '@/stores/settingsStore';

/**
 * Current lean (fat-free) mass in kg from the latest weigh-in, using the **same** resolved
 * body fat the Body card shows (`computeBodyFatView`) — so it honors the user's source
 * toggle (`bodyFatSource`) and estimate basis (`bodyFatEstimateBasis`). Null when there's
 * no weigh-in or no way to determine body fat.
 */
export function currentLeanMassKg(profile: Profile): number | null {
  const { latest, bf } = computeBodyFatView(profile);
  return latest && bf != null ? leanMassKg(latest.weightKg, bf) : null;
}

/**
 * Target total mass for the body-fat goal (kg), or null if not in body-fat mode, no
 * target set, or current lean mass is unknown (no body-fat reading yet).
 */
export function bodyFatGoalWeightKg(profile: Profile): number | null {
  if (profile.goalMode !== 'bodyfat' || profile.goalBodyFat == null) return null;
  const lean = currentLeanMassKg(profile);
  return lean != null ? targetWeightForBodyFat(lean, profile.goalBodyFat) : null;
}

/**
 * Recompute `goalWeightKg` from the body-fat goal and persist it (only when it actually
 * changed, so it converges and won't loop). No-op outside body-fat mode or when lean
 * mass can't be computed. Call after any weigh-in / DEXA / body-fat-goal edit.
 */
export function syncBodyFatGoalWeight(): void {
  const { profile, setProfile } = useSettingsStore.getState();
  if (profile.goalMode !== 'bodyfat' || profile.goalBodyFat == null) return;
  const target = bodyFatGoalWeightKg(profile);
  if (target == null) return;
  const rounded = Math.round(target * 100) / 100;
  if (profile.goalWeightKg !== rounded) setProfile({ goalWeightKg: rounded });
}
