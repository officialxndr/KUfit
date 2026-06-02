import { View, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { X } from 'lucide-react-native';

import { FsText, Card, Badge } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { WorkoutSummaryBody } from '@/components/WorkoutSummaryBody';
import { formatWeight } from '@/lib/units';
import { colors, space, themedStyles } from '@/theme/tokens';
import type { UnitSystem, WorkoutSession } from '@/types';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Past-workout detail as a **bottom-sheet popup** (not the full-screen post-finish
 * celebration). Shares the summary stats via `WorkoutSummaryBody` (so anything
 * added there shows here too), plus a per-exercise breakdown. Used from
 * Workout → History.
 */
export function WorkoutSummarySheet({ session, unit, onClose }: {
  session: WorkoutSession | null;
  unit: UnitSystem;
  onClose: () => void;
}) {
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

              <WorkoutSummaryBody session={session} />

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

const styles = themedStyles(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: space[3] },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: 2 },
}));
