import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Flame, Dumbbell, Utensils, Trophy, Activity, ChevronRight, CalendarCheck, Scale,
} from 'lucide-react-native';

import { Card, FsText, Badge, SectionHeader } from '@/components/ui';
import { MacroBars } from '@/components/MacroBar';
import { LineChart } from '@/components/LineChart';
import { MuscleMap } from '@/components/MuscleMap';
import { DateRangeBar } from '@/components/DateRangeBar';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { GrowBar } from '@/components/anim/GrowBar';
import { PressableScale } from '@/components/anim/PressableScale';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { resolveBaseTargets, describePace, goalDateStat } from '@/lib/targets';
import { navyBodyFat, estimateBodyFat } from '@/lib/bodyComposition';
import { useDateRange } from '@/lib/useDateRange';
import { formatWeight, formatVolume } from '@/lib/units';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { usePullRefresh } from '@/stores/refreshStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { GoalPhase } from '@/types';
import { isoLocalDay, addDays } from '@/lib/date';

const DAY_MS = 86_400_000;
const MAX_TREND_POINTS = 180;
const isoDate = isoLocalDay;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);

/** Grey → green cell tint for a 0–3 daily activity score (weight + food + workout logged). */
function activityStyle(score: number) {
  if (score <= 0) return { backgroundColor: colors.surfaceHigh };
  return { backgroundColor: colors.success, opacity: score === 1 ? 0.35 : score === 2 ? 0.62 : 1 };
}

interface ReportData {
  loggedDays: number; totalDays: number;
  avgCalories: number; avgProtein: number; avgCarbs: number; avgFat: number; calorieTrend: number[];
  foodStreak: number; workoutStreak: number;
  workouts: number; totalVolume: number; burned: number; prCount: number;
  recentPRs: { name: string; detail: string; date: string }[];
  muscleCounts: Record<string, number>; weeklyVolume: number[]; daysActive: number;
  currentKg: number | null; windowAvg: number | null; windowChange: number | null;
  goalEta: string | null; goalTargetDate: string | null; pace: { title: string; message: string } | null;
  bf: number | null; leanKg: number | null; fatKg: number | null; bmi: number | null; ffmi: number | null;
  phase: GoalPhase | null; goalProgress: number | null; startKg: number | null; goalKg: number | null;
  activityScores: { date: string; score: number }[];
}

/** Consecutive days ending at `endMs` (the end day may be empty) present in `dayset`. */
function streakFrom(dayset: Set<string>, endMs: number): number {
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = isoDate(new Date(endMs - i * DAY_MS));
    if (dayset.has(d)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

export function DashboardReports() {
  const profile = useSettingsStore((s) => s.profile);
  const unit = profile.unitSystem;
  const setSection = useNavStore((s) => s.setSection);
  const range = useDateRange('month');
  const { fromIso, endIso, days, isCurrent, todayIso } = range;
  const [data, setData] = useState<ReportData | null>(null);

  const refresh = useCallback(() => {
    const endMs = parse(endIso).getTime();
    const fromMs = parse(fromIso).getTime();
    const current = endIso >= todayIso;

    // ── Nutrition ──
    const n = foodRepo.getRangeNutrition(fromIso, endIso);
    const daily = foodRepo.getDailyCalories(fromIso, endIso);
    const byDate = new Map(daily.map((r) => [r.date, r.calories]));
    // Bucket the calorie trend so the chart stays bounded for long custom ranges.
    // Only logged days count — an unlogged day isn't a 0-calorie day, so skipping it
    // keeps the line off a phantom zero and consistent with the logged-days-only average.
    const buckets = Math.min(days, MAX_TREND_POINTS);
    const tSum = new Array(buckets).fill(0);
    const tCnt = new Array(buckets).fill(0);
    for (let i = 0; i < days; i++) {
      const cal = byDate.get(addDays(fromIso, i));
      if (cal == null) continue;
      const b = Math.min(buckets - 1, Math.floor((i / days) * buckets));
      tSum[b] += cal; tCnt[b] += 1;
    }
    const calorieTrend = tSum
      .map((s, i) => (tCnt[i] ? s / tCnt[i] : null))
      .filter((v): v is number => v != null);

    // ── Training (within the window) ──
    const sessions = workoutRepo.getSessions(500);
    const inWindow = sessions.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= fromMs && t < endMs + DAY_MS;
    });
    const workouts = inWindow.length;
    const totalVolume = inWindow.reduce((a, s) => a + (s.totalVolume ?? 0), 0);
    const burned = inWindow.reduce((a, s) => a + (s.caloriesBurned ?? 0), 0);
    let prCount = 0;
    const recentPRs: ReportData['recentPRs'] = [];
    for (const s of inWindow) {
      for (const e of s.exercises) {
        for (const st of e.sets) {
          if (st.isPersonalBest) {
            prCount++;
            if (recentPRs.length < 5) recentPRs.push({
              name: e.exercise.name,
              detail: `${formatWeight(st.weightKg, unit)} × ${st.reps}`,
              date: new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            });
          }
        }
      }
    }

    // Muscle balance — sets per group across the whole window; target scaled to the
    // window length in render, so the fade reads the same from a week to a year.
    const muscleCounts: Record<string, number> = {};
    for (const s of inWindow) {
      for (const e of s.exercises) {
        const k = (e.exercise.muscleGroup ?? '').toLowerCase();
        if (k) muscleCounts[k] = (muscleCounts[k] ?? 0) + e.sets.length;
      }
    }

    // Weekly volume, the 8 weeks ending at the window end (oldest → newest).
    const weeks = new Array(8).fill(0);
    const endMid = new Date(endMs); endMid.setHours(0, 0, 0, 0);
    for (const s of sessions) {
      const sDay = new Date(s.startedAt); sDay.setHours(0, 0, 0, 0);
      const wk = Math.floor((endMid.getTime() - sDay.getTime()) / DAY_MS / 7);
      if (wk >= 0 && wk < 8) weeks[wk] += s.totalVolume ?? 0;
    }
    const weeklyVolume = weeks.slice().reverse();

    // ── Streaks + consistency (ending at the window end) ──
    const foodDaysWindow = new Set(daily.filter((r) => r.calories > 0).map((r) => r.date));
    const longFrom = isoDate(new Date(endMs - 90 * DAY_MS));
    const foodDaysLong = new Set(foodRepo.getDailyCalories(longFrom, endIso).filter((r) => r.calories > 0).map((r) => r.date));
    const workoutDays = new Set(sessions.map((s) => isoDate(new Date(s.startedAt))));
    const foodStreak = streakFrom(foodDaysLong, endMs);
    const workoutStreak = streakFrom(workoutDays, endMs);
    const windowWorkoutDays = new Set(inWindow.map((s) => isoDate(new Date(s.startedAt))));
    const daysActive = new Set([...foodDaysWindow, ...windowWorkoutDays]).size;

    // ── Weight & body composition (as of the window end) ──
    const entriesUpTo = healthRepo.getWeightEntries('1970-01-01', endIso); // ascending
    const currentEntry = entriesUpTo[entriesUpTo.length - 1] ?? null;
    const windowEntries = entriesUpTo.filter((e) => e.date >= fromIso);
    const currentKg = currentEntry?.weightKg ?? null;
    const windowChange = windowEntries.length >= 2 ? windowEntries[windowEntries.length - 1].weightKg - windowEntries[0].weightKg : null;
    const windowAvg = windowEntries.length ? windowEntries.reduce((a, e) => a + e.weightKg, 0) / windowEntries.length : null;

    // ── Per-day activity for the consistency grid: food + weigh-in + workout that day (0–3) ──
    const weightDaysWindow = new Set(windowEntries.map((e) => e.date));
    const activityScores: { date: string; score: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(fromIso, i);
      activityScores.push({ date: d, score: (foodDaysWindow.has(d) ? 1 : 0) + (weightDaysWindow.has(d) ? 1 : 0) + (windowWorkoutDays.has(d) ? 1 : 0) });
    }

    let goalEta: string | null = null;
    let goalTargetDate: string | null = null;
    let pace: ReportData['pace'] = null;
    if (current) {
      const stats = healthRepo.computeStats(profile.goalWeightKg, healthRepo.getActiveGoalPhase()?.endDate ?? profile.goalDate);
      goalEta = stats.goalEta;
      goalTargetDate = stats.goalTargetDate;
      if (stats.dailyCalorieDelta != null && !stats.onTrack && profile.showCoachingNudges) {
        pace = describePace(stats.dailyCalorieDelta, (stats.requiredWeeklyRate ?? 0) >= 0 ? 'lose' : 'gain');
      }
    }

    const baseline = healthRepo.getLatestBodyFatBaseline();
    const measurement = healthRepo.getLatestMeasurementBySite();
    const navyBf = profile.navyBodyFatEnabled && measurement && profile.heightCm && (profile.sex === 'MALE' || profile.sex === 'FEMALE')
      ? navyBodyFat({ sex: profile.sex, heightCm: profile.heightCm, neckCm: measurement.neck ?? 0, waistCm: measurement.waist ?? 0, hipCm: measurement.hips })
      : null;
    let bf: number | null = null;
    if (currentEntry?.bodyFat != null) bf = currentEntry.bodyFat;
    else if (baseline?.bodyFat != null && currentKg != null) bf = estimateBodyFat(baseline.weightKg, baseline.bodyFat, currentKg);
    else if (navyBf != null) bf = navyBf;

    const fatKg = currentKg != null && bf != null ? (currentKg * bf) / 100 : null;
    const leanKg = currentKg != null && fatKg != null ? currentKg - fatKg : null;
    const hM = profile.heightCm ? profile.heightCm / 100 : null;
    const bmi = currentKg != null && hM ? currentKg / (hM * hM) : null;
    const ffmi = leanKg != null && hM ? leanKg / (hM * hM) : null;

    // ── Goals ──
    const phase = healthRepo.getActiveGoalPhase();
    const goalKg = profile.goalWeightKg;
    const startKg = entriesUpTo.length ? entriesUpTo[0].weightKg : null;
    let goalProgress: number | null = null;
    if (goalKg != null && startKg != null && currentKg != null && startKg !== goalKg) {
      goalProgress = Math.max(0, Math.min(1, (startKg - currentKg) / (startKg - goalKg)));
    }

    setData({
      loggedDays: n.days, totalDays: days, avgCalories: n.avgCalories, avgProtein: n.avgProtein,
      avgCarbs: n.avgCarbs, avgFat: n.avgFat, calorieTrend, foodStreak, workoutStreak, workouts,
      totalVolume, burned, prCount, recentPRs, muscleCounts, weeklyVolume, daysActive,
      currentKg, windowAvg, windowChange, goalEta, goalTargetDate, pace, bf, leanKg, fatKg, bmi, ffmi, activityScores,
      phase, goalProgress, startKg, goalKg,
    });
  }, [fromIso, endIso, days, todayIso, profile.goalWeightKg, profile.goalDate, profile.heightCm, profile.sex, profile.navyBodyFatEnabled, profile.showCoachingNudges, unit]);

  useFocusEffect(refresh);
  usePullRefresh(refresh);

  const targets = resolveBaseTargets(profile); // window target = base (per-day burn isn't a window constant)
  const goalStat = goalDateStat(data, profile.goalDateMode);

  return (
    <>
      <DateRangeBar range={range} />

      {!data ? null : (
        <>
          {/* At a glance */}
          <View style={styles.grid}>
            <Stat icon={CalendarCheck} label="Days logged" value={data.loggedDays} suffix={` / ${data.totalDays}`} />
            <Stat icon={Utensils} label="Avg calories" value={Math.round(data.avgCalories)} suffix=" kcal" />
            <Stat icon={Dumbbell} label="Workouts" value={data.workouts} />
            <Stat icon={Activity} label="Volume" value={data.totalVolume} format={(v) => formatVolume(v, unit)} />
            <Stat icon={Flame} label="Log streak" value={data.foodStreak} suffix={data.foodStreak === 1 ? ' day' : ' days'} />
            <Stat icon={Trophy} label="Workout streak" value={data.workoutStreak} suffix={data.workoutStreak === 1 ? ' day' : ' days'} />
            {data.burned > 0 && <Stat icon={Flame} label="Burned" value={Math.round(data.burned)} suffix=" kcal" />}
            <Stat icon={Trophy} label="New PRs" value={data.prCount} />
          </View>

          {/* Nutrition */}
          <Card style={styles.card}>
            <SectionHeader title="Nutrition" />
            <FsText variant="caption" style={{ marginBottom: space[3] }}>
              Averaged over {data.loggedDays} logged day{data.loggedDays === 1 ? '' : 's'}
              {targets.calorieTarget ? ` · target ${targets.calorieTarget} kcal` : ''}.
            </FsText>
            <View style={styles.rowBetween}>
              <FsText variant="caption">Avg daily calories</FsText>
              <AnimatedNumber value={Math.round(data.avgCalories)} variant="stat" />
            </View>
            <View style={{ marginTop: space[3] }}>
              <MacroBars
                protein={data.avgProtein} carbs={data.avgCarbs} fat={data.avgFat}
                proteinTarget={targets.proteinTarget} carbsTarget={targets.carbsTarget} fatTarget={targets.fatTarget}
              />
            </View>
            {data.calorieTrend.some((c) => c > 0) && (
              <View style={{ marginTop: space[4] }}>
                <FsText variant="caption" style={{ marginBottom: space[2] }}>Calorie intake</FsText>
                <LineChart series={[{ points: data.calorieTrend, color: colors.primary }]} height={120} />
              </View>
            )}
          </Card>

          {/* Weight & body composition */}
          <Card style={styles.card}>
            <SectionHeader title="Weight &amp; body" />
            <View style={styles.rowBetween}>
              <View>
                <FsText variant="caption">{isCurrent ? 'Current' : 'As of ' + range.fmt(endIso)}</FsText>
                {data.currentKg != null
                  ? <AnimatedNumber value={data.currentKg} format={(v) => formatWeight(v, unit)} variant="stat" />
                  : <FsText variant="stat">—</FsText>}
                {data.windowChange != null && (
                  <FsText variant="caption" style={{ color: data.windowChange < 0 ? colors.success : data.windowChange > 0 ? colors.danger : colors.muted, marginTop: 2 }}>
                    {data.windowChange > 0 ? '+' : ''}{formatWeight(data.windowChange, unit)} this period
                  </FsText>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {isCurrent ? (
                  <>
                    <FsText variant="caption">{goalStat.label}</FsText>
                    <FsText variant="bodyMedium" style={{ marginTop: 2 }}>{goalStat.value}</FsText>
                  </>
                ) : (
                  <FsText variant="caption">Period avg</FsText>
                )}
                {data.windowAvg != null && <FsText variant="caption" style={{ marginTop: 2 }}>avg {formatWeight(data.windowAvg, unit)}</FsText>}
              </View>
            </View>
            {data.pace && (
              <FsText variant="caption" style={{ marginTop: space[3], color: colors.warning }}>{data.pace.title} — {data.pace.message}</FsText>
            )}
            {data.bf != null && (
              <View style={styles.bodyGrid}>
                <Mini label="Body fat" value={`${data.bf.toFixed(1)}%`} />
                {data.leanKg != null && <Mini label="Lean" value={formatWeight(data.leanKg, unit)} />}
                {data.fatKg != null && <Mini label="Fat" value={formatWeight(data.fatKg, unit)} />}
                {data.bmi != null && <Mini label="BMI" value={data.bmi.toFixed(1)} />}
                {data.ffmi != null && <Mini label="FFMI" value={data.ffmi.toFixed(1)} />}
              </View>
            )}
          </Card>

          {/* Training */}
          <Card style={styles.card}>
            <SectionHeader title="Training" />
            {profile.weeklySessionTarget != null && (
              <FsText variant="caption" style={{ marginBottom: space[2] }}>
                Weekly target: {profile.weeklySessionTarget} session{profile.weeklySessionTarget === 1 ? '' : 's'}.
              </FsText>
            )}
            <FsText variant="caption" style={{ marginBottom: space[3] }}>Volume · 8 weeks to {range.fmt(endIso)}</FsText>
            <VolumeBars values={data.weeklyVolume} />
            {Object.keys(data.muscleCounts).length > 0 && (
              <View style={{ marginTop: space[4] }}>
                <FsText variant="caption" style={{ marginBottom: space[2] }}>Muscle balance · {range.rangeLabel}</FsText>
                <MuscleMap counts={data.muscleCounts} target={Math.round(12 * days / 7)} />
              </View>
            )}
            {data.recentPRs.length > 0 && (
              <View style={{ marginTop: space[3] }}>
                <FsText variant="caption" style={{ marginBottom: space[2] }}>Recent PRs</FsText>
                {data.recentPRs.map((p, i) => (
                  <View key={i} style={[styles.prRow, i > 0 && styles.divider]}>
                    <FsText variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{p.name}</FsText>
                    <FsText variant="caption" style={{ marginRight: space[2] }}>{p.detail}</FsText>
                    <Badge label="PR" tone="warning" />
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Consistency grid — each day greys→greens as you log weight + food + a workout */}
          <Card style={styles.card}>
            <SectionHeader title="Consistency" />
            <FsText variant="caption" style={{ marginBottom: space[3] }}>
              Each box is a day — greener means more logged that day (weight, food, workout).
            </FsText>
            <View style={styles.activityGrid}>
              {data.activityScores.map((d) => (
                <View key={d.date} style={[styles.activityCell, activityStyle(d.score)]} />
              ))}
            </View>
            <View style={styles.activityLegend}>
              <FsText variant="caption" style={{ fontSize: 10 }}>Less</FsText>
              {[0, 1, 2, 3].map((s) => (
                <View key={s} style={[styles.activityLegendCell, activityStyle(s)]} />
              ))}
              <FsText variant="caption" style={{ fontSize: 10 }}>More</FsText>
            </View>
          </Card>

          {/* Drill-downs */}
          <Card style={styles.detailCard}>
            <DetailLink icon={Flame} label="Food stats" onPress={() => setSection('food', 'trends')} />
            <DetailLink icon={Dumbbell} label="Workout stats" onPress={() => setSection('workout', 'stats')} />
            <DetailLink icon={Scale} label="Weight &amp; body" onPress={() => setSection('health', 'weight')} />
          </Card>
        </>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, suffix, format }: {
  icon: typeof Flame; label: string; value: number; suffix?: string; format?: (v: number) => string;
}) {
  return (
    <Card style={styles.statCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon color={colors.primary} size={14} />
        <FsText variant="overline">{label}</FsText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
        <AnimatedNumber value={value} variant="stat" format={format} animateOnMount />
        {suffix ? <FsText variant="caption">{suffix}</FsText> : null}
      </View>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <FsText variant="overline">{label}</FsText>
      <FsText variant="bodyMedium" style={{ marginTop: 2 }}>{value}</FsText>
    </View>
  );
}

function VolumeBars({ values }: { values: number[] }) {
  const maxV = Math.max(...values, 1);
  return (
    <View style={styles.bars}>
      {values.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <GrowBar
            index={i}
            height={Math.max((v / maxV) * 56, v > 0 ? 4 : 2)}
            style={{ width: '100%', maxWidth: 20, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.primary, opacity: v === 0 ? 0.25 : i === values.length - 1 ? 1 : 0.55 }}
          />
        </View>
      ))}
    </View>
  );
}

function DetailLink({ icon: Icon, label, onPress }: { icon: typeof Flame; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.detailRow}>
      <Icon color={colors.primary} size={18} />
      <FsText variant="bodyMedium" style={{ flex: 1 }}>{label}</FsText>
      <ChevronRight color={colors.muted} size={18} />
    </PressableScale>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { marginBottom: space[3] },
  detailCard: { marginBottom: space[3], paddingVertical: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  statCard: { width: '48%', flexGrow: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bodyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] },
  mini: { width: '31%', flexGrow: 1, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: space[3] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: space[1] },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  prRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space[2] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  activityCell: { width: 12, height: 12, borderRadius: 3 },
  activityLegend: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: space[3], justifyContent: 'flex-end' },
  activityLegendCell: { width: 11, height: 11, borderRadius: 3 },
}));
