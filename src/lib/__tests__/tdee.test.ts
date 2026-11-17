import { describe, it, expect } from '@jest/globals';
import { calcBMR, calcTDEE, calcGoalCalories, calcEmpiricalMaintenance, safeRateWarning, MAX_SAFE_RATE_KG, KCAL_PER_KG } from '@/lib/tdee';

const WEEK_MS = 7 * 86_400_000;
const inWeeks = (n: number) => new Date(Date.now() + n * WEEK_MS).toISOString();
const base = { weightKg: 80, heightCm: 180, ageYears: 30, activityLevel: 'MODERATE' as const };

describe('calcBMR (Mifflin–St Jeor)', () => {
  it('matches the published formula for men and women', () => {
    // 10·80 + 6.25·180 − 5·30 = 1775
    expect(calcBMR({ ...base, sex: 'MALE' })).toBe(1780); // +5
    expect(calcBMR({ ...base, sex: 'FEMALE' })).toBe(1614); // −161
  });
});

describe('calcTDEE', () => {
  it('applies the activity multiplier and ±250/500 targets', () => {
    const r = calcTDEE({ ...base, sex: 'MALE' });
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(Math.round(1780 * 1.55)); // 2759
    expect(r.targets.maintain).toBe(r.tdee);
    expect(r.targets.moderateLoss).toBe(r.tdee - 500);
    expect(r.targets.mildGain).toBe(r.tdee + 250);
  });
});

describe('calcGoalCalories', () => {
  const tdee = 2759;
  const bmr = 1780;

  it('returns maintenance for MAINTAIN or a missing goal', () => {
    expect(calcGoalCalories({ tdee, bmr, goalType: 'MAINTAIN', currentWeightKg: 80 }).target).toBe(tdee);
    expect(calcGoalCalories({ tdee, bmr, goalType: 'LOSE', currentWeightKg: 80, goalWeightKg: 75 }).target).toBe(tdee);
  });

  it('turns a weekly loss rate into a daily deficit (7700 kcal/kg)', () => {
    // 5 kg over 10 weeks = 0.5 kg/wk → 0.5·7700/7 = 550 kcal/day deficit
    const r = calcGoalCalories({ tdee, bmr, goalType: 'LOSE', currentWeightKg: 80, goalWeightKg: 75, goalDate: inWeeks(10) });
    expect(r.target).toBeGreaterThanOrEqual(tdee - 551);
    expect(r.target).toBeLessThanOrEqual(tdee - 549);
    expect(r.weeklyRate).toBeCloseTo(0.5, 2);
    expect(r.warning).toBeNull();
  });

  it('caps the pace at the safe max and floors the target at BMR with a warning', () => {
    // 20 kg in 4 weeks is far too fast → capped at ~0.9 kg/wk → ~998 kcal deficit → 1761 < BMR
    const r = calcGoalCalories({ tdee, bmr, goalType: 'LOSE', currentWeightKg: 80, goalWeightKg: 60, goalDate: inWeeks(4) });
    expect(r.target).toBe(bmr);
    expect(r.warning).toMatch(/BMR/);
    expect(Math.round((MAX_SAFE_RATE_KG * KCAL_PER_KG) / 7)).toBe(998);
  });

  it('adds a surplus for GAIN', () => {
    const r = calcGoalCalories({ tdee, bmr, goalType: 'GAIN', currentWeightKg: 70, goalWeightKg: 72, goalDate: inWeeks(8) });
    // 0.25 kg/wk → 275 kcal/day surplus
    expect(r.target).toBeGreaterThanOrEqual(tdee + 274);
    expect(r.target).toBeLessThanOrEqual(tdee + 276);
  });

  it('flags a goal date in the past', () => {
    const r = calcGoalCalories({ tdee, bmr, goalType: 'LOSE', currentWeightKg: 80, goalWeightKg: 75, goalDate: inWeeks(-1) });
    expect(r.target).toBe(tdee);
    expect(r.warning).toMatch(/past/);
  });
});

describe('safeRateWarning', () => {
  it('is silent at a safe pace and warns above ~2 lb/week', () => {
    expect(safeRateWarning(80, 78, inWeeks(4), 'IMPERIAL')).toBeNull(); // 0.5 kg/wk
    expect(safeRateWarning(80, 70, inWeeks(4), 'IMPERIAL')).toMatch(/lb\/week/); // 2.5 kg/wk
    expect(safeRateWarning(80, 70, inWeeks(4), 'METRIC')).toMatch(/kg\/week/);
    expect(safeRateWarning(null, 70, inWeeks(4), 'METRIC')).toBeNull();
  });
});

describe('calcEmpiricalMaintenance', () => {
  it('back-calculates maintenance from intake and weight change', () => {
    // Ate 2500/day and lost 1 kg in 14 days → 550/day deficit → maintenance 3050
    expect(calcEmpiricalMaintenance({ avgDailyIntakeKcal: 2500, weightChangeKg: -1, days: 14 })).toEqual({
      maintenance: 3050,
      dailyEnergyBalance: -550,
    });
    // Gained while eating 2500 → maintenance is below intake
    expect(calcEmpiricalMaintenance({ avgDailyIntakeKcal: 2500, weightChangeKg: 1, days: 14 })!.maintenance).toBe(1950);
  });

  it('rejects bad input', () => {
    expect(calcEmpiricalMaintenance({ avgDailyIntakeKcal: 2500, weightChangeKg: -1, days: 0 })).toBeNull();
    expect(calcEmpiricalMaintenance({ avgDailyIntakeKcal: NaN, weightChangeKg: 0, days: 7 })).toBeNull();
    expect(calcEmpiricalMaintenance({ avgDailyIntakeKcal: 500, weightChangeKg: 5, days: 7 })).toBeNull(); // ≤ 0
  });
});
