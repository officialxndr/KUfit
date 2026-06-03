import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Card, FsText } from '@/components/ui';
import { MacroBars } from '@/components/MacroBar';
import { DateRangeBar } from '@/components/DateRangeBar';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { resolveTargets } from '@/lib/targets';
import { useDateRange } from '@/lib/useDateRange';
import { usePullRefresh } from '@/stores/refreshStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CHART_H = 80;
const MAX_BARS = 60; // bucket the calorie bars beyond this so long ranges stay readable
const REF = { fiber: 30, sugar: 50, saturatedFat: 20, sodium: 2300 };

export function FoodTrends() {
  const profile = useSettingsStore((s) => s.profile);
  const range = useDateRange('week');
  const { fromIso, endIso, days } = range;
  const [cals, setCals] = useState<number[]>([]);
  const [loggedDays, setLoggedDays] = useState(0);
  const [avgCalories, setAvgCalories] = useState(0);
  const [macroAvg, setMacroAvg] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [nutrientAvg, setNutrientAvg] = useState({ fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 });

  const refresh = useCallback(() => {
    const fromMs = parse(fromIso).getTime();
    const n = foodRepo.getRangeNutrition(fromIso, endIso);
    setLoggedDays(n.days);
    setAvgCalories(Math.round(n.avgCalories));
    setMacroAvg({ protein: n.avgProtein, carbs: n.avgCarbs, fat: n.avgFat });
    setNutrientAvg({ fiber: n.avgFiber, sugar: n.avgSugar, saturatedFat: n.avgSaturatedFat, sodium: n.avgSodium });

    // Per-day calories → bars, bucketed (averaged) past MAX_BARS so a year fits.
    const byDate = new Map(foodRepo.getDailyCalories(fromIso, endIso).map((r) => [r.date, r.calories]));
    const per: number[] = [];
    for (let i = 0; i < days; i++) per.push(byDate.get(isoDate(new Date(fromMs + i * DAY_MS))) ?? 0);
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

  const targets = resolveTargets(profile);
  const goal = targets.calorieTarget ?? 0;
  const maxV = Math.max(...cals, goal + 200, 1);

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
