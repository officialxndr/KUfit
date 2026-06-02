import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem, type SortableGridDragEndParams } from 'react-native-sortables';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
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

/**
 * Draggable chain handle for linking a (solo) exercise into a superset. Uses its OWN
 * pan gesture — not the sortable's reorder drag — so the list never shifts while you
 * aim. A brief press-and-hold activates it (so it wins over the ScrollView), then drag
 * onto another exercise; the screen hit-tests the finger against card rects (stable,
 * because nothing is reordering) and highlights the target.
 */
function LinkHandle({ sourceKey, onStart, onMove, onEnd }: {
  sourceKey: string;
  onStart: (sourceKey: string) => void;
  onMove: (absoluteY: number) => void;
  onEnd: (commit: boolean) => void;
}) {
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(140)
        .shouldCancelWhenOutside(false)
        .onStart(() => onStart(sourceKey))
        .onUpdate((e) => onMove(e.absoluteY))
        .onEnd(() => onEnd(true))
        .onFinalize(() => onEnd(false)),
    [sourceKey, onStart, onMove, onEnd]
  );
  return (
    <GestureDetector gesture={pan}>
      <View style={styles.linkHandle} hitSlop={8}><Link2 color={colors.muted} size={18} /></View>
    </GestureDetector>
  );
}

/**
 * Drop-target highlight for a block. Driven by a shared value so it repaints on the UI
 * thread without a React re-render — the library memoizes item cells, so state-based
 * styling wouldn't reliably update. Rendered as an absolute overlay *inside* the card
 * (not a wrapper) so it can't disturb the drag.
 */
function DropOverlay({ itemKey, armedKey }: { itemKey: string; armedKey: SharedValue<string | null> }) {
  const style = useAnimatedStyle(() => ({ opacity: armedKey.value === itemKey ? 1 : 0 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dropOverlay, style]}>
      <FsText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>Release to superset</FsText>
    </Animated.View>
  );
}

export default function NewTemplate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const { editingId, name, label, exercises, setName, setLabel, removeExercise, setExercises, patch, startSuperset, ungroup, linkExerciseInto, loadTemplate, save } = useTemplateDraftStore();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // Link-handle (drag-to-superset) state. The chain handle's pan is independent of the
  // reorder drag, so nothing shifts while linking. `armedKey` (shared value) drives the
  // target highlight on the UI thread; the refs hold the in-flight source/target and the
  // card rects measured at gesture start (valid throughout, since the list stays put).
  const armedKey = useSharedValue<string | null>(null);
  const hoverTargetRef = useRef<string | null>(null);
  const linkingSourceRef = useRef<string | null>(null);
  const cardRefs = useRef<Map<string, View>>(new Map());
  const measuredRects = useRef<{ key: string; y: number; h: number }[]>([]);

  // Snapshot every card's window rect; called when a link drag starts. The list isn't
  // reordering during a link drag, so these stay accurate for the whole gesture.
  const measureCards = useCallback(() => {
    const rects: { key: string; y: number; h: number }[] = [];
    cardRefs.current.forEach((node, key) => {
      node.measureInWindow((_x, y, _w, h) => rects.push({ key, y, h }));
    });
    measuredRects.current = rects;
  }, []);

  const onLinkStart = useCallback((sourceKey: string) => {
    linkingSourceRef.current = sourceKey;
    measureCards();
    Haptics.selectionAsync().catch(() => {});
  }, [measureCards]);

  const onLinkMove = useCallback((absoluteY: number) => {
    const source = linkingSourceRef.current;
    let hit: string | null = null;
    for (const r of measuredRects.current) {
      if (r.key !== source && absoluteY >= r.y && absoluteY <= r.y + r.h) { hit = r.key; break; }
    }
    if (hit !== hoverTargetRef.current) {
      hoverTargetRef.current = hit;
      armedKey.value = hit;
      if (hit) Haptics.selectionAsync().catch(() => {});
    }
  }, [armedKey]);

  // Fires on release (commit=true) and again on finalize (commit=false, cleanup-only).
  // Block keys are `e:<exerciseId>` (solo) or `g:<group>` (superset run); we resolve
  // them against `exercises` rather than the later-declared `blocks` memo.
  const onLinkEnd = useCallback((commit: boolean) => {
    const source = linkingSourceRef.current;
    const target = hoverTargetRef.current;
    armedKey.value = null;
    hoverTargetRef.current = null;
    linkingSourceRef.current = null;
    measuredRects.current = [];
    // Only a solo exercise (key `e:…`) can be linked into another block.
    if (!commit || !source || !target || source === target || !source.startsWith('e:')) return;
    const srcId = source.slice(2);
    const srcName = exercises.find((e) => e.exercise.id === srcId)?.exercise.name;
    if (!srcName) return;
    // Anchor = last exercise of the target block (so the dragged one appends to a run).
    let anchorId: string | null = null;
    let targetName = '';
    if (target.startsWith('e:')) {
      anchorId = target.slice(2);
      targetName = exercises.find((e) => e.exercise.id === anchorId)?.exercise.name ?? '';
    } else if (target.startsWith('g:')) {
      const members = exercises.filter((e) => e.supersetGroup === target.slice(2));
      if (members.length) {
        anchorId = members[members.length - 1].exercise.id;
        targetName = members.map((m) => m.exercise.name).join(' + ');
      }
    }
    if (!anchorId) return;
    const anchor = anchorId;
    Alert.alert(
      'Create superset',
      `Superset “${srcName}” with “${targetName}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Superset', onPress: () => linkExerciseInto(srcId, anchor) },
      ]
    );
  }, [armedKey, exercises, linkExerciseInto]);

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

  // Reorder only — superset linking is handled by the chain handle's own gesture.
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
    <Card
      ref={(n) => { if (n) cardRefs.current.set(item.key, n); else cardRefs.current.delete(item.key); }}
      style={{ marginBottom: space[3], flexDirection: 'row', alignItems: 'flex-start', gap: space[2], ...(item.group ? styles.ssCard : {}) }}
    >
      <DropOverlay itemKey={item.key} armedKey={armedKey} />
      <Sortable.Handle>
        <View style={styles.handle}><GripVertical color={colors.muted} size={20} /></View>
      </Sortable.Handle>
      <View style={{ flex: 1, gap: space[3] }}>
        {item.items.map((d, k) => (
          <View key={d.exercise.id} style={k > 0 ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[3] } : undefined}>
            {renderRow(d)}
          </View>
        ))}
      </View>
      {item.group === null && (
        <LinkHandle sourceKey={item.key} onStart={onLinkStart} onMove={onLinkMove} onEnd={onLinkEnd} />
      )}
    </Card>
  );

  return (
    // Native-stack modal screens render in their own container; gesture-handler pan
    // gestures (the Sortable drag handle) don't register here unless this subtree has
    // its own GestureHandlerRootView. Taps still work without it, which is why the
    // kebab/buttons worked but the drag handle didn't.
    <GestureHandlerRootView style={styles.screen}>
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
          scrollableRef={scrollRef}
        />

        {showAddBtn && (
          <Button title="Browse & Add Exercise" variant="ghost" onPress={() => router.push('/exercises?pick=template')} />
        )}
      </Animated.ScrollView>
    </GestureHandlerRootView>
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
  handle: { paddingVertical: 10, paddingHorizontal: 6, justifyContent: 'center' },
  linkHandle: { paddingVertical: 10, paddingHorizontal: 6, alignSelf: 'center', justifyContent: 'center' },
  ssCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  dropOverlay: {
    borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.lg,
    backgroundColor: colors.bg + 'E6', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  ssBadge: { backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  field: { marginBottom: space[3] },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
  },
}));
