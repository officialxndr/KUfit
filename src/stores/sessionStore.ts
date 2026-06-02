import { create } from 'zustand';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { epley1RM } from '@/lib/epley';
import { normalizeSupersets } from '@/lib/supersets';
import type { Exercise, LocalExercise, LocalSet } from '@/types';

/**
 * In-memory active workout session. Persisted to SQLite only on finish
 * (workoutRepo.finishSession), which also computes volume + PRs.
 */
interface SessionState {
  active: boolean;
  sessionLocalId: string | null;
  name: string;
  startedAt: string | null;
  exercises: LocalExercise[];
  counter: number;
  /** When set, the next added exercise joins this superset group right after `afterLocalId`. */
  pendingSuperset: { group: string; afterLocalId: string } | null;

  startEmpty: () => void;
  startFromTemplate: (templateLocalId: string, name: string) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (localId: string) => void;
  addSet: (exLocalId: string) => void;
  updateSet: (exLocalId: string, setLocalId: string, patch: Partial<LocalSet>) => void;
  removeSet: (exLocalId: string, setLocalId: string) => void;
  setNotes: (exLocalId: string, notes: string) => void;
  setRestSeconds: (exLocalId: string, restSeconds: number) => void;
  /** Begin a superset on `exLocalId`; the next added exercise joins its group. */
  startSuperset: (exLocalId: string) => void;
  /** Remove an exercise from its superset group. */
  ungroup: (exLocalId: string) => void;
  setName: (name: string) => void;
  finish: (caloriesBurned?: number | null) => string | null;
  discard: () => void;
}

const nowIso = () => new Date().toISOString();

export const useSessionStore = create<SessionState>((set, get) => ({
  active: false,
  sessionLocalId: null,
  name: '',
  startedAt: null,
  exercises: [],
  counter: 0,
  pendingSuperset: null,

  startEmpty: () => {
    const name = 'Workout';
    const sessionLocalId = workoutRepo.startSession(name);
    set({ active: true, sessionLocalId, name, startedAt: nowIso(), exercises: [], counter: 0, pendingSuperset: null });
  },

  startFromTemplate: (templateLocalId, name) => {
    const sessionLocalId = workoutRepo.startSession(name, templateLocalId);
    const exercises = workoutRepo.buildLocalExercisesFromTemplate(templateLocalId);
    set({ active: true, sessionLocalId, name, startedAt: nowIso(), exercises, counter: 1000, pendingSuperset: null });
  },

  addExercise: (exercise) => {
    const counter = { n: get().counter };
    const le = workoutRepo.buildEmptyLocalExercise(exercise, counter);
    const pending = get().pendingSuperset;
    set((s) => {
      let next: LocalExercise[];
      if (pending) {
        le.supersetGroup = pending.group;
        // Commit the group on the source exercise too (kept off until a partner lands,
        // so cancelling the picker leaves it solo).
        const base = s.exercises.map((e) =>
          e.localId === pending.afterLocalId ? { ...e, supersetGroup: pending.group } : e
        );
        const at = base.findIndex((e) => e.localId === pending.afterLocalId);
        next = at < 0
          ? [...base, le]
          : [...base.slice(0, at + 1), le, ...base.slice(at + 1)];
      } else {
        next = [...s.exercises, le];
      }
      return {
        exercises: next.map((e, i) => ({ ...e, order: i })),
        counter: counter.n,
        pendingSuperset: null,
      };
    });
  },

  removeExercise: (localId) =>
    set((s) => ({
      exercises: normalizeSupersets(s.exercises.filter((e) => e.localId !== localId)).map((e, i) => ({ ...e, order: i })),
    })),

  startSuperset: (exLocalId) =>
    set((s) => {
      const ex = s.exercises.find((e) => e.localId === exLocalId);
      if (!ex) return s;
      // Reuse the existing group if the exercise is already in a superset; the
      // group is only committed to the exercises once a partner is added.
      const group = ex.supersetGroup ?? `sg-${s.counter + 1}`;
      return {
        counter: s.counter + 1,
        pendingSuperset: { group, afterLocalId: exLocalId },
      };
    }),

  ungroup: (exLocalId) =>
    set((s) => ({
      exercises: normalizeSupersets(
        s.exercises.map((e) => (e.localId === exLocalId ? { ...e, supersetGroup: null } : e))
      ),
    })),

  addSet: (exLocalId) =>
    set((s) => ({
      counter: s.counter + 1,
      exercises: s.exercises.map((e) => {
        if (e.localId !== exLocalId) return e;
        const last = e.sets[e.sets.length - 1];
        return {
          ...e,
          sets: [
            ...e.sets,
            {
              localId: String(s.counter + 1),
              setNumber: e.sets.length + 1,
              weightKg: last?.weightKg ?? 0,
              reps: last?.reps ?? 8,
              done: false,
              isPersonalBest: false,
            },
          ],
        };
      }),
    })),

  updateSet: (exLocalId, setLocalId, patch) =>
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.localId !== exLocalId
          ? e
          : { ...e, sets: e.sets.map((st) => (st.localId === setLocalId ? { ...st, ...patch } : st)) }
      ),
    })),

  removeSet: (exLocalId, setLocalId) =>
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.localId !== exLocalId
          ? e
          : {
              ...e,
              sets: e.sets
                .filter((st) => st.localId !== setLocalId)
                .map((st, i) => ({ ...st, setNumber: i + 1 })),
            }
      ),
    })),

  setNotes: (exLocalId, notes) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.localId === exLocalId ? { ...e, notes } : e)),
    })),

  setRestSeconds: (exLocalId, restSeconds) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.localId === exLocalId ? { ...e, restSeconds } : e)),
    })),

  setName: (name) => set({ name }),

  finish: (caloriesBurned) => {
    const { sessionLocalId, exercises } = get();
    if (!sessionLocalId) return null;

    // Build payload — only completed sets count. Detect PRs via Epley vs history.
    const payload = exercises.map((e) => {
      const best = workoutRepo.getBestEpleyForExercise(e.exerciseId);
      let newBest = best;
      const sets = e.sets
        .filter((st) => st.done && st.reps > 0)
        .map((st) => {
          const e1rm = epley1RM(st.weightKg, st.reps);
          const isPersonalBest = e1rm > newBest + 0.01;
          if (isPersonalBest) newBest = e1rm;
          return { setNumber: st.setNumber, weightKg: st.weightKg, reps: st.reps, rpe: st.rpe, isPersonalBest };
        });
      return { exerciseLocalId: e.exerciseId, notes: e.notes || undefined, order: e.order, supersetGroup: e.supersetGroup ?? null, sets };
    }).filter((e) => e.sets.length > 0);

    workoutRepo.finishSession(sessionLocalId, payload, nowIso(), caloriesBurned ?? null);
    const id = sessionLocalId;
    set({ active: false, sessionLocalId: null, name: '', startedAt: null, exercises: [], counter: 0, pendingSuperset: null });
    return id;
  },

  discard: () => {
    const { sessionLocalId } = get();
    if (sessionLocalId) workoutRepo.discardSession(sessionLocalId);
    set({ active: false, sessionLocalId: null, name: '', startedAt: null, exercises: [], counter: 0, pendingSuperset: null });
  },
}));
