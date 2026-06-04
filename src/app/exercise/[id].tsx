import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Dumbbell, Trash2 } from 'lucide-react-native';

import { Screen, FsText, Badge, Card, SectionHeader } from '@/components/ui';
import { PerArmDropdown } from '@/components/PerArmDropdown';
import { LoadDropdown } from '@/components/LoadDropdown';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { resolveMediaSource, cacheGif, type MediaSource } from '@/lib/exerciseMedia';
import { isPerSide } from '@/lib/load';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
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

  const perSideOn = isPerSide(exercise);
  const applyPerSide = (val: boolean) => {
    workoutRepo.setExercisePerSide(exercise.id, val);
    setExercise({ ...exercise, perSide: val });
  };
  const applyUnilateral = (val: boolean) => {
    workoutRepo.setExerciseUnilateral(exercise.id, val);
    setExercise({ ...exercise, unilateral: val });
  };
  const applyLeadSide = (val: 'L' | 'R') => {
    workoutRepo.setExerciseLeadSide(exercise.id, val);
    setExercise({ ...exercise, leadSide: val });
  };
  const onDelete = () => {
    const u = workoutRepo.getExerciseUsage(exercise.id);
    const refs = [
      u.templates ? `${u.templates} template${u.templates === 1 ? '' : 's'}` : null,
      u.sessions ? `${u.sessions} logged workout${u.sessions === 1 ? '' : 's'}` : null,
    ].filter(Boolean);
    const warn = refs.length ? ` It's used in ${refs.join(' and ')}, which will lose it.` : '';
    Alert.alert('Delete exercise?', `“${exercise.name}” will be permanently removed.${warn}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { workoutRepo.deleteCustomExercise(exercise.id); router.back(); } },
    ]);
  };

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

        <Card style={{ marginTop: space[4] }}>
          <SectionHeader title="Logging defaults" />
          <FsText variant="caption" style={{ marginBottom: space[3], color: colors.muted }}>
            Saved on this exercise — used the same way (the same selectors as in a workout) every time you add it.
          </FsText>
          <View style={styles.cfgRow}>
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium">Per-arm sets</FsText>
              <FsText variant="caption" style={{ color: colors.muted }}>Log each arm separately (1 L, 1 R).</FsText>
            </View>
            <PerArmDropdown
              unilateral={exercise.unilateral}
              leadSide={exercise.leadSide}
              onChange={(next) => { applyUnilateral(next.unilateral); if (next.unilateral) applyLeadSide(next.leadSide); }}
            />
          </View>
          <View style={[styles.cfgRow, { marginTop: space[3] }]}>
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium">Load counting</FsText>
              <FsText variant="caption" style={{ color: colors.muted }}>“Per side ×2” for two-arm dumbbell/kettlebell work.</FsText>
            </View>
            <LoadDropdown perSide={perSideOn} onChange={applyPerSide} />
          </View>
        </Card>

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

        {/* Only the user's own exercises can be deleted — app-provided ones have no delete. */}
        {exercise.isCustom && (
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Trash2 color={colors.danger} size={18} />
            <FsText variant="bodyMedium" style={{ color: colors.danger, fontWeight: '600' }}>Delete exercise</FsText>
          </Pressable>
        )}
      </Screen>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
  cfgRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    marginTop: space[4], paddingVertical: 13, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.danger,
  },
  stepRow: { flexDirection: 'row', gap: space[3], marginBottom: space[3], alignItems: 'flex-start' },
  stepNum: {
    width: 22, height: 22, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
}));
