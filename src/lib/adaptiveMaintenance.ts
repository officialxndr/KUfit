import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { calcEmpiricalMaintenance } from '@/lib/tdee';
import { parseLocalDay, todayLocal, addDays } from '@/lib/date';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRefreshStore } from '@/stores/refreshStore';
import { syncWidget } from '@/lib/widget';

/**
 * Empirical / adaptive TDEE — back-calculates real maintenance calories from the user's
 * own logged intake vs. their ground-truth scale weight change (maintenance =
 * avgIntake − Δmass×7700/days). Lifted out of the Food-stats card so it can also drive
 * the daily calorie target: `recomputeAdaptiveMaintenance()` caches the latest value on
 * the profile, and `src/lib/targets.ts` reads that cache as the maintenance base (with a
 * goal deficit applied on top) when `profile.calorieBasis === 'adaptive'`.
 *
 * Accuracy note: a *consistent* logging bias cancels out (the estimate and your eating
 * both shift by the same amount), so what matters is logging *consistency*, not absolute
 * accuracy — hence the strict data-sufficiency gates below.
 */

const DAY_MS = 86_400_000;

// Data-sufficiency floors.
const MIN_WEIGH_INS = 3;          // a slope needs ≥3 points to be more than a two-reading guess
const MIN_SPAN_DAYS = 14;         // weigh-ins must bracket ≥ ~2 weeks (short spans are too noisy)
const MIN_LOGGED_DAYS = 10;       // and enough logged food days to trust the intake average
const MIN_LOG_DENSITY = 0.5;      // …covering ≥ half the span (so logged days represent the whole period)
const MIN_FULL_DAY_KCAL = 500;    // days below this are treated as incomplete logging, not a real day of eating
const MAX_TREND_RATE_KG_WK = 1.5; // a trend faster than this is ~always water/glycogen, not real energy balance

/** Trailing window the background recompute uses to drive the calorie target. */
export const ADAPTIVE_WINDOW_DAYS = 28;

export type MaintResult =
  | { ok: true; maintenance: number; avgIntake: number; deltaKg: number; spanDays: number; loggedDays: number; totalDays: number }
  | { ok: false; reason: string };

/** Least-squares slope (units of y per unit of x). Returns null if x has no spread. */
function linRegressionSlope(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? null : num / den;
}

/**
 * Empirical maintenance over [fromIso, endIso]: back-calculate expenditure from the user's
 * average intake vs. their weight change across the same weigh-in span. The weight trend is
 * a least-squares fit over every in-span weigh-in (robust to endpoint water-weight noise +
 * uneven spacing — slope×span is the change over exactly the intake period), the intake
 * average is over days that look like full logging within that same span, and the whole
 * thing is gated on data density so a sparse/partial-logged window can't produce a
 * confident-but-wrong number. Returns an insufficiency reason when the data's too thin.
 */
export function computeAdaptiveMaintenance(fromIso: string, endIso: string): MaintResult {
  const entries = healthRepo.getWeightEntries(fromIso, endIso);
  if (entries.length < MIN_WEIGH_INS) {
    return { ok: false, reason: `Log at least ${MIN_WEIGH_INS} weigh-ins in this range to calculate maintenance.` };
  }
  const first = entries[0].date;
  const last = entries[entries.length - 1].date;
  const spanDays = Math.round((parseLocalDay(last).getTime() - parseLocalDay(first).getTime()) / DAY_MS);
  if (spanDays < MIN_SPAN_DAYS) {
    return { ok: false, reason: `Weigh-ins span only ${spanDays} day${spanDays === 1 ? '' : 's'} — needs ~2+ weeks. Try a longer range.` };
  }

  // Fit the weight trend across ALL in-span weigh-ins (day-offset → kg) so a single
  // noisy reading can't dominate; Δ over the span = slope × spanDays.
  const dayOffset = (d: string) => (parseLocalDay(d).getTime() - parseLocalDay(first).getTime()) / DAY_MS;
  const slope = linRegressionSlope(entries.map((e) => dayOffset(e.date)), entries.map((e) => e.weightKg));
  if (slope == null) {
    return { ok: false, reason: 'Weigh-ins are all on one day — spread readings across the range.' };
  }
  const deltaKg = slope * spanDays;
  // Reject a trend too fast to be real fat change — it'd be water/glycogen, not energy balance.
  if (Math.abs(slope) * 7 > MAX_TREND_RATE_KG_WK) {
    return { ok: false, reason: 'Weight swung too sharply over this span to calculate reliably (likely water weight). Try a longer range.' };
  }

  // Intake over the SAME span, counting only days that look like a full day of logging
  // (near-zero days are partial logs, not real intake, and would bias maintenance low).
  const fullDays = foodRepo.getDailyCalories(first, last).filter((r) => r.calories >= MIN_FULL_DAY_KCAL);
  const totalDays = spanDays + 1;
  const daysNeeded = Math.max(MIN_LOGGED_DAYS, Math.ceil(totalDays * MIN_LOG_DENSITY));
  if (fullDays.length < daysNeeded) {
    return { ok: false, reason: `Only ${fullDays.length} of ${totalDays} days logged in this span — need ~${daysNeeded}+ full days for a reliable estimate.` };
  }
  const avgIntake = fullDays.reduce((s, r) => s + r.calories, 0) / fullDays.length;

  const res = calcEmpiricalMaintenance({ avgDailyIntakeKcal: avgIntake, weightChangeKg: deltaKg, days: spanDays });
  // A pass through every data gate but a ≤0 result means gain-vs-intake contradiction (water weight), not scarcity.
  if (!res) return { ok: false, reason: 'Your weight and intake don’t line up over this span (likely water weight). Try a longer range.' };
  return { ok: true, maintenance: res.maintenance, avgIntake, deltaKg, spanDays, loggedDays: fullDays.length, totalDays };
}

/**
 * Recompute the empirical maintenance over the trailing {@link ADAPTIVE_WINDOW_DAYS}-day
 * window and cache it on the profile (kcal / updatedAt / loggedDays), so the target
 * resolver can read it synchronously in hot paths. Writes null kcal when the data's too
 * thin (the resolver then falls back to the formula). Only persists when something changed
 * or the day rolled over (keeping `updatedAt` fresh for the resolver's staleness check),
 * and only signals a UI/widget refresh when the kcal value actually moved.
 */
export function recomputeAdaptiveMaintenance(): void {
  // Exception-safe: it's called on launch/foreground (chained after health-sync), where a
  // transient DB-not-ready read would otherwise become an unhandled rejection.
  try {
    const end = todayLocal();
    const from = addDays(end, -(ADAPTIVE_WINDOW_DAYS - 1));
    const result = computeAdaptiveMaintenance(from, end);
    const kcal = result.ok ? result.maintenance : null;
    const loggedDays = result.ok ? result.loggedDays : null;

    const { profile, setProfile } = useSettingsStore.getState();
    const kcalChanged = profile.adaptiveMaintenanceKcal !== kcal;
    const changed = kcalChanged || profile.adaptiveMaintenanceLoggedDays !== loggedDays;
    const dayRolled = profile.adaptiveMaintenanceUpdatedAt !== end;
    if (!changed && !dayRolled) return;

    setProfile({
      adaptiveMaintenanceKcal: kcal,
      adaptiveMaintenanceLoggedDays: loggedDays,
      adaptiveMaintenanceUpdatedAt: end,
    });
    // Only the kcal value affects the calorie target / widget snapshot — a loggedDays-only or
    // day-rollover write persists silently without a redundant refresh + native widget reload.
    if (kcalChanged) {
      useRefreshStore.getState().bump();
      syncWidget();
    }
  } catch {
    // leave the last good cache in place
  }
}
