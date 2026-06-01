import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { UserCircle, Dumbbell, Ruler, AlertTriangle, Flame } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { CalorieMacroCard } from '@/components/CalorieMacroCard';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { resolveTargets } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { useSessionStore } from '@/stores/sessionStore';
import { formatWeight } from '@/lib/units';
import { colors, space, radius } from '@/theme/tokens';
import type { HealthStats, WorkoutSession } from '@/types';

const DAY_MS = 86_400_000;
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtAge(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

interface WeekBar {
  label: string;
  calories: number;
}

export function DashboardOverview() {
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const setSection = useNavStore((s) => s.setSection);
  const session = useSessionStore();
  const router = useRouter();

  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [week, setWeek] = useState<WeekBar[]>([]);
  const [streak, setStreak] = useState(0);
  const [recent, setRecent] = useState<WorkoutSession[]>([]);

  const refresh = useCallback(() => {
    const today = new Date();
    const todayIso = isoDate(today);
    setTotals(foodRepo.getDayTotals(todayIso));
    setStats(healthRepo.computeStats(profile.goalWeightKg, profile.goalDate));
    setRecent(workoutRepo.getSessions(3));

    // Last 7 days of calories (oldest → today), filling gaps with 0.
    const from = isoDate(new Date(today.getTime() - 6 * DAY_MS));
    const byDate = new Map(foodRepo.getDailyCalories(from, todayIso).map((r) => [r.date, r.calories]));
    const bars: WeekBar[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS);
      bars.push({ label: WEEKDAY[d.getDay()], calories: byDate.get(isoDate(d)) ?? 0 });
    }
    setWeek(bars);

    // Streak: consecutive days up to today with any calories logged.
    let s = 0;
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].calories > 0) s++;
      else break;
    }
    setStreak(s);
  }, [profile.goalWeightKg, profile.goalDate]);

  useFocusEffect(refresh);

  // One-time nudge to switch to maintain once the 7-day average reaches the goal.
  // Gated on the trend avg (not a single weigh-in), no active phase, and a per-goal
  // flag so it never nags or re-fires unless a new goal weight is set.
  useEffect(() => {
    const gw = profile.goalWeightKg;
    const avg = stats?.avg7;
    if (gw == null || avg == null) return;
    if (profile.goalType !== 'LOSE' && profile.goalType !== 'GAIN') return;
    if (profile.maintainPromptedFor === gw) return;
    if (healthRepo.getActiveGoalPhase()) return;
    const reached = profile.goalType === 'LOSE' ? avg <= gw : avg >= gw;
    if (!reached) return;
    Alert.alert(
      'Goal weight reached 🎉',
      `Your 7-day average (${formatWeight(avg, profile.unitSystem)}) is at your goal. Switch to maintain to hold it here?`,
      [
        { text: 'Keep going', onPress: () => setProfile({ maintainPromptedFor: gw }) },
        { text: 'Switch to maintain', onPress: () => setProfile({ goalType: 'MAINTAIN', maintainPromptedFor: gw }) },
      ]
    );
  }, [stats]);

  const targets = resolveTargets(profile);
  const goal = targets.calorieTarget ?? 0;
  const maxV = Math.max(goal, ...week.map((b) => b.calories), 1) * 1.1;

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const weeklyChange = stats?.weeklyChange ?? null;
  const behind = stats?.dailyCalorieDelta != null && !stats.onTrack;

  return (
    <>
      {/* Greeting */}
      <View style={styles.greetRow}>
        <View style={styles.greetLeft}>
          <UserCircle color={colors.muted} size={44} strokeWidth={1.25} />
          <View>
            <FsText variant="h1">{greeting()}</FsText>
            {!!profile.name && (
              <FsText variant="caption" style={{ marginTop: 2 }}>{profile.name}</FsText>
            )}
          </View>
        </View>
        <FsText variant="caption">{dateLabel}</FsText>
      </View>

      {/* Calorie + macros */}
      <Pressable onPress={() => setSection('food', 'today')}>
        <Card style={{ marginBottom: space[3] }}>
          <CalorieMacroCard
            calories={totals.calories}
            protein={totals.protein}
            carbs={totals.carbs}
            fat={totals.fat}
            targets={targets}
          />
          <FsText variant="caption" style={styles.tapHint}>Tap to log food →</FsText>
        </Card>
      </Pressable>

      {targets.warning && (
        <Card outlined style={{ marginBottom: space[3] }}>
          <FsText variant="caption" style={{ color: colors.warning }}>{targets.warning}</FsText>
        </Card>
      )}

      {/* This week */}
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.cardHead}>
          <FsText variant="cardTitle">This Week</FsText>
          {streak > 0 && (
            <View style={styles.streak}>
              <Flame color={colors.warning} size={13} />
              <FsText variant="caption" style={{ color: colors.warning, fontWeight: '600' }}>
                {streak} day streak
              </FsText>
            </View>
          )}
        </View>
        <View style={styles.chart}>
          {week.map((b, i) => {
            // Logged days get a clear minimum height so a small day still reads as "logged"
            // and stands apart from the faint empty-day baseline.
            const h = b.calories > 0 ? Math.max((b.calories / maxV) * 64, 12) : 4;
            const hit = goal > 0 && b.calories >= goal * 0.8;
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={{
                      height: h,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                      backgroundColor: b.calories > 0 ? colors.primary : colors.surfaceHigh,
                      opacity: b.calories === 0 ? 1 : hit ? 1 : 0.75,
                    }}
                  />
                </View>
                <FsText variant="caption" style={{ fontSize: 10 }}>{b.label}</FsText>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Weight */}
      <Pressable onPress={() => setSection('health', 'weight')}>
        <Card style={{ marginBottom: space[3] }}>
          <View style={styles.cardHead}>
            <View>
              <FsText variant="caption">Current Weight</FsText>
              <FsText variant="stat">
                {stats?.current ? formatWeight(stats.current.weightKg, profile.unitSystem) : '—'}
              </FsText>
              {weeklyChange != null && (
                <FsText
                  variant="caption"
                  style={{ color: weeklyChange < 0 ? colors.success : weeklyChange > 0 ? colors.danger : colors.muted, marginTop: 2 }}
                >
                  {weeklyChange > 0 ? '+' : ''}
                  {formatWeight(Math.abs(weeklyChange), profile.unitSystem)} this week
                </FsText>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <FsText variant="caption">Goal ETA</FsText>
              <FsText variant="bodyMedium" style={{ marginTop: 2 }}>{stats?.goalEta ?? '—'}</FsText>
            </View>
          </View>
        </Card>
      </Pressable>

      {/* Pace alert */}
      {behind && (
        <Pressable onPress={() => setSection('health', 'weight')}>
          <Card outlined style={{ marginBottom: space[3], padding: 0, overflow: 'hidden' }}>
            <View style={styles.alertHead}>
              <AlertTriangle color={colors.warning} size={16} />
              <FsText variant="bodyMedium" style={{ color: colors.warning }}>
                {stats!.dailyCalorieDelta! > 0 ? 'Slightly Behind' : 'Ahead of Pace'}
              </FsText>
              <FsText variant="caption" style={{ marginLeft: 'auto' }}>Pace →</FsText>
            </View>
            <View style={{ padding: space[4], paddingTop: space[3] }}>
              <FsText variant="caption">
                {stats!.dailyCalorieDelta! > 0
                  ? `Cut ~${Math.abs(stats!.dailyCalorieDelta!)} cal/day to stay on track`
                  : `You could eat ~${Math.abs(stats!.dailyCalorieDelta!)} more cal/day`}
              </FsText>
            </View>
          </Card>
        </Pressable>
      )}

      {/* Recent workouts */}
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.cardHead}>
          <FsText variant="cardTitle">Recent Workouts</FsText>
          <Pressable onPress={() => setSection('workout', 'history')} hitSlop={8}>
            <FsText variant="caption" style={{ color: colors.primary }}>See all →</FsText>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <FsText variant="caption">No workouts logged yet.</FsText>
        ) : (
          recent.map((w, i) => (
            <View key={w.id} style={[styles.recentRow, i > 0 && styles.recentDivider]}>
              <View>
                <FsText variant="bodyMedium">{w.name}</FsText>
                <FsText variant="caption">{fmtAge(w.startedAt)}</FsText>
              </View>
              <Dumbbell color={colors.muted} size={16} />
            </View>
          ))
        )}
      </Card>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            session.startEmpty();
            router.push('/session');
          }}
        >
          <Card style={styles.quick}>
            <Dumbbell color={colors.primary} size={28} />
            <FsText variant="bodyMedium">Log Workout</FsText>
          </Card>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/measurements')}>
          <Card style={styles.quick}>
            <Ruler color={colors.primary} size={28} />
            <FsText variant="bodyMedium">Measurements</FsText>
          </Card>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[4],
  },
  greetLeft: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: space[6] },
  tapHint: { textAlign: 'center', marginTop: space[3] },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: space[2],
  },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', maxWidth: 28, height: 64, justifyContent: 'flex-end' },
  alertHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  recentDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  quick: { alignItems: 'flex-start', gap: space[2] },
});
