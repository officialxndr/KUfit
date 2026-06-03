import { calcBMR, calcTDEE, calcGoalCalories, safeRateWarning, MIN_SAFE_CALORIES } from '@/lib/tdee';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { activeCaloriesToday } from '@/stores/activeCaloriesStore';
import type { Profile } from '@/stores/settingsStore';
import type { GoalPhase } from '@/types';

/** Calorie goal shown before the user has enough info (or a manual goal) to personalize one,
 *  so the calorie ring is never empty. */
export const DEFAULT_CALORIE_TARGET = 2000;
const NEEDS_INFO_WARNING = `Showing a default ${DEFAULT_CALORIE_TARGET.toLocaleString()} kcal goal — add your weight, height, sex and birth date to personalize it.`;

/**
 * Combined non-blocking safety caution for the user's goal — faster than the
 * ~2 lb/week max, or a target below BMR / very low calories. Used wherever the
 * goal or its pace is shown (dashboard, weight trend, goal editors). Excludes
 * the benign "add your info" prompt. `currentWeightKg` comes from the latest
 * weigh-in.
 */
export function goalSafetyWarning(profile: Profile, currentWeightKg: number | null): string | null {
  const rate = safeRateWarning(currentWeightKg, profile.goalWeightKg, profile.goalDate, profile.unitSystem);
  if (rate) return rate;
  const w = resolveTargets(profile).warning;
  return w && w !== NEEDS_INFO_WARNING ? w : null;
}

/** Upper edge of a sustainable daily calorie adjustment. Beyond this the pace the
 *  goal demands isn't realistic, so we stop quoting the (absurd) number. */
const SUSTAINABLE_DELTA = 1000;

export interface PaceDescription {
  title: string;
  message: string;
  /** False when the required pace exceeds a sustainable daily adjustment. */
  realistic: boolean;
}

/**
 * Direction-aware copy for the pace card. `deltaKcal` is `HealthStats.dailyCalorieDelta`
 * (positive ⇒ eat less / cut, negative ⇒ eat more). `goalDirection` says whether the
 * user is losing or gaining, which decides "behind" vs "ahead" independently of the verb:
 *   - lose goal: behind when delta > 0 (needs a bigger deficit)
 *   - gain goal: behind when delta < 0 (needs a bigger surplus)
 * Derive `goalDirection` from the sign of `HealthStats.requiredWeeklyRate`
 * (`>= 0` → 'lose', `< 0` → 'gain').
 */
export function describePace(deltaKcal: number, goalDirection: 'lose' | 'gain'): PaceDescription {
  const mag = Math.abs(deltaKcal);
  const behind = goalDirection === 'lose' ? deltaKcal > 0 : deltaKcal < 0;

  if (mag > SUSTAINABLE_DELTA) {
    return {
      title: 'Goal Pace Unrealistic',
      message: behind
        ? `Reaching your goal on time would need an unsafe ${deltaKcal > 0 ? 'cut' : 'surplus'} of over ${SUSTAINABLE_DELTA.toLocaleString()} cal/day. Push your target date out or adjust the goal.`
        : "You're well clear of your goal pace — no need to push this hard.",
      realistic: false,
    };
  }

  const amount = `~${mag} cal/day`;
  if (behind) {
    return {
      title: 'Slightly Behind',
      message: deltaKcal > 0 ? `Cut ${amount} to stay on track` : `Eat ${amount} more to stay on track`,
      realistic: true,
    };
  }
  return {
    title: 'Ahead of Pace',
    message: deltaKcal < 0
      ? `You could eat ${amount} more and stay on track`
      : `You could cut ${amount} and still hit your goal`,
    realistic: true,
  };
}

/**
 * Today's active-calorie "eat-back" that `resolveTargets` folds into the calorie
 * budget — exposed so the UI can show how much burned energy was added. Returns 0
 * when the source is off or nothing has been burned/cached yet.
 */
export function activeCaloriesForDisplay(profile: Profile): number {
  if (profile.activeCalorieSource === 'off') return 0;
  const eat = profile.activeCalorieSource === 'inapp'
    ? workoutRepo.getCaloriesBurnedToday()
    : activeCaloriesToday();
  return eat > 0 ? eat : 0;
}

/** Non-blocking caution for a calorie target that's unsafely low. */
function lowCalorieWarning(cal: number, bmr: number | null): string | null {
  if (bmr != null && cal < bmr) {
    return 'This calorie goal is below your BMR — the energy your body needs at rest. A higher intake is usually safer.';
  }
  if (cal < MIN_SAFE_CALORIES) {
    return `This calorie goal is under ${MIN_SAFE_CALORIES} kcal/day, which is very low. Consider a smaller deficit.`;
  }
  return null;
}

export interface ResolvedTargets {
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  tdee: number | null;
  warning: string | null;
  /** The goal driving the target — active phase name, or "Profile default". */
  source: string;
}

export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = diff / (365.25 * 86400 * 1000);
  return years > 0 && years < 130 ? Math.floor(years) : null;
}

/**
 * Resolves the effective daily calorie + macro targets, following the active
 * GoalPhase if one covers today, otherwise the profile defaults. When the user
 * has chosen an active-calorie source, today's cached active-calorie burn is
 * added back to the calorie budget. Pure read — safe to call on every render.
 */
export function resolveTargets(profile: Profile): ResolvedTargets {
  const base = resolveBaseTargets(profile);
  if (base.calorieTarget != null) {
    const eat = activeCaloriesForDisplay(profile);
    if (eat > 0) return { ...base, calorieTarget: base.calorieTarget + eat };
  }
  return base;
}

function resolveBaseTargets(profile: Profile): ResolvedTargets {
  const phase: GoalPhase | null = healthRepo.getActiveGoalPhase();
  const latest = healthRepo.getLatestWeightEntry();
  const currentWeightKg = latest?.weightKg ?? null;

  const goalType = phase?.goalType ?? profile.goalType;
  const goalWeightKg = phase?.targetWeightKg ?? profile.goalWeightKg;
  const goalDate = phase?.endDate ?? profile.goalDate;
  const source = phase ? phase.name : 'Profile default';

  // Macro targets: phase overrides → profile → derived from calories (below).
  let proteinTarget = phase?.proteinTarget ?? profile.proteinTarget ?? null;
  let carbsTarget = phase?.carbsTarget ?? profile.carbsTarget ?? null;
  let fatTarget = phase?.fatTarget ?? profile.fatTarget ?? null;

  // Fill any unset macro targets from the calorie target (30% protein / 40% carbs / 30% fat),
  // so all three macro bars always show an "out of total".
  const withMacroDefaults = (cal: number | null) => {
    if (cal == null) return;
    if (proteinTarget == null) proteinTarget = Math.round((cal * 0.3) / 4);
    if (carbsTarget == null) carbsTarget = Math.round((cal * 0.4) / 4);
    if (fatTarget == null) fatTarget = Math.round((cal * 0.3) / 9);
  };

  // Manual override on phase or profile wins
  const manualCalorie = phase?.calorieTarget ?? profile.calorieGoal ?? null;

  const age = ageFromBirthDate(profile.birthDate);
  const canCompute =
    currentWeightKg != null && profile.heightCm != null && profile.sex != null && age != null;

  if (!canCompute) {
    // Can't compute TDEE yet (needs weight + height + sex + age). Fall back to the
    // user's manual goal, or a default, so the calorie ring always shows a target.
    const cal = manualCalorie ?? DEFAULT_CALORIE_TARGET;
    withMacroDefaults(cal);
    return {
      calorieTarget: cal,
      proteinTarget,
      carbsTarget,
      fatTarget,
      tdee: null,
      warning: manualCalorie ? lowCalorieWarning(manualCalorie, null) : NEEDS_INFO_WARNING,
      source,
    };
  }

  const inputs = {
    weightKg: currentWeightKg!,
    heightCm: profile.heightCm!,
    ageYears: age!,
    sex: profile.sex!,
    activityLevel: profile.activityLevel,
  };
  const { tdee } = calcTDEE(inputs);
  const bmr = calcBMR(inputs);

  if (manualCalorie != null) {
    withMacroDefaults(manualCalorie);
    return { calorieTarget: manualCalorie, proteinTarget, carbsTarget, fatTarget, tdee, warning: lowCalorieWarning(manualCalorie, bmr), source };
  }

  const { target, warning: goalWarning } = calcGoalCalories({
    tdee,
    bmr,
    goalType,
    currentWeightKg: currentWeightKg!,
    goalWeightKg,
    goalDate,
    unitSystem: profile.unitSystem,
  });

  withMacroDefaults(target);
  const warning = goalWarning ?? lowCalorieWarning(target, bmr);
  return { calorieTarget: target, proteinTarget, carbsTarget, fatTarget, tdee, warning, source };
}
