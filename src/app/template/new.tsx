import { useEffect, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Trash2, ChevronUp, ChevronDown, Dumbbell, Link2, Link2Off } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { KebabMenu } from '@/components/KebabMenu';
import { useTemplateDraftStore } from '@/stores/templateDraftStore';
import { useNavStore } from '@/stores/navStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

export default function NewTemplate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const { editingId, name, label, exercises, setName, setLabel, removeExercise, moveExercise, patch, startSuperset, ungroup, loadTemplate, save } = useTemplateDraftStore();

  const wizard = params.mode === 'wizard' && !editingId;
  const [step, setStep] = useState<1 | 2>(1);

  // Superset labels (A1/A2…) for adjacent exercises sharing a group, keyed by exercise id.
  const ssLabels = useMemo(() => {
    const out: Record<string, string> = {};
    let letterIdx = 0;
    let i = 0;
    while (i < exercises.length) {
      const g = exercises[i].supersetGroup;
      let j = i;
      while (j < exercises.length && g && exercises[j].supersetGroup === g) j++;
      const run = exercises.slice(i, j);
      if (g && run.length > 1) {
        const letter = String.fromCharCode(65 + (letterIdx % 26));
        run.forEach((e, k) => { out[e.exercise.id] = `${letter}${k + 1}`; });
        letterIdx++;
      }
      i = Math.max(j, i + 1);
    }
    return out;
  }, [exercises]);

  const onSupersetPress = (exerciseId: string, grouped: boolean) => {
    if (grouped) { ungroup(exerciseId); return; }
    startSuperset(exerciseId);
    router.push('/exercises?pick=template');
  };

  // Deep-link / fallback: load the template if we arrived with an id but the draft isn't primed.
  useEffect(() => {
    if (params.id && editingId !== params.id) {
      const t = workoutRepo.getTemplates().find((x) => x.id === params.id);
      if (t) loadTemplate(t);
    }
  }, [params.id]);

  const onSave = () => {
    const id = save();
    if (!id) {
      Alert.alert('Incomplete', 'Add a name and at least one exercise.');
      return;
    }
    useNavStore.getState().setSection('workout', 'library');
    router.replace('/(tabs)');
  };

  const title = editingId ? 'Edit Template' : wizard ? (step === 1 ? 'Add Exercises' : 'Configure') : 'New Template';
  const showConfig = !wizard || step === 2;
  const showAddBtn = !wizard || step === 1;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <Pressable onPress={() => (wizard && step === 2 ? setStep(1) : router.back())} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
        <FsText variant="cardTitle">{title}</FsText>
        {wizard && step === 1 ? (
          <Pressable onPress={() => (exercises.length ? setStep(2) : Alert.alert('Add an exercise', 'Browse and add at least one exercise first.'))} hitSlop={10}>
            <FsText variant="bodyMedium" style={{ color: colors.primary }}>Next</FsText>
          </Pressable>
        ) : (
          <Pressable onPress={onSave} hitSlop={10}>
            <FsText variant="bodyMedium" style={{ color: colors.success }}>{wizard ? 'Finish' : 'Save'}</FsText>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        {(!wizard || step === 1) && (
          <>
            <View style={styles.field}>
              <TextInput value={name} onChangeText={setName} placeholder="Template name (e.g. Push Day)"
                placeholderTextColor={colors.muted} style={styles.input} />
            </View>
            <View style={styles.field}>
              <TextInput value={label} onChangeText={setLabel} placeholder="Label / folder (optional, e.g. PPL)"
                placeholderTextColor={colors.muted} style={styles.input} />
            </View>
          </>
        )}

        {wizard && step === 1 && exercises.length === 0 && (
          <Card style={{ alignItems: 'center', gap: space[2], marginBottom: space[3] }}>
            <Dumbbell color={colors.muted} size={26} />
            <FsText variant="caption" style={{ textAlign: 'center' }}>Browse the exercise library and add the moves for this template. You'll set sets, reps and weight next.</FsText>
          </Card>
        )}

        {exercises.map((d, i) => (
          <Card key={d.exercise.id} style={{ marginBottom: space[3], ...(d.supersetGroup ? styles.ssCard : {}) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: showConfig ? space[2] : 0, gap: space[2] }}>
              <View style={styles.moveCol}>
                <Pressable onPress={() => moveExercise(d.exercise.id, -1)} disabled={i === 0} hitSlop={6} style={i === 0 && { opacity: 0.3 }}>
                  <ChevronUp color={colors.muted} size={18} />
                </Pressable>
                <Pressable onPress={() => moveExercise(d.exercise.id, 1)} disabled={i === exercises.length - 1} hitSlop={6} style={i === exercises.length - 1 && { opacity: 0.3 }}>
                  <ChevronDown color={colors.muted} size={18} />
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {ssLabels[d.exercise.id] && (
                    <View style={styles.ssBadge}><FsText variant="caption" style={{ color: colors.white, fontWeight: '700' }}>{ssLabels[d.exercise.id]}</FsText></View>
                  )}
                  <FsText variant="cardTitle" numberOfLines={1}>{d.exercise.name}</FsText>
                </View>
                {d.exercise.muscleGroup ? <FsText variant="caption">{d.exercise.muscleGroup}</FsText> : null}
              </View>
              <KebabMenu
                items={[
                  d.supersetGroup
                    ? { icon: Link2Off, label: 'Remove from superset', onPress: () => onSupersetPress(d.exercise.id, true) }
                    : { icon: Link2, label: 'Superset', onPress: () => onSupersetPress(d.exercise.id, false) },
                  { icon: Trash2, label: 'Remove exercise', danger: true, onPress: () => removeExercise(d.exercise.id) },
                ]}
              />
            </View>
            {showConfig && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                <NumField label="Sets" value={d.defaultSets} onChange={(n) => patch(d.exercise.id, { defaultSets: n })} />
                <NumField label="Reps" value={d.defaultReps} onChange={(n) => patch(d.exercise.id, { defaultReps: n })} />
                <NumField
                  label={`Weight (${UNIT_LABELS[unit].weight})`}
                  value={d.defaultWeightKg != null ? toDisplay(d.defaultWeightKg, unit) : 0}
                  onChange={(n) => patch(d.exercise.id, { defaultWeightKg: n > 0 ? toKg(n, unit) : null })}
                />
                <NumField label="Rest (s)" value={d.restSeconds} onChange={(n) => patch(d.exercise.id, { restSeconds: n })} />
              </View>
            )}
          </Card>
        ))}

        {showAddBtn && (
          <Button title="Browse & Add Exercise" variant="ghost" onPress={() => router.push('/exercises?pick=template')} />
        )}
      </ScrollView>
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '47%' }}>
      <FsText variant="caption" style={{ marginBottom: 4 }}>{label}</FsText>
      <TextInput
        defaultValue={String(value)}
        onChangeText={(t) => onChange(Number(t) || 0)}
        keyboardType="decimal-pad"
        style={[styles.input, { textAlign: 'center' }]}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  moveCol: { alignItems: 'center' },
  ssCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  ssBadge: { backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  field: { marginBottom: space[3] },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
  },
}));
