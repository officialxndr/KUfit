import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem, type SortableGridDragEndParams } from 'react-native-sortables';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Trash2, GripVertical, Dumbbell, Link2, Link2Off } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { KebabMenu } from '@/components/KebabMenu';
import { useTemplateDraftStore, type DraftExercise } from '@/stores/templateDraftStore';
import { useNavStore } from '@/stores/navStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/** A draggable unit in the editor: one solo exercise, or a contiguous superset run. */
type Block = { key: string; group: string | null; items: DraftExercise[] };

export default function NewTemplate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const { editingId, name, label, exercises, setName, setLabel, removeExercise, setExercises, patch, startSuperset, ungroup, loadTemplate, save } = useTemplateDraftStore();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

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

  // Group adjacent superset members into one draggable block so a superset moves
  // as a single locked unit; solo exercises are blocks of one.
  const blocks = useMemo<Block[]>(() => {
    const out: Block[] = [];
    let i = 0;
    while (i < exercises.length) {
      const g = exercises[i].supersetGroup;
      if (g) {
        let j = i;
        while (j < exercises.length && exercises[j].supersetGroup === g) j++;
        out.push({ key: `g:${g}`, group: g, items: exercises.slice(i, j) });
        i = j;
      } else {
        out.push({ key: `e:${exercises[i].exercise.id}`, group: null, items: [exercises[i]] });
        i++;
      }
    }
    return out;
  }, [exercises]);

  const onDragEnd = useCallback(
    ({ data }: SortableGridDragEndParams<Block>) => setExercises(data.flatMap((b) => b.items)),
    [setExercises]
  );

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

  // One exercise's header + (optionally) its set/rep/weight config.
  const renderRow = (d: DraftExercise) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: showConfig ? space[2] : 0, gap: space[2] }}>
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
    </View>
  );

  // A draggable block: a drag handle beside one exercise (solo) or a stacked
  // superset run sharing a single card with the indigo accent.
  const renderBlock: SortableGridRenderItem<Block> = ({ item }) => (
    <Card style={{ marginBottom: space[3], flexDirection: 'row', alignItems: 'flex-start', gap: space[2], ...(item.group ? styles.ssCard : {}) }}>
      <Sortable.Handle>
        <View style={styles.handle}><GripVertical color={colors.muted} size={18} /></View>
      </Sortable.Handle>
      <View style={{ flex: 1, gap: space[3] }}>
        {item.items.map((d, k) => (
          <View key={d.exercise.id} style={k > 0 ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[3] } : undefined}>
            {renderRow(d)}
          </View>
        ))}
      </View>
    </Card>
  );

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

      <Animated.ScrollView ref={scrollRef} contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
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

        <Sortable.Grid
          columns={1}
          data={blocks}
          keyExtractor={(b) => b.key}
          renderItem={renderBlock}
          onDragEnd={onDragEnd}
          customHandle
          hapticsEnabled
          scrollableRef={scrollRef}
        />

        {showAddBtn && (
          <Button title="Browse & Add Exercise" variant="ghost" onPress={() => router.push('/exercises?pick=template')} />
        )}
      </Animated.ScrollView>
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
  handle: { paddingVertical: 4, paddingRight: 2, justifyContent: 'center' },
  ssCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  ssBadge: { backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  field: { marginBottom: space[3] },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
  },
}));
