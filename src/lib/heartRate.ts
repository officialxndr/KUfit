import { colors } from '@/theme/tokens';

/**
 * Pure heart-rate helpers (ported convention: no side effects, no native calls).
 * Used to summarize a workout's BPM series, thin it for storage/charting, and
 * bucket it into the classic five training zones off the user's max HR.
 */

export interface HeartRateStats {
  avg: number;
  min: number;
  max: number;
}

/** Average / min / max of a BPM series; `null` when empty. */
export function summarizeHeartRate(bpms: number[]): HeartRateStats | null {
  if (!bpms.length) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const b of bpms) {
    sum += b;
    if (b < min) min = b;
    if (b > max) max = b;
  }
  return { avg: Math.round(sum / bpms.length), min: Math.round(min), max: Math.round(max) };
}

/** Evenly thin a series to at most `cap` points so stored JSON + the chart stay small. */
export function downsample(bpms: number[], cap = 120): number[] {
  if (bpms.length <= cap) return bpms.slice();
  const step = bpms.length / cap;
  const out: number[] = [];
  for (let i = 0; i < cap; i++) out.push(bpms[Math.floor(i * step)]);
  return out;
}

/** Age-predicted maximum heart rate (the standard 220 − age estimate). */
export function maxHeartRate(age: number): number {
  return 220 - age;
}

export interface HeartRateZone {
  key: string;
  label: string;
  /** Inclusive lower bound as a fraction of max HR. */
  lo: number;
  /** Exclusive upper bound as a fraction of max HR (1.01 for the top zone). */
  hi: number;
  color: string;
}

/** Five-zone model (% of max HR). Below 50% counts toward Z1. */
export const HR_ZONES: HeartRateZone[] = [
  { key: 'z1', label: 'Z1 · Easy', lo: 0, hi: 0.6, color: colors.success },
  { key: 'z2', label: 'Z2 · Fat burn', lo: 0.6, hi: 0.7, color: colors.macroCarbs },
  { key: 'z3', label: 'Z3 · Aerobic', lo: 0.7, hi: 0.8, color: colors.warning },
  { key: 'z4', label: 'Z4 · Threshold', lo: 0.8, hi: 0.9, color: colors.macroFat },
  { key: 'z5', label: 'Z5 · Max', lo: 0.9, hi: 1.01, color: colors.danger },
];

export interface ZoneShare {
  key: string;
  label: string;
  color: string;
  /** Share of samples in this zone, 0–1. */
  pct: number;
}

/**
 * Share of samples falling in each HR zone (equal-weight per sample — a good
 * approximation given roughly periodic sampling). Returns `null` without a
 * usable max HR or samples.
 */
export function zoneBreakdown(bpms: number[], maxHr: number | null): ZoneShare[] | null {
  if (!bpms.length || !maxHr || maxHr <= 0) return null;
  const counts = HR_ZONES.map(() => 0);
  for (const b of bpms) {
    const frac = b / maxHr;
    const idx = HR_ZONES.findIndex((z) => frac >= z.lo && frac < z.hi);
    counts[idx < 0 ? (frac < HR_ZONES[0].lo ? 0 : HR_ZONES.length - 1) : idx]++;
  }
  return HR_ZONES.map((z, i) => ({ key: z.key, label: z.label, color: z.color, pct: counts[i] / bpms.length }));
}
