import type { ActivityLevel, Sex, GoalType, UnitSystem } from '@/types';

/** Doctor-recommended max weight-loss rate (~2 lb/week). */
export const MAX_SAFE_RATE_KG = 0.9072;
/** Very-low calorie floor below which we surface a caution. */
export const MIN_SAFE_CALORIES = 1200;
const KG_TO_LB = 2.20462;

/**
 * Non-blocking caution when a goal weight + date implies losing faster than the
 * ~2 lb/week recommended maximum. Returns null when within a safe pace (or when
 * inputs are missing). Reusable by goal screens that don't go through TDEE.
 */
export function safeRateWarning(
  currentWeightKg: number | null,
  goalWeightKg: number | null | undefined,
  goalDate: string | null | undefined,
  unitSystem: UnitSystem
): string | null {
  if (currentWeightKg == null || !goalWeightKg || !goalDate) return null;
  const weeks = (new Date(goalDate).getTime() - Date.now()) / (7 * 86400 * 1000);
  if (weeks <= 0) return null;
  const rateKg = (currentWeightKg - goalWeightKg) / weeks; // positive = losing
  if (rateKg <= MAX_SAFE_RATE_KG) return null;
  const rateStr = unitSystem === 'IMPERIAL' ? `${(rateKg * KG_TO_LB).toFixed(1)} lb` : `${rateKg.toFixed(2)} kg`;
  return `This pace is about ${rateStr}/week — above the doctor-recommended max of ~2 lb (0.9 kg) per week. Consider a later goal date to lose weight more gradually.`;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  SEDENTARY: 'Desk job, little exercise',
  LIGHT: 'Light exercise 1–3 days/week',
  MODERATE: 'Exercise 3–5 days/week',
  ACTIVE: 'Hard exercise 6–7 days/week',
  VERY_ACTIVE: 'Physical job + training',
};

export interface TDEEInputs {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activityLevel: ActivityLevel;
}

export interface TDEEResult {
  bmr: number;
  tdee: number;
  targets: {
    mildLoss: number;
    moderateLoss: number;
    maintain: number;
    mildGain: number;
    moderateGain: number;
  };
}

export function calcBMR(inputs: TDEEInputs): number {
  const { weightKg, heightCm, ageYears, sex } = inputs;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'MALE' ? base + 5 : base - 161;
}

export function calcTDEE(inputs: TDEEInputs): TDEEResult {
  const bmr = calcBMR(inputs);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[inputs.activityLevel];

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targets: {
      mildLoss: Math.round(tdee - 250),
      moderateLoss: Math.round(tdee - 500),
      maintain: Math.round(tdee),
      mildGain: Math.round(tdee + 250),
      moderateGain: Math.round(tdee + 500),
    },
  };
}

export function calcGoalCalories(params: {
  tdee: number;
  bmr: number;
  goalType: GoalType;
  currentWeightKg: number;
  goalWeightKg?: number | null;
  goalDate?: string | null;
  unitSystem?: UnitSystem;
}): { target: number; weeklyRate: number; warning: string | null } {
  const { tdee, bmr, goalType, currentWeightKg, goalWeightKg, goalDate, unitSystem = 'IMPERIAL' } = params;

  if (goalType === 'MAINTAIN' || !goalWeightKg || !goalDate) {
    return { target: tdee, weeklyRate: 0, warning: null };
  }

  const weeksUntilGoal =
    (new Date(goalDate).getTime() - Date.now()) / (7 * 86400 * 1000);

  if (weeksUntilGoal <= 0) {
    return { target: tdee, weeklyRate: 0, warning: 'Goal date is in the past.' };
  }

  const requiredWeeklyRateKg = (currentWeightKg - goalWeightKg) / weeksUntilGoal;
  // Cap the rate used for the calorie target at the safe max (~2 lb/week) so an
  // aggressive timeline can't produce an absurd target (the warning below still
  // flags the real pace). This bounds the daily adjustment to ~±1000 kcal.
  const cappedRateKg = Math.sign(requiredWeeklyRateKg) * Math.min(Math.abs(requiredWeeklyRateKg), MAX_SAFE_RATE_KG);
  const dailyAdjustment = (cappedRateKg * 7700) / 7;

  let target: number;
  if (goalType === 'LOSE') {
    target = Math.round(tdee - dailyAdjustment);
  } else {
    target = Math.round(tdee + Math.abs(dailyAdjustment));
  }

  let warning: string | null = null;
  if (target < bmr) {
    warning = 'This timeline requires eating below your BMR — the energy your body needs at rest. Consider extending your goal date.';
    target = bmr;
  } else {
    warning = safeRateWarning(currentWeightKg, goalWeightKg, goalDate, unitSystem);
  }

  return { target, weeklyRate: requiredWeeklyRateKg, warning };
}
