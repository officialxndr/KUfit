import { useMemo, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, ChevronDown, ChevronRight } from 'lucide-react-native';

import { Card, FsText, Button } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { colors, radius, space } from '@/theme/tokens';
import type { Exercise } from '@/types';

export function WorkoutExercises() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Group the full catalog by muscle once.
  const groups = useMemo(() => {
    const all = workoutRepo.getAllExercises();
    const map = new Map<string, Exercise[]>();
    for (const ex of all) {
      const key = ex.muscleGroup || 'Other';
      const list = map.get(key);
      if (list) list.push(ex);
      else map.set(key, [ex]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? workoutRepo.getAllExercises().filter((e) => e.name.toLowerCase().includes(q)).slice(0, 60)
    : [];

  const open = (ex: Exercise) => router.push(`/exercise/${ex.id}`);

  return (
    <>
      <View style={styles.topRow}>
        <View style={styles.searchRow}>
          <Search color={colors.muted} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>
        <Button title="+ New" onPress={() => router.push('/exercise/new')} style={{ paddingHorizontal: 14 }} />
      </View>

      {q ? (
        <Card style={{ padding: 0 }}>
          {matches.length === 0 ? (
            <View style={{ padding: space[4] }}>
              <FsText variant="caption">No exercises match "{query}".</FsText>
            </View>
          ) : (
            matches.map((ex, i) => (
              <Pressable key={ex.id} style={[styles.exRow, i > 0 && styles.divider]} onPress={() => open(ex)}>
                <View style={{ flex: 1 }}>
                  <FsText variant="bodyMedium" numberOfLines={1}>{ex.name}</FsText>
                  <FsText variant="caption">
                    {[ex.muscleGroup, ex.equipment].filter(Boolean).join(' · ') || '—'}
                  </FsText>
                </View>
                <ChevronRight color={colors.muted} size={16} />
              </Pressable>
            ))
          )}
        </Card>
      ) : (
        groups.map(([muscle, list]) => {
          const isOpen = !!expanded[muscle];
          return (
            <Card key={muscle} style={{ marginBottom: space[3], padding: 0 }}>
              <Pressable
                style={styles.groupHead}
                onPress={() => setExpanded((e) => ({ ...e, [muscle]: !e[muscle] }))}
              >
                <FsText variant="bodyMedium" style={{ flex: 1 }}>{muscle}</FsText>
                <FsText variant="caption" style={{ marginRight: space[2] }}>{list.length}</FsText>
                <View style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}>
                  <ChevronDown color={colors.muted} size={16} />
                </View>
              </Pressable>
              {isOpen &&
                list.map((ex) => (
                  <Pressable key={ex.id} style={[styles.exRow, styles.divider]} onPress={() => open(ex)}>
                    <View style={{ flex: 1 }}>
                      <FsText variant="body" numberOfLines={1}>{ex.name}</FsText>
                      {!!ex.equipment && <FsText variant="caption">{ex.equipment}</FsText>}
                    </View>
                    <ChevronRight color={colors.muted} size={16} />
                  </Pressable>
                ))}
            </Card>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingHorizontal: space[4],
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
