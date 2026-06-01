import { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { MacroBars } from '@/components/MacroBar';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { resolveTargets } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space } from '@/theme/tokens';

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CHART_H = 80;
// Soft daily reference values for nutrients without an explicit profile target.
const REF = { fiber: 30, sugar: 50, saturatedFat: 20, sodium: 2300 };

const PERIODS: { key: string; label: string; days: number }[] = [
  { key: '7d', label: '7 Day', days: 7 },
  { key: '30d', label: '30 Day', days: 30 },
  { key: '90d', label: '90 Day', days: 90 },
];

export function FoodTrends() {
  const profile = useSettingsStore((s) => s.profile);
  const [period, setPeriod] = useState('7d');
  const [offset, setOffset] = useState(0); // 0 = window ending today; +1 = previous window
  const [cals, setCals] = useState<number[]>([]);
  const [macroAvg, setMacroAvg] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [nutrientAvg, setNutrientAvg] = useState({ fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 });

  const days = PERIODS.find((p) => p.key === period)!.days;
  // Window end shifts back by whole windows as the user pages with the arrows.
  const endDate = new Date(); endDate.setHours(0, 0, 0, 0);
  endDate.setDate(endDate.getDate() - offset * days);
  const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - (days - 1));

  const refresh = useCallback(() => {
    const byDate = new Map(foodRepo.getDailyCalories(isoDate(startDate), isoDate(endDate)).map((r) => [r.date, r.calories]));

    const series: number[] = [];
    let pSum = 0, cSum = 0, fSum = 0, fibSum = 0, sugSum = 0, satSum = 0, sodSum = 0, logged = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = isoDate(new Date(endDate.getTime() - i * DAY_MS));
      const c = byDate.get(d) ?? 0;
      series.push(c);
      if (c > 0) {
        const t = foodRepo.getDayTotals(d);
        pSum += t.protein; cSum += t.carbs; fSum += t.fat;
        fibSum += t.fiber; sugSum += t.sugar; satSum += t.saturatedFat; sodSum += t.sodium;
        logged++;
      }
    }
    setCals(series);
    const n = logged || 1;
    setMacroAvg(logged > 0 ? { protein: pSum / n, carbs: cSum / n, fat: fSum / n } : { protein: 0, carbs: 0, fat: 0 });
    setNutrientAvg(logged > 0 ? { fiber: fibSum / n, sugar: sugSum / n, saturatedFat: satSum / n, sodium: sodSum / n } : { fiber: 0, sugar: 0, saturatedFat: 0, sodium: 0 });
  }, [days, offset]);

  useFocusEffect(refresh);

  const changePeriod = (key: string) => { setPeriod(key); setOffset(0); };
  const rangeLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const nutrientGoals = profile.nutrientGoals ?? [];
  const targetFor = (key: string, fallback: number) => nutrientGoals.find((g) => g.key === key)?.target ?? fallback;

  const targets = resolveTargets(profile);
  const goal = targets.calorieTarget ?? 0;
  const logged = cals.filter((v) => v > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  const maxV = Math.max(...cals, goal + 200, 1);

  const status =
    goal === 0 || avg === 0
      ? { label: '—', color: colors.muted }
      : avg > goal * 1.05
        ? { label: 'Slightly over', color: colors.danger }
        : avg < goal * 0.85
          ? { label: 'Under target', color: colors.warning }
          : { label: 'On track', color: colors.success };

  return (
    <>
      {/* Period toggle */}
      <View style={styles.toggle}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Pressable key={p.key} style={[styles.toggleBtn, active && styles.toggleActive]} onPress={() => changePeriod(p.key)}>
              <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>
                {p.label}
              </FsText>
            </Pressable>
          );
        })}
      </View>

      {/* Window navigator */}
      <View style={styles.windowNav}>
        <Pressable onPress={() => setOffset((o) => o + 1)} hitSlop={8} style={styles.navArrow}>
          <ChevronLeft color={colors.muted} size={20} />
        </Pressable>
        <FsText variant="bodyMedium">{rangeLabel}</FsText>
        <Pressable onPress={() => setOffset((o) => Math.max(0, o - 1))} hitSlop={8} disabled={offset === 0} style={[styles.navArrow, offset === 0 && { opacity: 0.3 }]}>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
      </View>

      {/* Stat cards */}
      <View style={styles.statRow}>
        {([
          ['Avg', goal && avg ? `${avg.toLocaleString()}` : '—'],
          ['Goal', goal ? goal.toLocaleString() : '—'],
          ['Logged', `${logged.length} / ${cals.length}d`],
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
          {goal > 0 && (
            <View style={[styles.goalLine, { bottom: (goal / maxV) * CHART_H }]} />
          )}
          <View style={styles.bars}>
            {cals.map((v, i) => {
              const h = v > 0 ? Math.max((v / maxV) * CHART_H, 3) : 0;
              const over = goal > 0 && v > goal * 1.1;
              return (
                <View key={i} style={styles.barCol}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: period === '7d' ? 28 : undefined,
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
        {period === '7d' && (
          <View style={styles.labels}>
            {cals.map((_, i) => {
              const d = new Date(endDate.getTime() - (cals.length - 1 - i) * DAY_MS);
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

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: space[1],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: space[3],
  },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.primary },
  statRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  statCard: { flex: 1, alignItems: 'center' },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1.5,
    borderTopColor: colors.primary,
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  labels: { flexDirection: 'row', marginTop: space[2], gap: 2 },
  windowNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  navArrow: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nutrientTrack: { height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
});
