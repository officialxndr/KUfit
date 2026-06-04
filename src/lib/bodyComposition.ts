/**
 * Body-composition math.
 *
 * Body-fat % is best measured directly (DEXA, calipers, etc.). Between measurements we
 * estimate it from a measured *baseline* and the current scale weight, assuming **lean
 * mass is preserved** — i.e. weight change is fat. That holds well during a cut/weight
 * loss. If you GAIN muscle, lean mass isn't constant and this drifts, so the right move
 * is to take a fresh measurement (DEXA) to re-baseline. There is no reliable way to
 * infer muscle gain from scale weight alone.
 */

/** Lean (fat-free) mass in kg for a measured weight + body-fat %. */
export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100);
}

/**
 * Split a weigh-in into compartments. Fat-free mass (`ffmKg`) is always weight − fat and
 * is what FFMI uses. With a known **DEXA bone mass** we can show the true 3-compartment
 * model — fat + lean soft tissue + bone — that a DEXA report gives (lean soft tissue =
 * fat-free mass − bone); without it, `leanSoftKg`/`boneKg` are null and `ffmKg` (which
 * silently includes bone) is the best available "lean" figure.
 */
export function composition(
  weightKg: number,
  bodyFatPct: number,
  boneMassKg?: number | null
): { fatKg: number; ffmKg: number; boneKg: number | null; leanSoftKg: number | null } {
  const fatKg = weightKg * (bodyFatPct / 100);
  const ffmKg = weightKg - fatKg;
  const boneKg = boneMassKg != null && boneMassKg > 0 ? boneMassKg : null;
  const leanSoftKg = boneKg != null ? Math.max(0, ffmKg - boneKg) : null;
  return { fatKg, ffmKg, boneKg, leanSoftKg };
}

/**
 * U.S. Navy body-fat estimate (Hodgdon–Beckett) from tape measurements, metric (cm):
 *   men:   495 / (1.0324 − 0.19077·log10(waist−neck) + 0.15456·log10(height)) − 450
 *   women: 495 / (1.29579 − 0.35004·log10(waist+hip−neck) + 0.22100·log10(height)) − 450
 * Measure waist at the navel (men) / narrowest point (women), neck below the larynx,
 * hips at the widest (women). Returns null if inputs are missing/out of domain. It's an
 * estimate (±~3–4%); DEXA/hydrostatic are more accurate.
 */
export function navyBodyFat(input: {
  sex: 'MALE' | 'FEMALE';
  heightCm: number;
  neckCm: number;
  waistCm: number;
  hipCm?: number | null;
}): number | null {
  const { sex, heightCm, neckCm, waistCm, hipCm } = input;
  if (heightCm <= 0 || neckCm <= 0 || waistCm <= 0) return null;
  let bf: number;
  if (sex === 'FEMALE') {
    if (!hipCm || hipCm <= 0) return null;
    const girth = waistCm + hipCm - neckCm;
    if (girth <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(heightCm)) - 450;
  } else {
    const girth = waistCm - neckCm;
    if (girth <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  if (!Number.isFinite(bf)) return null;
  return Math.max(3, Math.min(70, bf));
}

/**
 * Goal total mass to reach a target body-fat %, holding the current lean (fat-free)
 * mass constant — i.e. you lose/gain only fat. `targetWeight = lean / (1 − bf/100)`.
 * Returns null for an out-of-range target or missing lean mass.
 */
export function targetWeightForBodyFat(leanKg: number, goalBodyFatPct: number): number | null {
  if (leanKg <= 0 || goalBodyFatPct <= 0 || goalBodyFatPct >= 100) return null;
  return leanKg / (1 - goalBodyFatPct / 100);
}

/**
 * Estimate current body-fat % from a measured baseline (weight + bf%) and current
 * weight, holding the baseline's lean mass constant. Clamped to a sane range.
 */
export function estimateBodyFat(
  baselineWeightKg: number,
  baselineBodyFatPct: number,
  currentWeightKg: number
): number {
  if (currentWeightKg <= 0) return baselineBodyFatPct;
  const lean = leanMassKg(baselineWeightKg, baselineBodyFatPct);
  const fat = currentWeightKg - lean;
  const bf = (fat / currentWeightKg) * 100;
  return Math.max(3, Math.min(70, bf));
}

/**
 * Body-fat % for a single weigh-in, mirroring the Body subview's source priority:
 * a value measured on the entry itself wins; otherwise estimate from a measured
 * `baseline` (holding its lean mass constant). Returns null when neither is available
 * (the caller can then fall back to a Navy tape estimate). `measured` flags which
 * path was taken so a trend can label itself honestly.
 */
export function bodyFatForEntry(
  entry: { weightKg: number; bodyFat?: number | null },
  baseline: { weightKg: number; bodyFat?: number | null } | null
): { bf: number; measured: boolean } | null {
  if (entry.bodyFat != null) return { bf: entry.bodyFat, measured: true };
  if (baseline?.bodyFat != null) {
    return { bf: estimateBodyFat(baseline.weightKg, baseline.bodyFat, entry.weightKg), measured: false };
  }
  return null;
}
