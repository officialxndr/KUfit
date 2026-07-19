/**
 * Skinfold-caliper body-fat estimation (Jackson–Pollock).
 *
 * Pinch calipers measure subcutaneous fat (in **mm**) at several body sites. The sum of
 * folds → body density via a sex/age-specific regression, then Siri's equation converts
 * density → body-fat %. Two protocols are supported:
 *   • JP3 (3-site): quick. Men pinch chest/abdomen/thigh; women triceps/suprailiac/thigh.
 *   • JP7 (7-site): more accurate; the same 7 sites for both sexes (different coefficients).
 * Age is in **years**. The estimate is ±~3–4% and technique-dependent (correct site,
 * consistent pinch, same caliper); DEXA/hydrostatic are more accurate.
 *
 * Refs: Jackson & Pollock (1978, men); Jackson, Pollock & Ward (1980, women); Siri (1961).
 * Style mirrors `navyBodyFat` in `bodyComposition.ts`: pure, guarded, `number | null`,
 * result clamped to [3, 70].
 */

export type SkinfoldMethod = 'JP3' | 'JP7';
export type SkinfoldSex = 'MALE' | 'FEMALE';
export type SkinfoldSite =
  | 'chest'
  | 'abdomen'
  | 'thigh'
  | 'triceps'
  | 'suprailiac'
  | 'midaxillary'
  | 'subscapular';

/** Raw caliper folds in mm, keyed by site (only the method's required sites are read). */
export type SkinfoldFolds = Partial<Record<SkinfoldSite, number>>;

/** Which sites each protocol requires, by sex. JP7 uses the same 7 sites for both sexes. */
export const SKINFOLD_SITES: Record<SkinfoldMethod, Record<SkinfoldSex, SkinfoldSite[]>> = {
  JP3: {
    MALE: ['chest', 'abdomen', 'thigh'],
    FEMALE: ['triceps', 'suprailiac', 'thigh'],
  },
  JP7: {
    MALE: ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'],
    FEMALE: ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'],
  },
};

/** Display labels + a short "where to pinch" hint per site, for the entry UI. */
export const SKINFOLD_SITE_INFO: Record<SkinfoldSite, { label: string; hint: string }> = {
  chest: { label: 'Chest', hint: 'Diagonal fold, halfway between nipple and front armpit crease.' },
  abdomen: { label: 'Abdomen', hint: 'Vertical fold, ~2 cm to the right of the navel.' },
  thigh: { label: 'Thigh', hint: 'Vertical fold, front midline between hip crease and knee.' },
  triceps: { label: 'Triceps', hint: 'Vertical fold, back of the upper arm, midway shoulder–elbow.' },
  suprailiac: { label: 'Suprailiac', hint: 'Diagonal fold just above the hip bone at the front armpit line.' },
  midaxillary: { label: 'Midaxillary', hint: 'Vertical fold on the midline of the side, level with the sternum.' },
  subscapular: { label: 'Subscapular', hint: 'Diagonal fold just below the shoulder blade.' },
};

/** Sum of the folds the given method+sex requires; null if any required fold is missing/≤0. */
function foldSum(method: SkinfoldMethod, sex: SkinfoldSex, folds: SkinfoldFolds): number | null {
  let sum = 0;
  for (const site of SKINFOLD_SITES[method][sex]) {
    const v = folds[site];
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    sum += v;
  }
  return sum;
}

/**
 * Body density (g/cc) from the sum of skinfolds via the Jackson–Pollock quadratic
 * regressions. Returns null on any missing fold or missing/invalid age.
 */
export function bodyDensity(
  method: SkinfoldMethod,
  sex: SkinfoldSex,
  folds: SkinfoldFolds,
  ageYears: number | null
): number | null {
  if (ageYears == null || !Number.isFinite(ageYears) || ageYears <= 0) return null;
  const s = foldSum(method, sex, folds);
  if (s == null) return null;
  const a = ageYears;
  let d: number;
  if (method === 'JP3') {
    d =
      sex === 'FEMALE'
        ? 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * a
        : 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * a;
  } else {
    d =
      sex === 'FEMALE'
        ? 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * a
        : 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * a;
  }
  return Number.isFinite(d) && d > 0 ? d : null;
}

/** Siri (1961): body-fat % from body density. */
export function siri(density: number): number {
  return 495 / density - 450;
}

/** Brozek (1963): an alternate density→bf% conversion, kept for reference/comparison. */
export function brozek(density: number): number {
  return 457 / density - 414.2;
}

/**
 * Body-fat % from skinfolds via Jackson–Pollock density → Siri. Returns null when the
 * required folds or age are missing/invalid. Clamped to [3, 70] (mirrors `navyBodyFat`).
 * JP is sex-specific, so `sex` must be MALE/FEMALE — callers pick a formula basis when
 * the profile sex is OTHER/unset.
 */
export function skinfoldBodyFat(
  method: SkinfoldMethod,
  sex: SkinfoldSex,
  folds: SkinfoldFolds,
  ageYears: number | null
): number | null {
  const d = bodyDensity(method, sex, folds, ageYears);
  if (d == null) return null;
  const bf = siri(d);
  if (!Number.isFinite(bf)) return null;
  return Math.max(3, Math.min(70, bf));
}
