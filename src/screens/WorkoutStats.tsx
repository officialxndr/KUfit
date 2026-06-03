import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Dumbbell, Timer, Trophy, BarChart2, ChevronRight, Activity } from 'lucide-react-native';

import { Card, FsText, Badge } from '@/components/ui';
import { MuscleMap } from '@/components/MuscleMap';
import { DateRangeBar } from '@/components/DateRangeBar';
import { GrowBar } from '@/components/anim/GrowBar';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useDateRange } from '@/lib/useDateRange';
import { usePullRefresh } from '@/stores/refreshStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight, formatVolume } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const DAY_MS = 86_400_000;
const CHART_H = 60;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);

interface PR { name: string; detail: string; date: string }
interface StatsData {
  hasAny: boolean;
  workouts: number;
  totalVolume: number;
  avgDuration: number | null;
  prCount: number;
  prs: PR[];
  muscleCounts: Record<string, number>;
  volBars: number[];
}

/** Workout → Stats: training stats for the selected date window. */
export function WorkoutStats() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const range = useDateRange('month');
  const { fromIso, endIso, days } = range;
  const [data, setData] = useState<StatsData | null>(null);

  const refresh = useCallback(() => {
    const fromMs = parse(fromIso).getTime();
    const endMs = parse(endIso).getTime();
    const all = workoutRepo.getSessions(500);
    const inWindow = all.filter((s) => { const t = new Date(s.startedAt).getTime(); return t >= fromMs && t < endMs + DAY_MS; });

    const workouts = inWindow.length;
    const totalVolume = inWindow.reduce((a, s) => a + (s.totalVolume ?? 0), 0);
    const durations = inWindow.filter((s) => s.finishedAt)
      .map((s) => (new Date(s.finishedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000)
      .filter((m) => m > 0);
    const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    let prCount = 0;
    const prs: PR[] = [];
    const muscleCounts: Record<string, number> = {};
    for (const s of inWindow) {
      for (const e of s.exercises) {
        const k = (e.exercise.muscleGroup ?? '').toLowerCase();
        if (k) muscleCounts[k] = (muscleCounts[k] ?? 0) + e.sets.length;
        for (const st of e.sets) {
          if (st.isPersonalBest) {
            prCount++;
            if (prs.length < 6) prs.push({
              name: e.exercise.name,
              detail: `${formatWeight(st.weightKg, unit)} × ${st.reps}`,
              date: new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            });
          }
        }
      }
    }

    // Volume bucketed across the window (sum per bucket), bounded for long ranges.
    const nB = Math.min(Math.max(days, 1), 30);
    const volBars = new Array(nB).fill(0);
    for (const s of inWindow) {
      const di = Math.floor((new Date(s.startedAt).getTime() - fromMs) / DAY_MS);
      const b = Math.min(nB - 1, Math.max(0, Math.floor((di / days) * nB)));
      volBars[b] += s.totalVolume ?? 0;
    }

    setData({ hasAny: all.length > 0, workouts, totalVolume, avgDuration, prCount, prs, muscleCounts, volBars });
  }, [fromIso, endIso, days, unit]);

  useFocusEffect(refresh);
  usePullRefresh(refresh);

  if (!data) return null;
  if (!data.hasAny) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><BarChart2 color={colors.muted} size={28} /></View>
        <FsText variant="cardTitle" style={{ color: colors.muted }}>No stats yet</FsText>
        <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
          Finish a few workouts and your training stats will appear here.
        </FsText>
      </View>
    );
  }

  const maxVol = Math.max(...data.volBars, 1);

  return (
    <>
      <DateRangeBar range={range} />

      <Pressable onPress={() => router.push('/exercise-reports')}>
        <Card style={styles.reportsRow}>
          <BarChart2 color={colors.primary} size={22} />
          <View style={{ flex: 1 }}>
            <FsText variant="cardTitle">Exercise Reports</FsText>
            <FsText variant="caption">Per-exercise progress charts &amp; compare</FsText>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Card>
      </Pressable>

      <View style={styles.grid}>
        <StatCard icon={Dumbbell} label="Workouts" value={data.workouts} />
        <StatCard icon={Timer} label="Avg duration" value={data.avgDuration ?? 0} suffix=" min" />
        <StatCard icon={Activity} label="Volume" value={data.totalVolume} format={(v) => formatVolume(v, unit)} />
        <StatCard icon={Trophy} label="New PRs" value={data.prCount} />
      </View>

      {Object.keys(data.muscleCounts).length > 0 && (
        <Card style={{ marginBottom: space[3] }}>
          <FsText variant="cardTitle" style={{ marginBottom: space[2] }}>Muscle activity · {range.rangeLabel}</FsText>
          <MuscleMap counts={data.muscleCounts} target={Math.round(12 * days / 7)} />
        </Card>
      )}

      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Training Volume</FsText>
        <View style={styles.bars}>
          {data.volBars.map((v, i) => (
            <View key={i} style={styles.barCol}>
              <GrowBar
                index={i}
                height={Math.max((v / maxVol) * CHART_H, v > 0 ? 4 : 2)}
                style={{ width: '100%', maxWidth: data.volBars.length <= 8 ? 22 : undefined, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.primary, opacity: v === 0 ? 0.25 : i === data.volBars.length - 1 ? 1 : 0.6 }}
              />
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <FsText variant="cardTitle" style={{ marginBottom: space[2] }}>Recent PRs</FsText>
        {data.prs.length === 0 ? (
          <FsText variant="caption">No personal bests in this range.</FsText>
        ) : (
          data.prs.map((p, i) => (
            <View key={i} style={[styles.prRow, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">{p.name}</FsText>
                <FsText variant="caption">{p.date}</FsText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <FsText variant="bodyMedium">{p.detail}</FsText>
                <Badge label="PR" tone="warning" />
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function StatCard({ icon: Icon, label, value, suffix, format }: {
  icon: typeof Dumbbell; label: string; value: number; suffix?: string; format?: (v: number) => string;
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

const styles = themedStyles(() => StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: space[2] },
  reportsRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  statCard: { width: '48%', flexGrow: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
