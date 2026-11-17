import { describe, it, expect } from '@jest/globals';
import { computeWeightTrend } from '@/lib/weightTrend';

describe('computeWeightTrend (EWMA, α = 0.1)', () => {
  it('starts at the first weigh-in and moves 10% toward each new one', () => {
    const t = computeWeightTrend([
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-01-02', weightKg: 79 },
      { date: '2026-01-03', weightKg: 81 },
    ]);
    expect(t[0].trendKg).toBe(80);
    expect(t[1].trendKg).toBeCloseTo(79.9, 6);
    expect(t[2].trendKg).toBeCloseTo(79.9 + 0.1 * (81 - 79.9), 6);
  });

  it('sorts by date first and keeps raw weights', () => {
    const t = computeWeightTrend([
      { date: '2026-01-03', weightKg: 78 },
      { date: '2026-01-01', weightKg: 80 },
    ]);
    expect(t.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-03']);
    expect(t[1].weightKg).toBe(78);
  });

  it('smooths out a one-day spike', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, weightKg: 80 }));
    days[5] = { ...days[5], weightKg: 83 }; // water-weight spike
    const t = computeWeightTrend(days);
    expect(Math.max(...t.map((p) => p.trendKg))).toBeLessThan(80.31);
  });

  it('handles empty input', () => {
    expect(computeWeightTrend([])).toEqual([]);
  });
});
