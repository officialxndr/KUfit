import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Alert, Modal, TextInput } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Check, Plus, Minus, Trash2, X, Timer, Delete, ChevronDown, StickyNote, Info, Link2, Link2Off, Flame, HeartPulse, Scale, ArrowUp } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { KebabMenu } from '@/components/KebabMenu';
import { AttachmentDropdown } from '@/components/AttachmentDropdown';
import { PerArmDropdown } from '@/components/PerArmDropdown';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { updateLiveActivity, setLiveActivityRest } from '@/lib/liveActivity';
import { scheduleRestEndNotification, cancelRestEndNotification } from '@/lib/reminders';
import { isPerSide } from '@/lib/load';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { haptic, playRestEndHaptic } from '@/lib/haptics';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { health } from '@/lib/health';
import { useActiveCaloriesStore } from '@/stores/activeCaloriesStore';
import { caloriesBurnedFromDuration } from '@/lib/activities';
import { summarizeHeartRate, downsample } from '@/lib/heartRate';
import { nextSetCell, restAfterSet, supersetRuns, supersetLabels } from '@/lib/supersets';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { LocalExercise, LocalSet } from '@/types';

type Field = 'w' | 'r';
interface Focus { ex: string; set: string; field: Field; }
interface Rest { exId: string | null; setId: string | null; endsAt: number; total: number; }

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
function elapsed(startedAt: string | null): string {
  if (!startedAt) return '0:00';
  return mmss(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const weightLabel = UNIT_LABELS[unit].weight;
  const {
    active, name, startedAt, exercises,
    addSet, updateSet, removeSet, removeExercise, setNotes, setRestSeconds,
    setExercisePerSide, setAttachment, setUnilateral, setLeadSide, startSuperset, ungroup, finish, discard,
  } = useSessionStore();

  const REST_PRESETS = [30, 60, 90, 120, 180];

  const bodyWeightKg = useMemo(() => healthRepo.getLatestWeightEntry()?.weightKg ?? 75, []);

  const [, force] = useState(0);
  const finishing = useRef(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pristine, setPristine] = useState(true);
  const focusCell = (next: Focus) => { setFocus(next); setPristine(true); };
  const [rest, setRest] = useState<Rest>({ exId: null, setId: null, endsAt: 0, total: 0 });
  // Remaining is derived from a wall-clock end time (not a decrementing counter), so it stays
  // correct after the app is backgrounded — JS timers freeze, but `endsAt` doesn't. The 1s
  // `force` re-render below keeps the displayed value ticking while the app is active.
  const restRemaining = rest.endsAt > 0 ? Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000)) : 0;
  const restBuzzed = useRef(0);
  const [notesEx, setNotesEx] = useState<{ id: string; text: string } | null>(null);
  const [loadEx, setLoadEx] = useState<{ id: string; perSide: boolean } | null>(null);
  // `setId` present → editing one set's rest override; absent → the exercise default.
  const [restEx, setRestEx] = useState<{ id: string; setId?: string; seconds: number } | null>(null);
  const [customRest, setCustomRest] = useState('');

  // Auto-scroll the focused set into view above the numpad. Row nodes register here;
  // when the focused set changes we measure its offset within the scroll content and
  // scroll it near the top so it's never hidden behind the keypad.
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const rowRefs = useRef<Map<string, View>>(new Map());
  useEffect(() => {
    if (!focus) return;
    const row = rowRefs.current.get(focus.set);
    const content = contentRef.current;
    if (!row || !content) return;
    const t = setTimeout(() => {
      // New Architecture: measureLayout takes the relative *ref* (not a node handle).
      row.measureLayout(
        content as any,
        (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true }),
        () => {}
      );
    }, 60);
    return () => clearTimeout(t);
  }, [focus?.set]);

  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Refresh the Live Activity periodically so the (non-ticking) calorie estimate keeps advancing
  // while the app is open. The elapsed/rest timers self-tick natively; only kcal needs this.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => updateLiveActivity(useSessionStore.getState()), 30000);
    return () => clearInterval(t);
  }, [active]);

  // Drop any pending rest-over notification when leaving the workout (finish / discard / exit).
  useEffect(() => () => { cancelRestEndNotification(); }, []);

  // Buzz once when a rest naturally counts down to zero (guarded by the rest's `endsAt` so
  // it fires once per rest, even though `restRemaining` is recomputed every render), and flip
  // the Live Activity back to the elapsed timer. Manual skip zeroes `endsAt`, so this won't fire.
  useEffect(() => {
    if (rest.endsAt > 0 && rest.total > 0 && restRemaining === 0 && restBuzzed.current !== rest.endsAt) {
      restBuzzed.current = rest.endsAt;
      // Only buzz in-app if it *just* ended (we're foreground). If it ended while backgrounded
      // and we're only now seeing it on return, the rest notification already alerted — don't
      // double-buzz. Either way, cancel the (now-redundant) notification.
      if (Date.now() - rest.endsAt < 2500) playRestEndHaptic(useSettingsStore.getState().profile.restEndHaptic);
      cancelRestEndNotification();
      setLiveActivityRest(0);
      updateLiveActivity(useSessionStore.getState());
    }
  }, [restRemaining, rest.endsAt, rest.total]);

  // Live heart-rate readout — polls Health every few seconds while the session is
  // active. Returns null in Expo Go / without a watch, so the header simply hides it.
  const [currentHr, setCurrentHr] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const poll = () => health.getLatestHeartRate().then((bpm) => { if (!cancelled) setCurrentHr(bpm); }).catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [active]);

  const backToWorkout = (subTab: string) => {
    // /session is a fullScreenModal pushed over /(tabs). Set the target sub-tab on the
    // (still-mounted) tabs underneath, then POP the modal to reveal it. Using
    // router.replace('/(tabs)') here instead spawns a *second* tabs screen on top of the
    // original — the "land on library, then wipe back to library again" double transition.
    useNavStore.getState().setSection('workout', subTab);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  // Redirect home if the session ends — but not when we're finishing (that routes to the summary).
  useEffect(() => { if (!active && !finishing.current) backToWorkout('library'); }, [active]);
  if (!active && !finishing.current) return null;

  const wDisp = (kg: number) => Math.round(toDisplay(kg, unit));

  const onFinish = () => {
    if (!exercises.some((e) => e.sets.some((s) => s.done))) {
      Alert.alert('No sets completed', 'Check off at least one set, or discard the workout.');
      return;
    }
    finishing.current = true;
    const start = startedAt;
    const endIso = new Date().toISOString();
    const durationMin = start
      ? Math.min(360, Math.max(1, Math.round((Date.now() - new Date(start).getTime()) / 60000)))
      : 0;
    const estimate = caloriesBurnedFromDuration(durationMin, bodyWeightKg);
    const id = finish(estimate);
    const calSource = useSettingsStore.getState().profile.activeCalorieSource;
    // Refresh the daily active-calorie eat-back now that a workout landed.
    useActiveCaloriesStore.getState().refresh(calSource);
    // Reconcile with measured active energy (Apple Watch / Health Connect) once it returns.
    if (id && start) {
      health
        .getActiveEnergyBurned(start, endIso)
        .then((measured) => {
          if (measured && measured > 0) workoutRepo.setSessionCalories(id, Math.round(measured));
          useActiveCaloriesStore.getState().refresh(calSource);
        })
        .catch(() => {});
      // Pull the watch's heart-rate samples for the workout window → store summary + series.
      health
        .getHeartRateSamples(start, endIso)
        .then((bpms) => {
          if (!bpms?.length) return;
          const summary = summarizeHeartRate(bpms);
          if (summary) workoutRepo.setSessionHeartRate(id, { ...summary, samples: downsample(bpms) });
        })
        .catch(() => {});
    }
    if (id && useSettingsStore.getState().profile.showWorkoutSummary) router.replace({ pathname: '/workout-summary', params: { id } });
    else backToWorkout('history');
  };

  const confirmRemoveExercise = (exLocalId: string, exName: string) =>
    Alert.alert('Delete exercise?', `Remove "${exName}" and its sets from this workout?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExercise(exLocalId) },
    ]);
  const onDiscard = () => {
    Alert.alert('Discard workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      // `discard()` flips `active` → false; the effect above does the single nav back to
      // the library. (Navigating here too would double-replace → the "wipe back" flash.)
      { text: 'Discard', style: 'destructive', onPress: () => discard() },
    ]);
  };

  const startRest = (exId: string, setId: string, secs: number) => {
    const endsAt = Date.now() + secs * 1000;
    setRest({ exId, setId, endsAt, total: secs });
    // Feed the same end time to the Live Activity so its countdown stays in sync (and keeps
    // ticking natively on the Lock Screen / Dynamic Island even while the app is backgrounded).
    setLiveActivityRest(endsAt);
    updateLiveActivity(useSessionStore.getState());
    // Background safety net: a local notification fires the buzz if the phone is locked when
    // rest ends (JS is suspended + Vibration can't fire from the background). Suppressed in the
    // foreground, where the in-app vibration handles it.
    scheduleRestEndNotification(secs);
  };

  /** Skip/dismiss the current rest timer (and clear the Live Activity countdown). */
  const skipRest = () => {
    setRest({ exId: null, setId: null, endsAt: 0, total: 0 });
    setLiveActivityRest(0);
    updateLiveActivity(useSessionStore.getState());
    cancelRestEndNotification();
  };

  const press = (key: string) => {
    if (!focus) return;
    const ex = exercises.find((e) => e.localId === focus.ex);
    const st = ex?.sets.find((s) => s.localId === focus.set);
    if (!ex || !st) return;

    if (key === 'next') {
      if (focus.field === 'w') { haptic.tap(); focusCell({ ...focus, field: 'r' }); return; }
      updateSet(ex.localId, st.localId, { done: true });
      haptic.success();
      // Rest only after the last exercise of a superset round (always, for solo exercises).
      if (restAfterSet(exercises, ex.localId, st.localId)) startRest(ex.localId, st.localId, st.restSeconds ?? (ex.restSeconds || 90));
      // Advance through the round-interleaved sequence — carries into the next exercise.
      const nx = nextSetCell(exercises, ex.localId, st.localId);
      if (nx) focusCell({ ex: nx.exLocalId, set: nx.setLocalId, field: 'w' });
      else setFocus(null);
      return;
    }

    // Digit / delete entry. Delete always backspaces the real value; a digit on a
    // freshly focused field overwrites it, then subsequent digits append.
    const curStr = focus.field === 'w'
      ? (wDisp(st.weightKg) > 0 ? String(wDisp(st.weightKg)) : '')
      : (st.reps > 0 ? String(st.reps) : '');
    const ns = key === 'del' ? curStr.slice(0, -1) : (pristine ? '' : curStr) + key;
    const value = parseInt(ns || '0', 10) || 0;
    if (focus.field === 'w') {
      updateSet(ex.localId, st.localId, { weightKg: toKg(value, unit) });
    } else {
      updateSet(ex.localId, st.localId, { reps: value });
    }
    setPristine(false);
  };

  const step = (dir: number) => {
    if (!focus) return;
    const ex = exercises.find((e) => e.localId === focus.ex);
    const st = ex?.sets.find((s) => s.localId === focus.set);
    if (!ex || !st) return;
    if (focus.field === 'w') {
      updateSet(ex.localId, st.localId, { weightKg: toKg(Math.max(0, wDisp(st.weightKg) + dir * 5), unit) });
    } else {
      updateSet(ex.localId, st.localId, { reps: Math.max(0, st.reps + dir) });
    }
    setPristine(false);
  };

  // The value to carry into the focused cell: the previous set's value (this workout), else
  // last workout's value for that set (the ghost). Returns null when there's nothing to carry.
  const prevSource = (): { weightKg: number; reps: number } | null => {
    if (!focus) return null;
    const ex = exercises.find((e) => e.localId === focus.ex);
    const i = ex ? ex.sets.findIndex((s) => s.localId === focus.set) : -1;
    const st = ex?.sets[i];
    if (!ex || !st) return null;
    const prevSet = i > 0 ? ex.sets[i - 1] : null;
    const ghost = ex.lastSets.find((l) => l.setNumber === st.setNumber && (l.side ?? null) === (st.side ?? null));
    return prevSet ?? ghost ?? null;
  };

  /** Display value the "use previous" button will apply to the focused field, or null. */
  const prevValue = (): number | null => {
    const src = prevSource();
    if (!src || !focus) return null;
    return focus.field === 'w' ? wDisp(src.weightKg) : src.reps;
  };

  const usePrev = () => {
    const src = prevSource();
    if (!src || !focus) return;
    const ex = exercises.find((e) => e.localId === focus.ex);
    const st = ex?.sets.find((s) => s.localId === focus.set);
    if (!ex || !st) return;
    updateSet(ex.localId, st.localId, focus.field === 'w' ? { weightKg: src.weightKg } : { reps: src.reps });
    setPristine(false);
    haptic.tap();
  };

  const Cell = ({ exId, setId, field, value, focused, done }: { exId: string; setId: string; field: Field; value: number; focused: boolean; done?: boolean }) => (
    <Pressable onPress={() => focusCell({ ex: exId, set: setId, field })} style={[styles.cell, done && !focused && styles.cellDone, focused && styles.cellFocused]}>
      <FsText variant="bodyMedium" style={{ color: value > 0 ? colors.text : colors.muted, fontVariant: ['tabular-nums'] }}>
        {value > 0 ? value : 0}
      </FsText>
    </Pressable>
  );

  const renderSwipeActions = (ex: LocalExercise, st: LocalSet) => (
    <View style={styles.swipeActions}>
      <Pressable
        style={[styles.swipeBtn, { backgroundColor: colors.danger }]}
        onPress={() =>
          Alert.alert('Delete set?', `Remove set ${st.setNumber}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { if (focus?.set === st.localId) setFocus(null); removeSet(ex.localId, st.localId); } },
          ])
        }
      >
        <Trash2 color={colors.white} size={16} />
        <FsText variant="caption" style={{ color: colors.white }}>Delete</FsText>
      </Pressable>
    </View>
  );

  const onSupersetPress = (ex: LocalExercise) => {
    if (ex.supersetGroup) { ungroup(ex.localId); return; }
    startSuperset(ex.localId);
    router.push('/exercises?pick=session');
  };

  // Apply a per-arm choice, skipping no-op changes so set rows aren't needlessly rebuilt.
  const applyPerArm = (ex: LocalExercise, next: { unilateral: boolean; leadSide: 'L' | 'R' }) => {
    if (!!ex.exercise.unilateral !== next.unilateral) setUnilateral(ex.localId, next.unilateral);
    if (next.unilateral && (ex.exercise.leadSide ?? 'L') !== next.leadSide) setLeadSide(ex.localId, next.leadSide);
  };

  const renderExercise = (ex: LocalExercise, label?: string) => (
    <Card key={ex.localId} style={{ marginBottom: space[3] }}>
      <View style={styles.exHeader}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/exercise/${ex.exercise.id}`)} hitSlop={6}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!!label && (
              <View style={styles.ssBadge}><FsText variant="caption" style={{ color: colors.white, fontWeight: '700' }}>{label}</FsText></View>
            )}
            <FsText variant="cardTitle" style={{ color: colors.primary, flexShrink: 1 }} numberOfLines={1}>{ex.exercise.name}</FsText>
            <Info color={colors.muted} size={14} />
          </View>
          {!!ex.exercise.muscleGroup && <FsText variant="caption">{ex.exercise.muscleGroup}</FsText>}
        </Pressable>
        <KebabMenu
          items={[
            ex.supersetGroup
              ? { icon: Link2Off, label: 'Remove from superset', onPress: () => onSupersetPress(ex) }
              : { icon: Link2, label: 'Superset', onPress: () => onSupersetPress(ex) },
            { icon: StickyNote, label: ex.notes ? 'Edit notes' : 'Add notes', onPress: () => setNotesEx({ id: ex.localId, text: ex.notes ?? '' }) },
            { icon: Timer, label: 'Rest timer', onPress: () => { setRestEx({ id: ex.localId, seconds: ex.restSeconds || 90 }); setCustomRest(''); } },
            { icon: Scale, label: 'Load counting', onPress: () => setLoadEx({ id: ex.localId, perSide: isPerSide(ex.exercise) }) },
            { icon: Trash2, label: 'Delete exercise', danger: true, onPress: () => confirmRemoveExercise(ex.localId, ex.exercise.name) },
          ]}
        />
      </View>

      {/* Per-arm + attachment controls sit directly below the name/subheading, above the sets grid. */}
      <View style={styles.metaRow}>
        <PerArmDropdown
          unilateral={ex.exercise.unilateral}
          leadSide={ex.exercise.leadSide}
          onChange={(next) => applyPerArm(ex, next)}
        />
        <AttachmentDropdown
          equipment={ex.exercise.equipment}
          value={ex.attachment ?? null}
          onChange={(v) => setAttachment(ex.localId, v)}
        />
      </View>

      {!!ex.notes && (
        <View style={styles.noteChip}>
          <StickyNote color={colors.muted} size={13} />
          <FsText variant="caption" style={{ flex: 1 }}>{ex.notes}</FsText>
        </View>
      )}

      <View style={styles.gridHead}>
        <FsText variant="overline" style={styles.colSet}>Set</FsText>
        <FsText variant="overline" style={styles.colPrev}>Previous</FsText>
        <FsText variant="overline" style={styles.colCell}>{weightLabel}</FsText>
        <FsText variant="overline" style={styles.colCell}>Reps</FsText>
        <View style={styles.colCheck}><Check color={colors.muted} size={13} /></View>
      </View>

      {ex.sets.map((st, i) => {
        const ghost = ex.lastSets.find((l) => l.setNumber === st.setNumber && (l.side ?? null) === (st.side ?? null));
        const nextSet = ex.sets[i + 1];
        const wFocused = focus?.ex === ex.localId && focus?.set === st.localId && focus?.field === 'w';
        const rFocused = focus?.ex === ex.localId && focus?.set === st.localId && focus?.field === 'r';
        const restHere = rest.setId === st.localId && restRemaining > 0;
        return (
          <Fragment key={st.localId}>
            <Swipeable renderRightActions={() => renderSwipeActions(ex, st)} overshootRight={false}>
              <View
                ref={(n) => { if (n) rowRefs.current.set(st.localId, n as unknown as View); else rowRefs.current.delete(st.localId); }}
                style={[styles.setRow, st.done && styles.setRowDone]}
              >
                <View style={styles.colSet}><View style={[styles.setChip, st.done && styles.setChipDone]}><FsText variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>{`${st.setNumber}${st.side ?? ''}`}</FsText></View></View>
                <FsText variant="caption" style={[styles.colPrev, { textAlign: 'center', fontVariant: ['tabular-nums'] }]}>
                  {ghost ? `${wDisp(ghost.weightKg)} × ${ghost.reps}` : '—'}
                </FsText>
                <View style={styles.colCell}><Cell exId={ex.localId} setId={st.localId} field="w" value={wDisp(st.weightKg)} focused={wFocused} done={st.done} /></View>
                <View style={styles.colCell}><Cell exId={ex.localId} setId={st.localId} field="r" value={st.reps} focused={rFocused} done={st.done} /></View>
                <View style={styles.colCheck}>
                  <Pressable
                    onPress={() => {
                      const nextDone = !st.done;
                      updateSet(ex.localId, st.localId, { done: nextDone });
                      if (nextDone) {
                        haptic.success();
                        if (restAfterSet(exercises, ex.localId, st.localId)) startRest(ex.localId, st.localId, st.restSeconds ?? (ex.restSeconds || 90));
                      } else if (rest.setId === st.localId) {
                        // Un-checking the set that started the rest cancels its timer.
                        skipRest();
                      }
                    }}
                    style={[styles.check, st.done && { backgroundColor: colors.success, borderColor: colors.success }]}
                    hitSlop={6}
                  >
                    {st.done && (
                      <Animated.View entering={ZoomIn.springify().damping(11).stiffness(180)}>
                        <Check color={colors.white} size={15} strokeWidth={3} />
                      </Animated.View>
                    )}
                  </Pressable>
                </View>
              </View>
            </Swipeable>
            {nextSet && nextSet.setNumber !== st.setNumber && (
              <Pressable
                style={styles.restDivider}
                onPress={() => { setRestEx({ id: ex.localId, setId: st.localId, seconds: st.restSeconds ?? (ex.restSeconds || 90) }); setCustomRest(''); }}
                hitSlop={6}
              >
                <View style={[styles.restLine, restHere && { backgroundColor: colors.primary }]} />
                <View style={styles.restPill}>
                  <Timer color={restHere ? colors.primary : colors.muted} size={12} />
                  <FsText variant="caption" style={{ color: restHere ? colors.primary : colors.muted, fontVariant: ['tabular-nums'], fontWeight: restHere ? '700' : '400' }}>
                    {restHere ? mmss(restRemaining) : mmss(st.restSeconds ?? (ex.restSeconds || 90))}
                  </FsText>
                  {st.restSeconds != null && !restHere && <View style={styles.restCustomDot} />}
                </View>
                <View style={[styles.restLine, restHere && { backgroundColor: colors.primary }]} />
              </Pressable>
            )}
          </Fragment>
        );
      })}

      <Pressable onPress={() => addSet(ex.localId)} style={styles.addSet}>
        <Plus color={colors.primary} size={16} strokeWidth={2.4} />
        <FsText variant="caption" style={{ color: colors.primary }}>Add set</FsText>
      </Pressable>
    </Card>
  );

  // Rest-timer fill: 100% at the start of the rest, depleting to 0% as it counts down.
  const restPct = rest.total > 0 ? Math.max(0, Math.min(100, (restRemaining / rest.total) * 100)) : 0;

  return (
    <GestureHandlerRootView style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <Pressable onPress={onDiscard} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <View style={{ alignItems: 'center' }}>
          <FsText variant="cardTitle" numberOfLines={1}>{name}</FsText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <FsText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{elapsed(startedAt)}</FsText>
            <Flame color={colors.muted} size={11} />
            <FsText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
              {caloriesBurnedFromDuration(
                startedAt ? (Date.now() - new Date(startedAt).getTime()) / 60000 : 0,
                bodyWeightKg
              )} kcal
            </FsText>
            {currentHr != null && (
              <>
                <HeartPulse color={colors.danger} size={11} />
                <FsText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{currentHr} bpm</FsText>
              </>
            )}
          </View>
        </View>
        <Pressable onPress={onFinish} hitSlop={10}>
          <FsText variant="bodyMedium" style={{ color: colors.success }}>Finish</FsText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: focus ? 410 : restRemaining > 0 ? 190 : 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View ref={contentRef} style={{ paddingHorizontal: space[4], paddingTop: space[4] }}>
        {exercises.length === 0 && <FsText variant="caption">Add an exercise to begin.</FsText>}

        {(() => {
          const labels = supersetLabels(exercises);
          return supersetRuns(exercises).map((run) =>
            run.length > 1 ? (
              <View key={`ss-${run[0].localId}`} style={styles.supersetWrap}>
                <View style={styles.supersetTag}>
                  <Link2 color={colors.primary} size={13} />
                  <FsText variant="overline" style={{ color: colors.primary }}>Superset</FsText>
                </View>
                {run.map((ex) => renderExercise(ex, labels[ex.localId]))}
              </View>
            ) : (
              renderExercise(run[0])
            )
          );
        })()}

        <Button title="Add Exercise" variant="ghost" onPress={() => router.push('/exercises?pick=session')} />
        <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[3] }}>Swipe a set left to delete it.</FsText>
        </View>
      </ScrollView>

      {restRemaining > 0 && !focus && (
        <View style={[styles.restBanner, { paddingBottom: insets.bottom || space[3] }]}>
          <View style={styles.restBannerRow}>
            <Timer color={colors.primary} size={18} />
            <FsText variant="cardTitle" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>Rest · {mmss(restRemaining)}</FsText>
            <Pressable onPress={skipRest} hitSlop={8}>
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>Skip</FsText>
            </Pressable>
          </View>
          <View style={[styles.restBarTrack, { marginTop: space[2] }]}>
            <View style={[styles.restBarFill, { width: `${restPct}%` }]} />
          </View>
        </View>
      )}

      {focus && (
        <View style={[styles.numpad, { paddingBottom: insets.bottom || space[3] }]}>
          {restRemaining > 0 && (
            <View style={styles.restTimerBox}>
              <View style={styles.restTimerRow}>
                <Timer color={colors.primary} size={15} />
                <FsText variant="bodyMedium" style={{ color: colors.primary, flex: 1 }}>Rest</FsText>
                <FsText variant="bodyMedium" style={{ color: colors.primary, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{mmss(restRemaining)}</FsText>
                <Pressable onPress={skipRest} hitSlop={8} style={{ marginLeft: space[3] }}>
                  <FsText variant="bodyMedium" style={{ color: colors.muted }}>Skip</FsText>
                </Pressable>
              </View>
              <View style={styles.restBarTrack}>
                <View style={[styles.restBarFill, { width: `${restPct}%` }]} />
              </View>
            </View>
          )}
          {(() => {
            const pv = prevValue();
            return pv != null ? (
              <Pressable onPress={usePrev} style={styles.prevBtn} hitSlop={4}>
                <ArrowUp color={colors.primary} size={15} />
                <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                  Use previous {focus.field === 'w' ? weightLabel : 'reps'}: {pv}
                </FsText>
              </Pressable>
            ) : null;
          })()}
          <View style={styles.padRow}>
            <Key label="1" onPress={() => press('1')} />
            <Key label="2" onPress={() => press('2')} />
            <Key label="3" onPress={() => press('3')} />
            <Key icon={<Delete color={colors.muted} size={22} />} onPress={() => press('del')} />
          </View>
          <View style={styles.padRow}>
            <Key label="4" onPress={() => press('4')} />
            <Key label="5" onPress={() => press('5')} />
            <Key label="6" onPress={() => press('6')} />
            <Key icon={<Minus color={colors.muted} size={20} />} onPress={() => step(-1)} />
          </View>
          <View style={styles.padRow}>
            <Key label="7" onPress={() => press('7')} />
            <Key label="8" onPress={() => press('8')} />
            <Key label="9" onPress={() => press('9')} />
            <Key icon={<Plus color={colors.muted} size={20} />} onPress={() => step(1)} />
          </View>
          <View style={styles.padRow}>
            <Key icon={<ChevronDown color={colors.muted} size={22} />} onPress={() => setFocus(null)} />
            <Key label="0" onPress={() => press('0')} />
            <Pressable onPress={() => press('next')} style={styles.nextKey}>
              <FsText variant="bodyMedium" style={{ color: colors.white }}>{focus.field === 'w' ? 'Next' : 'Done'}</FsText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Rest timer config */}
      <Modal visible={!!restEx} transparent animationType="fade" onRequestClose={() => setRestEx(null)}>
        <Pressable style={styles.noteBackdrop} onPress={() => setRestEx(null)}>
          <Pressable style={styles.noteCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[1] }}>{restEx?.setId ? 'Rest after this set' : 'Rest between sets'}</FsText>
            <FsText variant="caption" style={{ marginBottom: space[3] }}>
              {restEx?.setId ? 'Custom rest for just this set — overrides the exercise default.' : "Default rest timer for this exercise's sets."}
            </FsText>
            <View style={styles.restPresets}>
              {REST_PRESETS.map((sec) => {
                const on = restEx?.seconds === sec;
                return (
                  <Pressable
                    key={sec}
                    style={[styles.restPreset, on && { backgroundColor: colors.primary }]}
                    onPress={() => setRestEx((r) => (r ? { ...r, seconds: sec } : r))}
                  >
                    <FsText variant="bodyMedium" style={{ color: on ? colors.white : colors.muted }}>
                      {sec < 60 ? `${sec}s` : mmss(sec)}
                    </FsText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <FsText variant="caption" style={{ flex: 1 }}>Custom (seconds)</FsText>
              <TextInput
                value={customRest}
                onChangeText={(t) => { setCustomRest(t); const n = Number(t); if (n > 0) setRestEx((r) => (r ? { ...r, seconds: n } : r)); }}
                keyboardType="number-pad"
                placeholder={String(restEx?.seconds ?? 90)}
                placeholderTextColor={colors.muted}
                style={styles.customInput}
              />
            </View>
            {restEx?.setId && (
              <Pressable
                onPress={() => { if (restEx?.setId) updateSet(restEx.id, restEx.setId, { restSeconds: undefined }); setRestEx(null); }}
                style={{ marginTop: space[3] }}
                hitSlop={6}
              >
                <FsText variant="caption" style={{ color: colors.muted, textAlign: 'center' }}>Reset to exercise default</FsText>
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[4] }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => setRestEx(null)} /></View>
              <View style={{ flex: 1 }}>
                <Button title="Save" onPress={() => {
                  if (restEx) {
                    const secs = Math.max(5, Math.round(restEx.seconds));
                    if (restEx.setId) updateSet(restEx.id, restEx.setId, { restSeconds: secs });
                    else setRestSeconds(restEx.id, secs);
                  }
                  setRestEx(null);
                }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Exercise note editor */}
      <Modal visible={!!notesEx} transparent animationType="fade" onRequestClose={() => setNotesEx(null)}>
        <Pressable style={styles.noteBackdrop} onPress={() => setNotesEx(null)}>
          <Pressable style={styles.noteCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Exercise notes</FsText>
            <TextInput
              value={notesEx?.text ?? ''}
              onChangeText={(t) => setNotesEx((n) => (n ? { ...n, text: t } : n))}
              placeholder="e.g. felt heavy, drop set next time…"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.noteInput}
            />
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => setNotesEx(null)} /></View>
              <View style={{ flex: 1 }}>
                <Button title="Save" onPress={() => { if (notesEx) setNotes(notesEx.id, notesEx.text.trim()); setNotesEx(null); }} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Load counting (per-side volume) — same control as the exercise detail, inline mid-workout */}
      <Modal visible={!!loadEx} transparent animationType="fade" onRequestClose={() => setLoadEx(null)}>
        <Pressable style={styles.noteBackdrop} onPress={() => setLoadEx(null)}>
          <Pressable style={styles.noteCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[1] }}>Load counting</FsText>
            <FsText variant="caption" style={{ marginBottom: space[3] }}>
              How the logged weight counts toward volume. Use “Per side” for two-arm dumbbell/kettlebell moves — the weight is per hand, so it counts ×2.
            </FsText>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {([{ on: true, label: 'Per side ×2' }, { on: false, label: 'Total' }] as const).map((opt) => {
                const sel = !!loadEx && loadEx.perSide === opt.on;
                return (
                  <Pressable
                    key={opt.label}
                    style={[styles.loadOpt, sel && styles.loadOptOn]}
                    onPress={() => { if (loadEx) { setExercisePerSide(loadEx.id, opt.on); setLoadEx({ ...loadEx, perSide: opt.on }); haptic.tap(); } }}
                  >
                    <FsText variant="bodyMedium" style={{ color: sel ? colors.white : colors.muted }}>{opt.label}</FsText>
                  </Pressable>
                );
              })}
            </View>
            <Button title="Done" onPress={() => setLoadEx(null)} style={{ marginTop: space[4] }} />
          </Pressable>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
  );
}

function Key({ label, icon, onPress }: { label?: string; icon?: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.border }]}>
      {icon ?? <FsText style={styles.keyLabel}>{label}</FsText>}
    </Pressable>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingBottom: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space[2], gap: space[1] },
  supersetWrap: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    borderRadius: radius.md, backgroundColor: 'rgba(99,102,241,0.05)',
    paddingLeft: space[2], paddingTop: space[2], marginBottom: space[3],
  },
  supersetTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space[2], paddingBottom: space[1] },
  ssBadge: { backgroundColor: colors.primary, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  noteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: space[2],
  },
  gridHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.surface },
  setRowDone: { backgroundColor: 'rgba(34,197,94,0.18)' },
  colSet: { width: 36, alignItems: 'center' },
  colPrev: { flex: 1.2 },
  colCell: { flex: 1, paddingHorizontal: 3 },
  colCheck: { width: 44, alignItems: 'center' },
  setChip: { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  setChipDone: { backgroundColor: 'transparent' },
  cell: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  cellFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  cellDone: { backgroundColor: 'transparent' },
  check: {
    width: 36, height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  restDivider: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: 6, paddingHorizontal: space[2] },
  restLine: { flex: 1, height: 1, backgroundColor: colors.border },
  restPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restCustomDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  swipeActions: { flexDirection: 'row', alignItems: 'center' },
  swipeBtn: { width: 72, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 3 },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space[2], marginTop: 4, justifyContent: 'center' },
  restBanner: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: space[4], paddingTop: space[3],
  },
  restBannerRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  numpad: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: space[2], gap: space[2],
  },
  restTimerBox: { gap: 6, paddingHorizontal: 4, paddingTop: 2 },
  restTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restBarTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  restBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  prevBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh,
  },
  padRow: { flexDirection: 'row', gap: space[2] },
  key: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  keyLabel: { fontSize: 24, lineHeight: 30, color: colors.text, fontWeight: '400' },
  nextKey: { flex: 2, height: 52, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  noteBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[6] },
  noteCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  noteInput: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: 12,
    color: colors.text, fontSize: 14, minHeight: 90, textAlignVertical: 'top',
  },
  restPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  restPreset: {
    flexGrow: 1, minWidth: 56, alignItems: 'center', paddingVertical: 10,
    borderRadius: radius.sm, backgroundColor: colors.surfaceHigh,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3] },
  customInput: {
    width: 90, textAlign: 'right', backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14,
  },
  loadOpt: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  loadOptOn: { backgroundColor: colors.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
}));

