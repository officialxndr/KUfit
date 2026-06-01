import { View, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { Timer, Dumbbell, Layers, Flame, Trophy, X } from 'lucide-react-native';

import { FsText, Card, Badge } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { formatWeight, formatVolume } from '@/lib/units';
import { colors, space, themedStyles } from '@/theme/tokens';
import type { UnitSystem, WorkoutSession } from '@/types';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Past-workout detail as a **bottom-sheet popup** (not the full-screen post-finish
 * celebration). Same stats — duration, volume, sets, PRs — plus a per-exercise
 * breakdown. Used from Workout → History.
 */
export function WorkoutSummarySheet({ session, unit, onClose }: {
  session: WorkoutSession | null;
  unit: UnitSystem;
  onClose: () => void;
}) {
  const sets = session?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const prs = session?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPersonalBest).length, 0) ?? 0;
  const durationMin = session?.finishedAt
    ? Math.max(1, Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
    : null;

  return (
    <BottomSheet visible={!!session} onClose={onClose}>
      {session && (
            <>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <FsText variant="h2" numberOfLines={1}>{session.name}</FsText>
                  <FsText variant="caption">
                    {new Date(session.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </FsText>
                </View>
                <Pressable onPress={onClose} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
              </View>

              <View style={styles.grid}>
                <Stat icon={Timer} label="Duration" value={durationMin != null ? `${durationMin} min` : '—'} />
                <Stat icon={Dumbbell} label="Volume" value={formatVolume(session.totalVolume ?? 0, unit)} />
                <Stat icon={Layers} label="Sets" value={String(sets)} />
                <Stat icon={Flame} label="Exercises" value={String(session.exercises.length)} />
              </View>

              {prs > 0 && (
                <Card style={styles.prCard}>
                  <Trophy color={colors.warning} size={18} />
                  <FsText variant="bodyMedium" style={{ flex: 1 }}>{prs} personal best{prs > 1 ? 's' : ''}</FsText>
                  <Badge label="PR" tone="warning" />
                </Card>
              )}

              <FsText variant="overline" style={{ marginTop: space[4], marginBottom: space[2] }}>Exercises</FsText>
              <ScrollView style={{ maxHeight: SCREEN_H * 0.4 }}>
                {session.exercises.map((e) => (
                  <Card key={e.id} style={{ marginBottom: space[2] }}>
                    <FsText variant="bodyMedium" style={{ marginBottom: space[1] }}>{e.exercise.name}</FsText>
                    {e.sets.map((s, i) => (
                      <View key={s.id} style={styles.setRow}>
                        <FsText variant="caption" style={{ width: 36 }}>Set {i + 1}</FsText>
                        <FsText variant="caption" style={{ flex: 1 }}>
                          {formatWeight(s.weightKg, unit)} × {s.reps}
                        </FsText>
                        {s.isPersonalBest && <Badge label="PR" tone="warning" />}
                      </View>
                    ))}
                  </Card>
                ))}
              </ScrollView>
            </>
          )}
    </BottomSheet>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Icon color={colors.primary} size={18} />
      <FsText variant="stat" style={{ marginTop: space[1] }}>{value}</FsText>
      <FsText variant="caption">{label}</FsText>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  statCard: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 2 },
  prCard: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3] },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: 2 },
}));
