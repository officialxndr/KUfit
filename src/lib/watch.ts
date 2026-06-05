import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { loadFactor } from '@/lib/load';
import { formatVolume, toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { restAfterSet } from '@/lib/supersets';
import { buildTheme } from '@/lib/widget';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRoutineStore, getNextTemplateId } from '@/stores/routineStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRestStore } from '@/stores/restStore';
import { finishActiveWorkout } from '@/lib/finishWorkout';
import type { LocalExercise, LocalSet } from '@/types';

/**
 * Apple Watch orchestration (phone side). The watch is a rich remote + display for the
 * phone's existing workout engine — it never reimplements it. This module:
 *
 *  1. Builds a JSON **snapshot** of the active workout (or the start menu when idle) and
 *     pushes it to the watch via the native `HaleWatch` WatchConnectivity bridge.
 *  2. Receives **commands** the watch sends back (start, set values, set complete, skip rest,
 *     finish, discard) plus live HR/calorie metrics, and applies them to the SAME
 *     `useSessionStore` / `useRestStore` actions the phone UI calls — so both devices stay in
 *     lockstep regardless of which one acted.
 *
 * Mirrors `src/lib/liveActivity.ts`: all calls are guarded (no-op off iOS, in Expo Go, or when
 * the native module is absent), and pushes happen only on meaningful changes (set complete /
 * exercise change / rest start-stop), never on every keystroke. The watch holds its own
 * in-progress numpad entry and commits it on "Next".
 */
interface WatchMessage {
  type: string;
  [key: string]: unknown;
}
interface NativeWatch {
  isSupported(): boolean;
  isReachable(): boolean;
  updateState(json: string): void;
  addListener(event: 'onMessage', listener: (msg: WatchMessage) => void): { remove: () => void };
}

const Native = requireOptionalNativeModule<NativeWatch>('HaleWatch');

/** The slice of session state the snapshot needs (the full store satisfies this). */
export interface WatchSession {
  active: boolean;
  name: string;
  startedAt: string | null;
  exercises: LocalExercise[];
}

// ── Live metrics fed back from the watch's HKWorkoutSession ────────────────────
let latestWatchKcal = 0;
let latestWatchKcalAt = 0;

/** Latest heart-rate-based calorie estimate from the watch, or null if stale/absent.
 *  `liveActivity.ts` prefers this over the MET estimate while a watch workout is running. */
export function watchLiveCalories(): number | null {
  if (latestWatchKcal > 0 && Date.now() - latestWatchKcalAt < 120_000) return latestWatchKcal;
  return null;
}

// ── Phone focus → watch ────────────────────────────────────────────────────────
interface WatchFocus {
  exId: string;
  setId: string;
  field: 'weight' | 'reps';
}
/** The cell the phone session screen is focused on; mirrored onto the watch so the watch
 *  follows whatever you tap on the phone. Null = the watch uses its own "next set" logic. */
let currentFocus: WatchFocus | null = null;

/** Called from `session.tsx` when the focused cell changes (or clears). */
export function setWatchFocus(focus: WatchFocus | null): void {
  currentFocus = focus;
  syncWatch();
}

// ── Snapshot ──────────────────────────────────────────────────────────────────
/** The "current" exercise + set the watch should be entering: the first not-done set of the
 *  first exercise that still has one (else the last). Matches `liveActivity.ts`'s notion of
 *  "current". (Superset round-interleaving isn't mirrored on the watch — a v1 simplification.) */
function currentCell(s: WatchSession): { idx: number; ex: LocalExercise | null; set: LocalSet | null } {
  let idx = s.exercises.findIndex((e) => e.sets.some((st) => !st.done));
  if (idx < 0) idx = s.exercises.length - 1;
  const ex = idx >= 0 ? s.exercises[idx] : null;
  const set = ex ? ex.sets.find((st) => !st.done) ?? ex.sets[ex.sets.length - 1] ?? null : null;
  return { idx, ex, set };
}

/** Value to carry into the current set: the previous set this workout, else last time's ghost. */
function prevFor(ex: LocalExercise, set: LocalSet): { weightKg: number; reps: number } | null {
  const i = ex.sets.findIndex((s) => s.localId === set.localId);
  const prevSet = i > 0 ? ex.sets[i - 1] : null;
  const ghost = ex.lastSets.find((l) => l.setNumber === set.setNumber && (l.side ?? null) === (set.side ?? null));
  return prevSet ?? ghost ?? null;
}

function buildSnapshot(s: WatchSession): Record<string, unknown> {
  const unit = useSettingsStore.getState().profile.unitSystem;
  const unitLabel = UNIT_LABELS[unit].weight;
  const theme = buildTheme();

  if (!s.active) {
    // Idle: the start menu — default routine's next-up + every template.
    const templates = workoutRepo
      .getTemplates()
      .map((t) => ({ id: t.id, name: t.name, exerciseCount: t.exercises.length }));
    const { routines, defaultRoutineId } = useRoutineStore.getState();
    const routine = routines.find((r) => r.id === defaultRoutineId) ?? routines[0];
    let nextTemplateId: string | null = null;
    let nextWorkoutName = '';
    if (routine) {
      nextTemplateId = getNextTemplateId(routine);
      nextWorkoutName = templates.find((t) => t.id === nextTemplateId)?.name ?? '';
    }
    return { active: false, theme, unitLabel, templates, nextTemplateId, nextWorkoutName };
  }

  // Active workout.
  const wDisp = (kg: number) => Math.round(toDisplay(kg, unit));
  let setsDone = 0;
  let totalSets = 0;
  let volumeKg = 0;
  for (const e of s.exercises) {
    const factor = loadFactor(e.exercise);
    for (const st of e.sets) {
      totalSets++;
      if (st.done) {
        setsDone++;
        volumeKg += factor * (st.weightKg || 0) * (st.reps || 0);
      }
    }
  }

  // The set the watch shows + edits: the phone's focused cell when it has one (so the watch
  // mirrors whatever you tap on the phone), otherwise the first unfinished set.
  let idx = -1;
  let ex: LocalExercise | null = null;
  let set: LocalSet | null = null;
  let currentField: 'weight' | 'reps' = 'weight';
  const f = currentFocus;
  if (f) {
    idx = s.exercises.findIndex((e) => e.localId === f.exId);
    ex = idx >= 0 ? s.exercises[idx] : null;
    set = ex?.sets.find((st) => st.localId === f.setId) ?? null;
    if (ex && set) currentField = f.field;
  }
  if (!ex || !set) {
    const cc = currentCell(s);
    idx = cc.idx;
    ex = cc.ex;
    set = cc.set;
    currentField = 'weight';
  }

  let currentSet: Record<string, unknown> | null = null;
  if (ex && set) {
    const prev = prevFor(ex, set);
    currentSet = {
      exId: ex.localId,
      setId: set.localId,
      setNumber: set.setNumber,
      side: set.side ?? '',
      weight: wDisp(set.weightKg),
      reps: set.reps,
      prevText: prev ? `${wDisp(prev.weightKg)} × ${prev.reps}` : '',
    };
  }

  const startedAtMs = s.startedAt ? new Date(s.startedAt).getTime() : Date.now();
  const restEndsAt = useRestStore.getState().endsAt;
  const restEndsAtMs = restEndsAt > Date.now() ? restEndsAt : 0;
  const restTotal = useRestStore.getState().total;

  return {
    active: true,
    workoutName: s.name || 'Workout',
    startedAtMs,
    exerciseName: ex ? ex.exercise.name : 'Workout',
    exerciseIndex: s.exercises.length ? idx + 1 : 0,
    totalExercises: s.exercises.length,
    setsDone,
    totalSets,
    volumeText: volumeKg > 0 ? formatVolume(volumeKg, unit) : '',
    restEndsAtMs,
    restTotal,
    unitLabel,
    currentSet,
    currentField,
    theme,
  };
}

/** Build + push the latest snapshot to the watch. Safe to call anywhere; no-op off iOS. */
export function syncWatch(s?: WatchSession): void {
  if (Platform.OS !== 'ios' || !Native) return;
  try {
    if (!Native.isSupported()) return;
    Native.updateState(JSON.stringify(buildSnapshot(s ?? useSessionStore.getState())));
  } catch (err) {
    if (__DEV__) console.warn('[watch] sync failed:', err);
  }
}

/** Tell the watch the workout ended — pushes the (idle) start-menu snapshot. */
export function endWatch(): void {
  currentFocus = null;
  syncWatch({ active: false, name: '', startedAt: null, exercises: [] });
}

// ── Commands from the watch ────────────────────────────────────────────────────
function maybeStartRest(exId: string, setId: string): void {
  const { exercises } = useSessionStore.getState();
  const ex = exercises.find((e) => e.localId === exId);
  const st = ex?.sets.find((s) => s.localId === setId);
  if (!ex || !st) return;
  // Same rule as the phone: rest only after the last exercise of a superset round (always solo).
  if (restAfterSet(exercises, exId, setId)) {
    useRestStore.getState().startRest(exId, setId, st.restSeconds ?? (ex.restSeconds || 90));
  }
}

function handleMessage(msg: WatchMessage): void {
  try {
    const session = useSessionStore.getState();
    const unit = useSettingsStore.getState().profile.unitSystem;
    switch (msg.type) {
      case 'startEmpty':
        session.startEmpty();
        break;
      case 'startTemplate': {
        const t = workoutRepo.getTemplates().find((x) => x.id === String(msg.templateId ?? ''));
        if (t) {
          session.startFromTemplate(t.id, t.name);
          // Advance routine rotation like the phone's start entry points do.
          const { routines, defaultRoutineId } = useRoutineStore.getState();
          const routine = routines.find((r) => r.id === defaultRoutineId) ?? routines[0];
          if (routine && routine.templateIds.includes(t.id)) {
            useRoutineStore.getState().markDone(routine.id, t.id);
          }
        }
        break;
      }
      case 'setValue': {
        const exId = String(msg.exId ?? '');
        const setId = String(msg.setId ?? '');
        const value = Number(msg.value ?? 0);
        if (msg.field === 'weight') session.updateSet(exId, setId, { weightKg: toKg(value, unit) });
        else if (msg.field === 'reps') session.updateSet(exId, setId, { reps: Math.max(0, Math.round(value)) });
        break;
      }
      case 'completeSet': {
        const exId = String(msg.exId ?? '');
        const setId = String(msg.setId ?? '');
        session.updateSet(exId, setId, { done: true });
        maybeStartRest(exId, setId);
        break;
      }
      case 'skipRest':
        useRestStore.getState().skipRest();
        break;
      case 'requestSync':
        // The watch app just opened/foregrounded — push the freshest snapshot (incl. templates).
        syncWatch();
        break;
      case 'finish':
        finishActiveWorkout();
        break;
      case 'discard':
        session.discard();
        break;
      case 'liveMetrics':
        latestWatchKcal = Number(msg.kcal ?? 0);
        latestWatchKcalAt = Date.now();
        break;
    }
  } catch (err) {
    if (__DEV__) console.warn('[watch] message failed:', err);
  }
}

let bridgeInited = false;

/** Wire the watch → phone command stream once, and push the current state so a freshly
 *  opened watch app is populated. Call at app launch (see `_layout.tsx`). */
export function initWatchBridge(): void {
  if (bridgeInited || Platform.OS !== 'ios' || !Native) return;
  bridgeInited = true;
  try {
    Native.addListener('onMessage', handleMessage);
  } catch (err) {
    if (__DEV__) console.warn('[watch] listener failed:', err);
  }
  syncWatch();
}
