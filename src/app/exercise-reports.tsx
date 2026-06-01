import { useCallback, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { X, Search, ChevronRight, BarChart2 } from 'lucide-react-native';

import { FsText, Card } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { colors, radius, space } from '@/theme/tokens';

export default function ExerciseReports() {
  const router = useRouter();
  const [items, setItems] = useState<ReturnType<typeof workoutRepo.getExercisesWithHistory>>([]);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => setItems(workoutRepo.getExercisesWithHistory()), []);
  useFocusEffect(refresh);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items), [items, q]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">Exercise Reports</FsText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.iconWrap}><BarChart2 color={colors.muted} size={28} /></View>
            <FsText variant="cardTitle" style={{ color: colors.muted }}>No data yet</FsText>
            <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
              Finish a few workouts and each exercise you logged will get a progress report here.
            </FsText>
          </View>
        ) : (
          <>
            <View style={styles.searchRow}>
              <Search color={colors.muted} size={16} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises…"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 }}
              />
            </View>
            {filtered.map((e) => (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/exercise-progress', params: { id: e.id } })}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <FsText variant="bodyMedium" numberOfLines={1}>{e.name}</FsText>
                    <FsText variant="caption">
                      {e.sessions} session{e.sessions !== 1 ? 's' : ''}
                      {e.muscleGroup ? ` · ${e.muscleGroup}` : ''}
                    </FsText>
                  </View>
                  <ChevronRight color={colors.muted} size={20} />
                </Card>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, marginBottom: space[3],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  empty: { alignItems: 'center', gap: space[2], paddingVertical: space[8] },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space[2],
  },
});
