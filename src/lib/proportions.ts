/**
 * Aesthetic "ideal proportions" from a **wrist** (and optional **ankle**) circumference.
 *
 * The wrist is almost pure bone, so its girth is a stable proxy for skeletal frame — it
 * barely moves with fat or muscle. Classic bodybuilding proportion systems anchor every
 * "ideal" measurement to it. This layers three traditional sources:
 *   • John McCallum ("Keys to Progress") — `chest = wrist × 6.5`, then every other target as
 *     a percentage of chest.
 *   • Golden ratio (φ ≈ 1.618) — the shoulder-to-waist V-taper (`shoulders = waist × φ`).
 *   • Steve Reeves — an optional ankle anchor that refines calves/thighs when provided.
 *
 * These are **aesthetic reference targets from bodybuilding tradition, not medical or
 * performance metrics** — different sources cite slightly different multipliers; treat them
 * as the centre of a tradition, not a precise spec. Pure + unit-agnostic: ratios cancel, so
 * we compute entirely in the input unit (the app passes **cm**; UI converts for display).
 * Style mirrors `bodyComposition.ts` / `skinfold.ts` (guards, `number | null`).
 *
 * The spec's *forearm* target is omitted — this app doesn't track a forearm site. Every
 * other part maps onto the app's measurement sites (single arm/thigh/calf → both L/R).
 */

/** App measurement-site keys a proportion target maps onto (subset of `BodyMeasurement`). */
export type ProportionKey =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'leftArm'
  | 'rightArm'
  | 'waist'
  | 'hips'
  | 'leftThigh'
  | 'rightThigh'
  | 'leftCalf'
  | 'rightCalf';

const CHEST_FROM_WRIST = 6.5;
const SHOULDER_FROM_WAIST = 1.618; // golden ratio (φ)
const REEVES_CALF_FROM_ANKLE = 1.92;
const REEVES_THIGH_FROM_ANKLE = 1.75;

/** McCallum targets as a share of chest. */
const CHEST_RATIOS = { waist: 0.7, hips: 0.85, thigh: 0.53, neck: 0.37, arm: 0.36, calf: 0.34 };

/**
 * Ideal target circumference per site, anchored to the wrist. When an ankle is supplied,
 * calves/thighs use the Reeves ankle anchor instead of the chest-percentage version.
 * Returns null when the wrist is missing/non-positive (no anchor → no targets).
 */
export function idealProportions(
  wristCm: number | null | undefined,
  ankleCm?: number | null
): Record<ProportionKey, number> | null {
  if (wristCm == null || !Number.isFinite(wristCm) || wristCm <= 0) return null;
  const chest = wristCm * CHEST_FROM_WRIST;
  const waist = chest * CHEST_RATIOS.waist;
  const arm = chest * CHEST_RATIOS.arm;
  const useAnkle = ankleCm != null && Number.isFinite(ankleCm) && ankleCm > 0;
  const calf = useAnkle ? (ankleCm as number) * REEVES_CALF_FROM_ANKLE : chest * CHEST_RATIOS.calf;
  const thigh = useAnkle ? (ankleCm as number) * REEVES_THIGH_FROM_ANKLE : chest * CHEST_RATIOS.thigh;
  return {
    shoulders: waist * SHOULDER_FROM_WAIST, // golden-ratio shoulder line
    chest,
    waist, // inverse target — keep at or below (see `PROPORTION_INVERSE`)
    hips: chest * CHEST_RATIOS.hips,
    neck: chest * CHEST_RATIOS.neck,
    leftArm: arm,
    rightArm: arm,
    leftThigh: thigh,
    rightThigh: thigh,
    leftCalf: calf,
    rightCalf: calf,
  };
}

/** Waist is the one target you keep at or below; everything else you grow toward. */
export const PROPORTION_INVERSE = new Set<ProportionKey>(['waist']);

/** Reeves' symmetry triad: neck ≈ (flexed) arm ≈ (flexed) calf should be roughly equal. */
export const PROPORTION_TRIAD = new Set<ProportionKey>(['neck', 'leftArm', 'rightArm', 'leftCalf', 'rightCalf']);

/** Display order + labels + flags for a targets table. */
export const PROPORTION_PARTS: { key: ProportionKey; label: string; note?: string }[] = [
  { key: 'shoulders', label: 'Shoulders', note: 'golden ratio' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'leftArm', label: 'Left Arm' },
  { key: 'rightArm', label: 'Right Arm' },
  { key: 'neck', label: 'Neck' },
  { key: 'leftCalf', label: 'Left Calf' },
  { key: 'rightCalf', label: 'Right Calf' },
  { key: 'leftThigh', label: 'Left Thigh' },
  { key: 'rightThigh', label: 'Right Thigh' },
  { key: 'hips', label: 'Hips' },
];

export type Frame = 'small' | 'medium' | 'large';

/**
 * Frame size from wrist girth (cm). Wrist-only thresholds (men's ranges) — a v1
 * simplification; traditional charts also factor height. Null when wrist is missing.
 */
export function frameFromWrist(wristCm: number | null | undefined): Frame | null {
  if (wristCm == null || !Number.isFinite(wristCm) || wristCm <= 0) return null;
  if (wristCm < 16.5) return 'small';
  if (wristCm <= 19) return 'medium';
  return 'large';
}

export type ProportionProgress =
  | { state: 'unset' }
  | { state: 'reached'; pct: number }
  | { state: 'building'; pct: number; remaining: number }
  | { state: 'on_target'; under: number }
  | { state: 'over'; over: number };

/**
 * Progress of a current measurement vs its target. `inverse` (waist) treats
 * smaller-or-equal as the goal; everything else grows toward the target. All values in the
 * same unit (cm). Returns `{ state: 'unset' }` when there's no current value.
 */
export function proportionProgress(
  currentCm: number | null | undefined,
  targetCm: number,
  inverse = false
): ProportionProgress {
  if (currentCm == null || !Number.isFinite(currentCm)) return { state: 'unset' };
  if (inverse) {
    if (currentCm <= targetCm) return { state: 'on_target', under: targetCm - currentCm };
    return { state: 'over', over: currentCm - targetCm };
  }
  if (targetCm <= 0) return { state: 'unset' };
  const pct = Math.max(0, Math.min(100, (currentCm / targetCm) * 100));
  if (currentCm >= targetCm) return { state: 'reached', pct: 100 };
  return { state: 'building', pct, remaining: targetCm - currentCm };
}
