import { useEffect, useState } from 'react';
import { View, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { X, Dumbbell } from 'lucide-react-native';

import { FsText, Badge } from '@/components/ui';
import { resolveMediaSource, cacheGif, type MediaSource } from '@/lib/exerciseMedia';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { Exercise } from '@/types';

/**
 * Lightweight "peek" at an exercise — opened by long-pressing a row in the picker
 * so you can check the demo + muscles/instructions without leaving your selection.
 * Resolves the demo GIF the same way the detail screen does (cached for offline).
 */
export function ExerciseInfoSheet({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const [source, setSource] = useState<MediaSource>(null);

  useEffect(() => {
    if (!exercise) { setSource(null); return; }
    setSource(resolveMediaSource(exercise));
    let active = true;
    cacheGif(exercise).then((uri) => { if (active && uri) setSource({ uri }); });
    return () => { active = false; };
  }, [exercise]);

  return (
    <Modal visible={!!exercise} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {exercise && (
            <>
              <View style={styles.media}>
                {source ? (
                  <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
                ) : (
                  <Dumbbell color={colors.muted} size={44} strokeWidth={1.5} />
                )}
              </View>

              <View style={styles.titleRow}>
                <FsText variant="h2" style={{ flex: 1 }} numberOfLines={2}>{exercise.name}</FsText>
                <Pressable onPress={onClose} hitSlop={10}><X color={colors.muted} size={22} /></Pressable>
              </View>

              <View style={styles.badgeRow}>
                {exercise.muscleGroup ? <Badge label={exercise.muscleGroup} tone="primary" /> : null}
                {exercise.equipment ? <Badge label={exercise.equipment} tone="success" /> : null}
                {exercise.category ? <Badge label={exercise.category} tone="warning" /> : null}
              </View>

              <ScrollView style={{ maxHeight: 240, marginTop: space[3] }} showsVerticalScrollIndicator={false}>
                {(exercise.musclesPrimary.length > 0 || exercise.musclesSecondary.length > 0) && (
                  <View style={{ marginBottom: space[3] }}>
                    {exercise.musclesPrimary.length > 0 && (
                      <FsText variant="body"><FsText variant="bodyMedium">Primary: </FsText>{exercise.musclesPrimary.join(', ')}</FsText>
                    )}
                    {exercise.musclesSecondary.length > 0 && (
                      <FsText variant="body" style={{ marginTop: 2 }}><FsText variant="bodyMedium">Secondary: </FsText>{exercise.musclesSecondary.join(', ')}</FsText>
                    )}
                  </View>
                )}

                {exercise.instructions.length > 0 ? (
                  <View>
                    <FsText variant="overline" style={{ marginBottom: space[2] }}>Instructions</FsText>
                    {exercise.instructions.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <View style={styles.stepNum}><FsText variant="caption" style={{ color: colors.white }}>{i + 1}</FsText></View>
                        <FsText variant="body" style={{ flex: 1 }}>{step}</FsText>
                      </View>
                    ))}
                  </View>
                ) : (exercise.musclesPrimary.length === 0 && exercise.musclesSecondary.length === 0) ? (
                  <FsText variant="caption" style={{ color: colors.muted }}>No extra details for this exercise.</FsText>
                ) : null}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space[6] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  media: {
    width: '100%', height: 180, backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2], marginTop: space[3] },
  badgeRow: { flexDirection: 'row', gap: space[2], marginTop: space[2], flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', gap: space[3], marginBottom: space[3], alignItems: 'flex-start' },
  stepNum: {
    width: 22, height: 22, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
}));
