import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search, ChevronRight, X } from 'lucide-react-native';

import { FsText, Chip } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTemplateDraftStore } from '@/stores/templateDraftStore';
import { colors, radius, space } from '@/theme/tokens';
import type { Exercise } from '@/types';

export default function ExercisesScreen() {
  const router = useRouter();
  // When `pick=1`, tapping an exercise returns its id to the caller via params.
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | undefined>(undefined);

  const muscles = useMemo(() => workoutRepo.getDistinctMuscleGroups(), []);
  const results: Exercise[] = useMemo(
    () => workoutRepo.searchExercises(q, muscle),
    [q, muscle]
  );

  const onSelect = (ex: Exercise) => {
    if (pick === 'session') {
      useSessionStore.getState().addExercise(ex);
      router.back();
      return;
    }
    if (pick === 'template') {
      useTemplateDraftStore.getState().addExercise(ex);
      router.back();
      return;
    }
    router.push(`/exercise/${ex.id}`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Exercise Library</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
      </View>

      <View style={styles.searchField}>
        <Search color={colors.muted} size={18} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search exercises…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip label="All" selected={!muscle} onPress={() => setMuscle(undefined)} />
        {muscles.map((m) => (
          <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(m)} />
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<FsText variant="caption" style={{ marginTop: space[4] }}>No exercises found.</FsText>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item)}>
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{item.name}</FsText>
              <FsText variant="caption">
                {[item.muscleGroup, item.equipment].filter(Boolean).join(' · ') || '—'}
              </FsText>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, marginHorizontal: space[4],
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3], alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
});
