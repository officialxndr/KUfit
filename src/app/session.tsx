import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Plus, Trash2, X } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space } from '@/theme/tokens';

function elapsed(startedAt: string | null): string {
  if (!startedAt) return '0:00';
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionScreen() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const {
    active, name, startedAt, exercises,
    addSet, updateSet, removeSet, removeExercise, finish, discard,
  } = useSessionStore();

  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active) router.replace('/(tabs)/workout');
  }, [active]);

  if (!active) return null;

  const onFinish = () => {
    const anyDone = exercises.some((e) => e.sets.some((s) => s.done));
    if (!anyDone) {
      Alert.alert('No sets completed', 'Check off at least one set, or discard the workout.');
      return;
    }
    finish();
    router.replace('/(tabs)/workout');
  };

  const onDiscard = () => {
    Alert.alert('Discard workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { discard(); router.replace('/(tabs)/workout'); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onDiscard} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <FsText variant="cardTitle">{name}</FsText>
          <FsText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{elapsed(startedAt)}</FsText>
        </View>
        <Pressable onPress={onFinish} hitSlop={10}>
          <FsText variant="bodyMedium" style={{ color: colors.success }}>Finish</FsText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        {exercises.length === 0 && (
          <FsText variant="caption">Add an exercise to begin.</FsText>
        )}

        {exercises.map((ex) => (
          <Card key={ex.localId} style={{ marginBottom: space[3] }}>
            <View style={styles.exHeader}>
              <FsText variant="cardTitle" style={{ flex: 1 }} numberOfLines={1}>{ex.exercise.name}</FsText>
              <Pressable onPress={() => removeExercise(ex.localId)} hitSlop={8}>
                <Trash2 color={colors.muted} size={18} />
              </Pressable>
            </View>

            {/* column headers */}
            <View style={styles.setRow}>
              <FsText variant="overline" style={{ width: 28 }}>SET</FsText>
              <FsText variant="overline" style={{ flex: 1, textAlign: 'center' }}>{UNIT_LABELS[unit].weight.toUpperCase()}</FsText>
              <FsText variant="overline" style={{ flex: 1, textAlign: 'center' }}>REPS</FsText>
              <View style={{ width: 36 }} />
            </View>

            {ex.sets.map((st) => {
              const ghost = ex.lastSets.find((l) => l.setNumber === st.setNumber);
              return (
                <View key={st.localId} style={styles.setRow}>
                  <FsText variant="bodyMedium" style={{ width: 28 }}>{st.setNumber}</FsText>
                  <View style={{ flex: 1, paddingHorizontal: 4 }}>
                    <TextInput
                      defaultValue={st.weightKg ? String(toDisplay(st.weightKg, unit)) : ''}
                      onChangeText={(t) => updateSet(ex.localId, st.localId, { weightKg: t ? toKg(Number(t), unit) : 0 })}
                      keyboardType="decimal-pad"
                      placeholder={ghost ? String(toDisplay(ghost.weightKg, unit)) : '0'}
                      placeholderTextColor={colors.muted}
                      style={styles.cell}
                    />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 4 }}>
                    <TextInput
                      defaultValue={st.reps ? String(st.reps) : ''}
                      onChangeText={(t) => updateSet(ex.localId, st.localId, { reps: Number(t) || 0 })}
                      keyboardType="number-pad"
                      placeholder={ghost ? String(ghost.reps) : '0'}
                      placeholderTextColor={colors.muted}
                      style={styles.cell}
                    />
                  </View>
                  <Pressable
                    onPress={() => updateSet(ex.localId, st.localId, { done: !st.done })}
                    style={[styles.check, st.done && { backgroundColor: colors.success, borderColor: colors.success }]}
                    hitSlop={6}
                  >
                    {st.done && <Check color={colors.white} size={16} strokeWidth={3} />}
                  </Pressable>
                </View>
              );
            })}

            <Pressable onPress={() => addSet(ex.localId)} style={styles.addSet}>
              <Plus color={colors.primary} size={16} strokeWidth={2.4} />
              <FsText variant="caption" style={{ color: colors.primary }}>Add set</FsText>
            </Pressable>
          </Card>
        ))}

        <Button title="Add Exercise" variant="ghost" onPress={() => router.push('/exercises?pick=session')} />
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
  exHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: space[2] },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
  cell: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    textAlign: 'center', color: colors.text, paddingVertical: 8, fontSize: 15,
  },
  check: {
    width: 36, height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space[2], marginTop: 4 },
});
