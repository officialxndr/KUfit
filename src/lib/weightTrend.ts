/**
 * Weight **trend line** — an exponentially-weighted moving average (EWMA) of the scale weight, the
 * classic "Hacker's Diet" / Happy Scale approach. Day-to-day scale weight bounces with water, food,
 * and salt; the trend filters that noise so the *real* direction is visible — which is the whole
 * point: it eases the frustration of a bad-water-day spike by showing the smoothed reality.
 *
 * `trendₙ = trendₙ₋₁ + α·(weightₙ − trendₙ₋₁)`, seeded at the first weigh-in. Computed over the FULL
 * chronological history so the trend carries momentum into any zoomed window (a 1-week view still
 * shows a trend shaped by the weeks before it), then the caller slices to the visible range.
 *
 * α = 0.1 ≈ a ~10-weigh-in smoothing constant (the canonical value); lower = smoother/laggier.
 */
export interface TrendPoint {
  date: string;
  weightKg: number;
  /** EWMA of weightKg up to and including this weigh-in. */
  trendKg: number;
}

export function computeWeightTrend(
  entries: { date: string; weightKg: number }[],
  alpha = 0.1,
): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let trend = 0;
  return sorted.map((e, i) => {
    trend = i === 0 ? e.weightKg : trend + alpha * (e.weightKg - trend);
    return { date: e.date, weightKg: e.weightKg, trendKg: trend };
  });
}
