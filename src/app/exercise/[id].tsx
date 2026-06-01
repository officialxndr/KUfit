import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Dumbbell } from 'lucide-react-native';

import { Screen, FsText, Badge, Card, SectionHeader } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { resolveMediaSource, cacheGif, type MediaSource } from '@/lib/exerciseMedia';
import { colors, radius, space } from '@/theme/tokens';
import type { Exercise } from '@/types';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [source, setSource] = useState<MediaSource>(null);

  useEffect(() => {
    if (!id) return;
    const ex = workoutRepo.getExerciseById(id);
    setExercise(ex);
    if (ex) {
      setSource(resolveMediaSource(ex));
      // Best-effort: cache the remote GIF for offline next time.
      cacheGif(ex).then((uri) => {
        if (uri) setSource({ uri });
      });
    }
  }, [id]);

  if (!exercise) {
    return (
      <Screen>
        <FsText variant="body">Exercise not found.</FsText>
      </Screen>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
        <ChevronLeft color={colors.text} size={26} />
      </Pressable>

      <Screen contentStyle={{ paddingTop: space[2] }}>
        {/* Media */}
        <View style={styles.media}>
          {source ? (
            <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
          ) : (
            <Dumbbell color={colors.muted} size={56} strokeWidth={1.5} />
          )}
        </View>

        <FsText variant="h1" style={{ marginTop: space[4] }}>{exercise.name}</FsText>

        <View style={styles.badgeRow}>
          {exercise.muscleGroup ? <Badge label={exercise.muscleGroup} tone="primary" /> : null}
          {exercise.equipment ? <Badge label={exercise.equipment} tone="success" /> : null}
          {exercise.category ? <Badge label={exercise.category} tone="warning" /> : null}
        </View>

        {exercise.description ? (
          <FsText variant="body" style={{ marginTop: space[3], color: colors.muted }}>
            {exercise.description}
          </FsText>
        ) : null}

        {exercise.instructions.length > 0 && (
          <Card style={{ marginTop: space[4] }}>
            <SectionHeader title="Instructions" />
            {exercise.instructions.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <FsText variant="caption" style={{ color: colors.white }}>{i + 1}</FsText>
                </View>
                <FsText variant="body" style={{ flex: 1 }}>{step}</FsText>
              </View>
            ))}
          </Card>
        )}

        {exercise.tips.length > 0 && (
          <Card style={{ marginTop: space[3] }}>
            <SectionHeader title="Coaching Tips" />
            {exercise.tips.map((tip, i) => (
              <FsText key={i} variant="body" style={{ marginBottom: 6 }}>• {tip}</FsText>
            ))}
          </Card>
        )}

        {(exercise.musclesPrimary.length > 0 || exercise.musclesSecondary.length > 0) && (
          <Card style={{ marginTop: space[3] }}>
            <SectionHeader title="Muscles Worked" />
            {exercise.musclesPrimary.length > 0 && (
              <FsText variant="body">
                <FsText variant="bodyMedium">Primary: </FsText>
                {exercise.musclesPrimary.join(', ')}
              </FsText>
            )}
            {exercise.musclesSecondary.length > 0 && (
              <FsText variant="body" style={{ marginTop: 4 }}>
                <FsText variant="bodyMedium">Secondary: </FsText>
                {exercise.musclesSecondary.join(', ')}
              </FsText>
            )}
          </Card>
        )}
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  media: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeRow: { flexDirection: 'row', gap: space[2], marginTop: space[3], flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', gap: space[3], marginBottom: space[3], alignItems: 'flex-start' },
  stepNum: {
    width: 22, height: 22, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
});
