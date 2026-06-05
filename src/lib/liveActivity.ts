import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { loadFactor } from '@/lib/load';
import { formatVolume } from '@/lib/units';
import { useSettingsStore } from '@/stores/settingsStore';
import type { LocalExercise } from '@/types';

/**
 * Workout Live Activity orchestration (Lock Screen + Dynamic Island).
 *
 * Builds the ActivityKit `ContentState` from the active session and drives the native
 * `HaleLiveActivity` module (iOS 16.2+). The elapsed timer self-ticks natively from
 * `startedAtMs`, so we only push updates on meaningful changes (set completed, exercise
 * added/removed) — never on every keystroke. All calls are guarded: no-op off iOS, in
 * Expo Go, or when the user has Live Activities disabled.
 */
interface NativeLiveActivity {
  isSupported(): boolean;
  start(workoutName: string, state: Record<string, string | number>): void;
  update(state: Record<string, string | number>): void;
  end(): void;
}

const Native = requireOptionalNativeModule<NativeLiveActivity>('HaleLiveActivity');

/** The slice of session state the activity needs (the full store satisfies this). */
export interface LiveActivitySession {
  name: string;
  startedAt: string | null;
  exercises: LocalExercise[];
}

let started = false;

function buildState(s: LiveActivitySession): Record<string, string | number> {
  const unit = useSettingsStore.getState().profile.unitSystem;

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

  // "Current" exercise = first with an unfinished set, else the last one.
  let idx = s.exercises.findIndex((e) => e.sets.some((st) => !st.done));
  if (idx < 0) idx = s.exercises.length - 1;
  const current = idx >= 0 ? s.exercises[idx] : null;

  return {
    exerciseName: current ? current.exercise.name : 'Workout',
    setsDone,
    totalSets,
    exerciseIndex: s.exercises.length ? idx + 1 : 0,
    totalExercises: s.exercises.length,
    startedAtMs: s.startedAt ? new Date(s.startedAt).getTime() : Date.now(),
    restEndsAtMs: 0,
    volumeText: volumeKg > 0 ? formatVolume(volumeKg, unit) : '',
  };
}

export function startLiveActivity(s: LiveActivitySession): void {
  if (Platform.OS !== 'ios' || !Native) return;
  try {
    if (!Native.isSupported()) return;
    Native.start(s.name || 'Workout', buildState(s));
    started = true;
  } catch (err) {
    if (__DEV__) console.warn('[liveActivity] start failed:', err);
  }
}

export function updateLiveActivity(s: LiveActivitySession): void {
  if (Platform.OS !== 'ios' || !Native) return;
  try {
    if (!started) {
      startLiveActivity(s);
      return;
    }
    Native.update(buildState(s));
  } catch (err) {
    if (__DEV__) console.warn('[liveActivity] update failed:', err);
  }
}

export function endLiveActivity(): void {
  started = false;
  if (Platform.OS !== 'ios' || !Native) return;
  try {
    Native.end();
  } catch (err) {
    if (__DEV__) console.warn('[liveActivity] end failed:', err);
  }
}
