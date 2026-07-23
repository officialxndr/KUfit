import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card, FsText } from '@/components/ui';
import { MacroBars } from '@/components/MacroBar';
import { DateRangeBar } from '@/components/DateRangeBar';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveBaseTargets } from '@/lib/targets';
import { calcEmpiricalMaintenance } from '@/lib/tdee';
import { useDateRange } from '@/lib/useDateRange';
import { usePullRefresh } from '@/stores/refreshStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import { isoLocalDay, addDays, parseLocalDay, todayLocal } from '@/lib/date';

const DAY_MS = 86_400_000;
const isoDate = isoLocalDay;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CHART_H = 80;
const MAX_BARS = 60; // bucket the calorie bars beyond this so long ranges stay readable
const REF = { fiber: 30, sugar: 50, saturatedFat: 20, sodium: 2300 };

// "Calculated maintenance" (adaptive TDEE) data-sufficiency floors.
const MIN_WEIGH_INS = 3;          // a slope needs ≥3 points to be more than a two-reading guess
const MIN_SPAN_DAYS = 14;         // weigh-ins must bracket ≥ ~2 weeks (short spans are too noisy)
const MIN_LOGGED_DAYS = 10;       // and enough logged food days to trust the intake average
const MIN_LOG_DENSITY = 0.5;      // …covering ≥ half the span (so logged days represent the whole period)
const MIN_FULL_DAY_KCAL = 500;    // days below this are treated as incomplete logging, not a real day of eating
const MAX_TREND_RATE_KG_WK = 1.5; // a trend faster than this is ~always water/glycogen, not real energy balance

type MaintResult =
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
 * Empirical maintenance over the selected window: back-calculate expenditure from the
 * user's own average intake vs. their weight change across the same weigh-in span
 * (maintenance = avgIntake − Δmass×7700/days). The weight trend is a least-squares fit
 * over every in-span weigh-in (robust to endpoint water-weight noise + uneven spacing —
 * slope×span is the change over exactly the intake period), the intake average is over
 * days that look like full logging within that same span, and the whole thing is gated
 * on data density so a sparse/partial-logged window can't produce a confident-but-wrong
 * number. Returns an insufficiency reason when the data's too thin to trust.
 */
function computeMaintenance(fromIso: string, endIso: string): MaintResult {
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

export function FoodTrends() {
  const profile = useSettingsStore((s) => s.profile);
  const range = useDateRange('week');
  const { fromIso, endIso, days } = range;
  const [cals, setCals] = useState<number[]>([]);
  const [loggedDays, setLoggedDays] = useState(0);
  const [avgCalories, setAvgCalories] = useState(0);
  const [macroAvg, setMacroAvg] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [nutrientAvg, setNutrientAvg] = useState({ fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 });
  const [maint, setMaint] = useState<MaintResult | null>(null);

  const refresh = useCallback(() => {
    const n = foodRepo.getRangeNutrition(fromIso, endIso);
    setLoggedDays(n.days);
    setAvgCalories(Math.round(n.avgCalories));
    setMacroAvg({ protein: n.avgProtein, carbs: n.avgCarbs, fat: n.avgFat });
    setNutrientAvg({ fiber: n.avgFiber, sugar: n.avgSugar, saturatedFat: n.avgSaturatedFat, sodium: n.avgSodium });
    setMaint(computeMaintenance(fromIso, endIso));

    // Per-day calories → bars, bucketed (averaged) past MAX_BARS so a year fits.
    const byDate = new Map(foodRepo.getDailyCalories(fromIso, endIso).map((r) => [r.date, r.calories]));
    const per: number[] = [];
    for (let i = 0; i < days; i++) per.push(byDate.get(addDays(fromIso, i)) ?? 0);
    if (days <= MAX_BARS) {
      setCals(per);
    } else {
      const buckets = MAX_BARS;
      const sum = new Array(buckets).fill(0);
      const cnt = new Array(buckets).fill(0);
      per.forEach((v, i) => { const b = Math.min(buckets - 1, Math.floor((i / days) * buckets)); sum[b] += v; cnt[b] += 1; });
      setCals(sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0)));
    }
  }, [fromIso, endIso, days]);

  useFocusEffect(refresh);
  usePullRefresh(refresh);

  const nutrientGoals = profile.nutrientGoals ?? [];
  const targetFor = (key: string, fallback: number) => nutrientGoals.find((g) => g.key === key)?.target ?? fallback;

  const targets = resolveBaseTargets(profile); // window goal line = base target (burn is per-day, added on the day)
  const goal = targets.calorieTarget ?? 0;
  const maxV = Math.max(...cals, goal + 200, 1);

  const imperial = profile.unitSystem === 'IMPERIAL';
  const wUnit = imperial ? 'lb' : 'kg';
  const toWeight = (kg: number) => (imperial ? kg * 2.20462 : kg);
  const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString();
  // The formula TDEE always reflects *today's* weight, so only compare it to the empirical
  // number when the window includes today (else it's an apples-to-oranges historical mismatch).
  const windowHasToday = endIso >= todayLocal();

  const status =
    goal === 0 || avgCalories === 0
      ? { label: '—', color: colors.muted }
      : avgCalories > goal * 1.05
        ? { label: 'Slightly over', color: colors.danger }
        : avgCalories < goal * 0.85
          ? { label: 'Under target', color: colors.warning }
          : { label: 'On track', color: colors.success };

  const showWeekdays = days === 7 && cals.length === 7;

  return (
    <>
      <DateRangeBar range={range} />

      {/* Stat cards */}
      <View style={styles.statRow}>
        {([
          ['Avg', goal && avgCalories ? `${avgCalories.toLocaleString()}` : '—'],
          ['Goal', goal ? goal.toLocaleString() : '—'],
          ['Logged', `${loggedDays} / ${days}d`],
        ] as const).map(([l, v]) => (
          <Card key={l} style={styles.statCard}>
            <FsText variant="overline">{l}</FsText>
            <FsText variant="cardTitle" style={{ marginTop: 4 }}>{v}</FsText>
          </Card>
        ))}
      </View>

      {/* Calorie chart */}
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.cardHead}>
          <FsText variant="cardTitle">Calorie Intake</FsText>
          <FsText variant="caption" style={{ color: status.color, fontWeight: '600' }}>{status.label}</FsText>
        </View>
        <View style={{ height: CHART_H }}>
          {goal > 0 && <View style={[styles.goalLine, { bottom: (goal / maxV) * CHART_H }]} />}
          <View style={styles.bars}>
            {cals.map((v, i) => {
              const h = v > 0 ? Math.max((v / maxV) * CHART_H, 3) : 0;
              const over = goal > 0 && v > goal * 1.1;
              return (
                <View key={i} style={styles.barCol}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: cals.length <= 7 ? 28 : undefined,
                      height: h,
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                      backgroundColor: v === 0 ? colors.surfaceHigh : over ? colors.danger : colors.primary,
                      opacity: v === 0 ? 0.4 : 0.85,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
        {showWeekdays && (
          <View style={styles.labels}>
            {cals.map((_, i) => {
              const d = parse(fromIso); d.setDate(d.getDate() + i);
              return (
                <FsText key={i} variant="caption" style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
                  {WEEKDAY[d.getDay()]}
                </FsText>
              );
            })}
          </View>
        )}
      </Card>

      {/* Calculated maintenance — adaptive TDEE from intake vs. weight change */}
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.cardHead}>
          <FsText variant="cardTitle">Calculated maintenance</FsText>
          {maint?.ok && windowHasToday && targets.tdee != null && (
            <FsText variant="caption" style={{ color: colors.muted }}>Formula: {targets.tdee.toLocaleString()}</FsText>
          )}
        </View>
        {maint?.ok ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <FsText variant="cardTitle" style={styles.bigNum}>{maint.maintenance.toLocaleString()}</FsText>
              <FsText variant="caption">cal / day</FsText>
            </View>
            {(() => {
              const mag = fmt1(Math.abs(toWeight(maint.deltaKg)));
              const held = mag === '0';
              const verb = held ? 'Held steady' : maint.deltaKg < 0 ? 'Lost' : 'Gained';
              return (
                <FsText variant="caption" style={{ marginTop: space[1], color: colors.muted }}>
                  {verb}{held ? '' : ` ${mag} ${wUnit}`} on {Math.round(maint.avgIntake).toLocaleString()} cal/day over{' '}
                  {maint.spanDays} days ({maint.loggedDays} of {maint.totalDays} logged).
                </FsText>
              );
            })()}
            {windowHasToday && targets.tdee != null && (
              <FsText variant="caption" style={{ marginTop: space[1] }}>
                {Math.abs(maint.maintenance - targets.tdee) < 25
                  ? 'Right in line with the formula estimate.'
                  : `Your data runs ~${Math.abs(maint.maintenance - targets.tdee).toLocaleString()} cal/day ${maint.maintenance > targets.tdee ? 'higher' : 'lower'} than the formula.`}
              </FsText>
            )}
          </>
        ) : (
          <FsText variant="caption" style={{ color: colors.muted }}>
            {maint?.reason ?? 'Log food and weigh-ins over a couple of weeks to calculate your maintenance.'}
          </FsText>
        )}
      </Card>

      {/* Avg macro split */}
      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Avg Macro Split</FsText>
        <MacroBars
          protein={macroAvg.protein}
          carbs={macroAvg.carbs}
          fat={macroAvg.fat}
          proteinTarget={targets.proteinTarget}
          carbsTarget={targets.carbsTarget}
          fatTarget={targets.fatTarget}
        />
      </Card>

      {/* Other nutrients — avg per logged day vs target */}
      <Card>
        <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Other Nutrients · daily avg</FsText>
        <View style={{ gap: space[3] }}>
          <NutrientBar label="Fiber" value={nutrientAvg.fiber} target={targetFor('fiber', REF.fiber)} unit="g" color={colors.macroCarbs} />
          <NutrientBar label="Sugar" value={nutrientAvg.sugar} target={targetFor('sugar', REF.sugar)} unit="g" color={colors.macroFat} />
          <NutrientBar label="Sat. fat" value={nutrientAvg.saturatedFat} target={targetFor('saturatedFat', REF.saturatedFat)} unit="g" color={colors.macroProtein} />
          <NutrientBar label="Sodium" value={nutrientAvg.sodium} target={targetFor('sodium', REF.sodium)} unit="mg" color={colors.warning} />
        </View>
        <FsText variant="caption" style={{ marginTop: space[3] }}>Averaged across days with logged food in this window.</FsText>
      </Card>
    </>
  );
}

function NutrientBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={{ gap: 5 }}>
      <View style={styles.barHead}>
        <FsText variant="caption">{label}</FsText>
        <FsText variant="caption" style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>
          {Math.round(value)} / {target}{unit}
        </FsText>
      </View>
      <View style={styles.nutrientTrack}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  statRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  statCard: { flex: 1, alignItems: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  bigNum: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  goalLine: {
    position: 'absolute', left: 0, right: 0, height: 0,
    borderTopWidth: 1.5, borderTopColor: colors.primary, borderStyle: 'dashed', opacity: 0.4,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  labels: { flexDirection: 'row', marginTop: space[2], gap: 2 },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nutrientTrack: { height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
}));
