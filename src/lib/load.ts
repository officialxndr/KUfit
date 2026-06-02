/**
 * Per-side load handling for volume math.
 *
 * The weight you log for a dumbbell/kettlebell move is the load in *one* hand, so a
 * two-arm movement (e.g. dumbbell bench press) moves twice that for volume purposes.
 * Each exercise has an optional `perSide` override; when unset we default it from the
 * equipment. Single-arm dumbbell work (one-arm row, concentration curl) should have
 * the override turned off, since the logged weight is already the total moved.
 *
 * Note: this only scales **volume** (weight × reps). One-rep-max / top-weight stay the
 * per-hand number, which is how dumbbell loads are normally quoted.
 */

const PER_SIDE_EQUIPMENT = new Set(['dumbbell', 'kettlebell']);

/** Default per-side guess from equipment when the exercise has no explicit override. */
export function defaultPerSide(equipment?: string | null): boolean {
  return !!equipment && PER_SIDE_EQUIPMENT.has(equipment.toLowerCase());
}

/** Effective per-side flag: explicit override if set, else the equipment default. */
export function isPerSide(ex: { perSide?: boolean | null; equipment?: string | null }): boolean {
  return ex.perSide ?? defaultPerSide(ex.equipment);
}

/** Volume multiplier: 2 for a per-side (two-implement) movement, else 1. */
export function loadFactor(ex: { perSide?: boolean | null; equipment?: string | null }): number {
  return isPerSide(ex) ? 2 : 1;
}
