import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, FlatList, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search, ChevronRight, X } from 'lucide-react-native';

import { FsText, Chip, Button } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTemplateDraftStore } from '@/stores/templateDraftStore';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { Exercise } from '@/types';

export default function ExercisesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // `pick=template` / `pick=session` → multi-select mode: check off several exercises
  // (numbered in the order picked), then "Add" them all at once. No pick → browse library.
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const isPicking = pick === 'template' || pick === 'session';
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Exercise[]>([]);

  const muscles = useMemo(() => workoutRepo.getDistinctMuscleGroups(), []);
  const results: Exercise[] = useMemo(() => workoutRepo.searchExercises(q, muscle), [q, muscle]);

  const toggle = (ex: Exercise) => {
    haptic.tap();
    setSelected((prev) => (prev.some((e) => e.id === ex.id) ? prev.filter((e) => e.id !== ex.id) : [...prev, ex]));
  };

  const onRow = (ex: Exercise) => {
    if (isPicking) { toggle(ex); return; }
    router.push(`/exercise/${ex.id}`);
  };

  const confirmAdd = () => {
    if (!selected.length) return;
    const add = pick === 'session'
      ? useSessionStore.getState().addExercise
      : useTemplateDraftStore.getState().addExercise;
    selected.forEach((ex) => add(ex));
    haptic.success();
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">{isPicking ? 'Add exercises' : 'Exercise Library'}</FsText>
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

      {isPicking && (
        <FsText variant="caption" style={styles.hint}>
          Tap to select multiple — they'll be added in the order you pick. Then edit sets &amp; reps.
        </FsText>
      )}

      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        style={{ flex: 1 }}
        extraData={selected}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<FsText variant="caption" style={{ marginTop: space[4] }}>No exercises found.</FsText>}
        renderItem={({ item }) => {
          const idx = isPicking ? selected.findIndex((e) => e.id === item.id) : -1;
          return (
            <Pressable style={styles.row} onPress={() => onRow(item)}>
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium" numberOfLines={1}>{item.name}</FsText>
                <FsText variant="caption">
                  {[item.muscleGroup, item.equipment].filter(Boolean).join(' · ') || '—'}
                </FsText>
              </View>
              {isPicking ? (
                <View style={[styles.checkCircle, idx >= 0 && styles.checkCircleOn]}>
                  {idx >= 0 && <FsText variant="caption" style={{ color: colors.white, fontWeight: '700' }}>{idx + 1}</FsText>}
                </View>
              ) : (
                <ChevronRight color={colors.muted} size={18} />
              )}
            </Pressable>
          );
        }}
      />

      {isPicking && (
        <View style={[styles.footer, { paddingBottom: insets.bottom || space[3] }]}>
          <Button
            title={selected.length ? `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}` : 'Select exercises to add'}
            onPress={confirmAdd}
            disabled={!selected.length}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
  hint: { paddingHorizontal: space[4], marginBottom: space[2], color: colors.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: {
    paddingHorizontal: space[4], paddingTop: space[3],
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
}));
