import { describe, it, expect } from '@jest/globals';
import { leanMassKg, composition, navyBodyFat, targetWeightForBodyFat, estimateBodyFat, bodyFatForEntry } from '@/lib/bodyComposition';
import { skinfoldBodyFat, bodyDensity, siri, brozek } from '@/lib/skinfold';
import { epley1RM } from '@/lib/epley';

describe('lean mass & composition', () => {
  it('splits weight into fat and fat-free mass', () => {
    expect(leanMassKg(100, 25)).toBe(75);
    expect(composition(100, 25)).toEqual({ fatKg: 25, ffmKg: 75, boneKg: null, leanSoftKg: null });
    expect(composition(100, 25, 3).leanSoftKg).toBe(72);
  });
});

describe('navyBodyFat (Hodgdon–Beckett)', () => {
  it('matches reference values', () => {
    expect(navyBodyFat({ sex: 'MALE', heightCm: 178, neckCm: 38, waistCm: 86 })).toBeCloseTo(17.2, 1);
    expect(navyBodyFat({ sex: 'FEMALE', heightCm: 165, neckCm: 33, waistCm: 70, hipCm: 100 })).toBeCloseTo(26.9, 1);
  });

  it('returns null for impossible input', () => {
    expect(navyBodyFat({ sex: 'MALE', heightCm: 178, neckCm: 40, waistCm: 38 })).toBeNull(); // waist < neck
    expect(navyBodyFat({ sex: 'FEMALE', heightCm: 165, neckCm: 33, waistCm: 70 })).toBeNull(); // no hip
    expect(navyBodyFat({ sex: 'MALE', heightCm: 0, neckCm: 38, waistCm: 86 })).toBeNull();
  });
});

describe('estimateBodyFat / targetWeightForBodyFat', () => {
  it('holds lean mass constant', () => {
    // 100 kg at 30% → 70 kg lean; at 90 kg the 10 kg lost is fat → 20/90 = 22.2%
    expect(estimateBodyFat(100, 30, 90)).toBeCloseTo(22.22, 2);
    expect(targetWeightForBodyFat(70, 15)).toBeCloseTo(82.35, 2);
    expect(targetWeightForBodyFat(70, 100)).toBeNull();
  });

  it('clamps to a sane range', () => {
    expect(estimateBodyFat(100, 10, 85)).toBe(3); // would be negative
  });

  it('bodyFatForEntry prefers a measured value over an estimate', () => {
    expect(bodyFatForEntry({ weightKg: 90, bodyFat: 18 }, { weightKg: 100, bodyFat: 30 })).toEqual({ bf: 18, measured: true });
    expect(bodyFatForEntry({ weightKg: 90 }, { weightKg: 100, bodyFat: 30 })!.measured).toBe(false);
    expect(bodyFatForEntry({ weightKg: 90 }, null)).toBeNull();
  });
});

describe('skinfolds (Jackson–Pollock → Siri)', () => {
  it('JP3 male matches the published regression', () => {
    const folds = { chest: 20, abdomen: 25, thigh: 15 }; // Σ 60 mm, age 30
    expect(bodyDensity('JP3', 'MALE', folds, 30)).toBeCloseTo(1.057816, 6);
    expect(skinfoldBodyFat('JP3', 'MALE', folds, 30)).toBeCloseTo(17.95, 2);
  });

  it('needs every required fold and an age', () => {
    expect(skinfoldBodyFat('JP3', 'MALE', { chest: 20, abdomen: 25 }, 30)).toBeNull();
    expect(skinfoldBodyFat('JP3', 'MALE', { chest: 20, abdomen: 25, thigh: 15 }, null)).toBeNull();
  });

  it('Siri and Brozek agree closely at typical densities', () => {
    expect(Math.abs(siri(1.06) - brozek(1.06))).toBeLessThan(1);
  });
});

describe('epley1RM', () => {
  it('estimates a one-rep max', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(epley1RM(100, 0)).toBe(100);
  });
});
