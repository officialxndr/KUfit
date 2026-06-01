import type { ActivityLevel, Sex, GoalType } from '@/types';

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
}): { target: number; weeklyRate: number; warning: string | null } {
  const { tdee, bmr, goalType, currentWeightKg, goalWeightKg, goalDate } = params;

  if (goalType === 'MAINTAIN' || !goalWeightKg || !goalDate) {
    return { target: tdee, weeklyRate: 0, warning: null };
  }

  const weeksUntilGoal =
    (new Date(goalDate).getTime() - Date.now()) / (7 * 86400 * 1000);

  if (weeksUntilGoal <= 0) {
    return { target: tdee, weeklyRate: 0, warning: 'Goal date is in the past.' };
  }

  const requiredWeeklyRateKg = (currentWeightKg - goalWeightKg) / weeksUntilGoal;
  const dailyAdjustment = (requiredWeeklyRateKg * 7700) / 7;

  let target: number;
  if (goalType === 'LOSE') {
    target = Math.round(tdee - dailyAdjustment);
  } else {
    target = Math.round(tdee + Math.abs(dailyAdjustment));
  }

  let warning: string | null = null;
  const pctPerWeek = Math.abs(requiredWeeklyRateKg) / currentWeightKg;

  if (target < bmr) {
    warning = 'This timeline requires eating below your BMR. Consider extending your goal date.';
    target = bmr;
  } else if (pctPerWeek > 0.01) {
    warning = `This requires losing ${requiredWeeklyRateKg.toFixed(2)} kg/week — above the safe threshold. Consider extending your goal date.`;
  }

  return { target, weeklyRate: requiredWeeklyRateKg, warning };
}
