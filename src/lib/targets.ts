import { calcBMR, calcTDEE, calcGoalCalories } from '@/lib/tdee';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import type { Profile } from '@/stores/settingsStore';
import type { GoalPhase } from '@/types';

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

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = diff / (365.25 * 86400 * 1000);
  return years > 0 && years < 130 ? Math.floor(years) : null;
}

/**
 * Resolves the effective daily calorie + macro targets, following the active
 * GoalPhase if one covers today, otherwise the profile defaults. Pure read —
 * safe to call on every render.
 */
export function resolveTargets(profile: Profile): ResolvedTargets {
  const phase: GoalPhase | null = healthRepo.getActiveGoalPhase();
  const latest = healthRepo.getLatestWeightEntry();
  const currentWeightKg = latest?.weightKg ?? null;

  const goalType = phase?.goalType ?? profile.goalType;
  const goalWeightKg = phase?.targetWeightKg ?? profile.goalWeightKg;
  const goalDate = phase?.endDate ?? profile.goalDate;
  const source = phase ? phase.name : 'Profile default';

  // Macro targets: phase overrides → profile → null
  const proteinTarget = phase?.proteinTarget ?? profile.proteinTarget ?? null;
  const carbsTarget = phase?.carbsTarget ?? profile.carbsTarget ?? null;
  const fatTarget = phase?.fatTarget ?? profile.fatTarget ?? null;

  // Manual override on phase or profile wins
  const manualCalorie = phase?.calorieTarget ?? profile.calorieGoal ?? null;

  const age = ageFromBirthDate(profile.birthDate);
  const canCompute =
    currentWeightKg != null && profile.heightCm != null && profile.sex != null && age != null;

  if (!canCompute) {
    return {
      calorieTarget: manualCalorie,
      proteinTarget,
      carbsTarget,
      fatTarget,
      tdee: null,
      warning: manualCalorie ? null : 'Add your weight, height, sex and birth date to estimate calories.',
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
    return { calorieTarget: manualCalorie, proteinTarget, carbsTarget, fatTarget, tdee, warning: null, source };
  }

  const { target, warning } = calcGoalCalories({
    tdee,
    bmr,
    goalType,
    currentWeightKg: currentWeightKg!,
    goalWeightKg,
    goalDate,
  });

  return { calorieTarget: target, proteinTarget, carbsTarget, fatTarget, tdee, warning, source };
}
