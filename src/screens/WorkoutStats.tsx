import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Dumbbell, Timer, Flame, Trophy, BarChart2, ChevronRight } from 'lucide-react-native';

import { Card, FsText, Badge } from '@/components/ui';
import { MuscleMap } from '@/components/MuscleMap';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight, formatVolume, toDisplay, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { WorkoutSession } from '@/types';

const DAY_MS = 86_400_000;
const CHART_H = 80;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

interface PR {
  name: string;
  detail: string;
  date: string;
}

export function WorkoutStats() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const refresh = useCallback(() => setSessions(workoutRepo.getSessions(120)), []);
  useFocusEffect(refresh);

  if (sessions.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><Dumbbell color={colors.muted} size={28} /></View>
        <FsText variant="cardTitle" style={{ color: colors.muted }}>No stats yet</FsText>
        <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
          Finish a few workouts and your volume trends and PRs will appear here.
        </FsText>
      </View>
    );
  }

  const now = new Date();
  const workoutsThisMonth = sessions.filter((s) => {
    const d = new Date(s.startedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const durations = sessions
    .filter((s) => s.finishedAt)
    .map((s) => (new Date(s.finishedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000)
    .filter((m) => m > 0);
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // Streak: consecutive calendar days (ending today/yesterday) with a session.
  const dayset = new Set(sessions.map((s) => isoDay(new Date(s.startedAt))));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = isoDay(new Date(now.getTime() - i * DAY_MS));
    if (dayset.has(d)) streak++;
    else if (i === 0) continue; // allow today to be empty
    else break;
  }

  // Weekly volume, last 8 weeks (week 0 = current). Bucket on the session's
  // start-of-day so TODAY's workouts land in week 0 (a timestamp vs midnight
  // comparison otherwise made them negative and dropped them).
  const weeks = new Array(8).fill(0);
  const todayMid = new Date(now); todayMid.setHours(0, 0, 0, 0);
  for (const s of sessions) {
    const sDay = new Date(s.startedAt); sDay.setHours(0, 0, 0, 0);
    const days = Math.round((todayMid.getTime() - sDay.getTime()) / DAY_MS);
    const wk = Math.floor(days / 7);
    if (wk >= 0 && wk < 8) weeks[wk] += s.totalVolume ?? 0;
  }
  const weekly = weeks.slice().reverse(); // oldest → newest
  const bestWeek = Math.max(...weekly, 0);
  const maxV = Math.max(bestWeek, 1);

  const prs: PR[] = [];
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const st of e.sets) {
        if (st.isPersonalBest) {
          prs.push({
            name: e.exercise.name,
            detail: `${formatWeight(st.weightKg, unit)} × ${st.reps}`,
            date: new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          });
        }
      }
    }
    if (prs.length >= 6) break;
  }

  // Weekly sets per muscle group (for the body heatmap).
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const muscleCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (new Date(s.startedAt).getTime() < weekAgo) continue;
    for (const e of s.exercises) {
      const key = (e.exercise.muscleGroup ?? '').toLowerCase();
      if (key) muscleCounts[key] = (muscleCounts[key] ?? 0) + e.sets.length;
    }
  }

  const fmtVol = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

  return (
    <>
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
        <StatCard icon={Dumbbell} label="Workouts / mo" value={String(workoutsThisMonth)} />
        <StatCard icon={Timer} label="Avg duration" value={avgDuration != null ? `${avgDuration} min` : '—'} />
        <StatCard icon={Flame} label="Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
        <StatCard icon={Trophy} label="Best week" value={formatVolume(bestWeek, unit)} />
      </View>

      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="cardTitle" style={{ marginBottom: space[2] }}>Muscle activity · last 7 days</FsText>
        <MuscleMap counts={muscleCounts} target={12} />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Weekly Volume · {UNIT_LABELS[unit].weight}</FsText>
        <View style={styles.bars}>
          {weekly.map((v, i) => (
            <View key={i} style={styles.barCol}>
              <View
                style={{
                  width: '100%',
                  maxWidth: 22,
                  height: Math.max((v / maxV) * CHART_H, v > 0 ? 4 : 2),
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  backgroundColor: i === weekly.length - 1 ? colors.primary : colors.primary,
                  opacity: v === 0 ? 0.25 : i === weekly.length - 1 ? 1 : 0.55,
                }}
              />
            </View>
          ))}
        </View>
        <View style={styles.barLabels}>
          {weekly.map((v, i) => (
            <FsText key={i} variant="caption" style={{ flex: 1, textAlign: 'center', fontSize: 9 }}>
              {v > 0 ? fmtVol(toDisplay(v, unit)) : '—'}
            </FsText>
          ))}
        </View>
      </Card>

      <Card>
        <FsText variant="cardTitle" style={{ marginBottom: space[2] }}>Recent PRs</FsText>
        {prs.length === 0 ? (
          <FsText variant="caption">No personal bests logged yet.</FsText>
        ) : (
          prs.map((p, i) => (
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

function StatCard({ icon: Icon, label, value }: { icon: typeof Dumbbell; label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon color={colors.primary} size={14} />
        <FsText variant="overline">{label}</FsText>
      </View>
      <FsText variant="stat" style={{ marginTop: 6 }}>{value}</FsText>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space[2],
  },
  reportsRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  statCard: { width: '48%', flexGrow: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: space[2] },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barLabels: { flexDirection: 'row', marginTop: space[2], gap: space[2] },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space[2] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
