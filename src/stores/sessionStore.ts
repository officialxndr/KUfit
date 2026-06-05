import { create } from 'zustand';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { epley1RM } from '@/lib/epley';
import { normalizeSupersets } from '@/lib/supersets';
import { appendRound, removeSetOrRound, expandToPairs, collapseToSingles, reorderLead } from '@/lib/unilateral';
import { startLiveActivity, updateLiveActivity, endLiveActivity } from '@/lib/liveActivity';
import type { Exercise, LocalExercise, LocalSet, Side } from '@/types';

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
  /** Toggle how this exercise's logged weight counts toward volume (per side ×2 vs total). Persists to the exercise row. */
  setExercisePerSide: (exLocalId: string, perSide: boolean) => void;
  /** Choose the cable attachment for this performance (re-resolves ghost values to that attachment's history). */
  setAttachment: (exLocalId: string, attachment: string | null) => void;
  /** Toggle per-arm (unilateral) logging — expands/collapses sets into L/R rows. Persists to the exercise row. */
  setUnilateral: (exLocalId: string, unilateral: boolean) => void;
  /** Set which arm is logged first (reorders each round's L/R rows). Persists to the exercise row. */
  setLeadSide: (exLocalId: string, leadSide: Side) => void;
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
    startLiveActivity(get());
  },

  startFromTemplate: (templateLocalId, name) => {
    const sessionLocalId = workoutRepo.startSession(name, templateLocalId);
    const exercises = workoutRepo.buildLocalExercisesFromTemplate(templateLocalId);
    set({ active: true, sessionLocalId, name, startedAt: nowIso(), exercises, counter: 1000, pendingSuperset: null });
    startLiveActivity(get());
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
    updateLiveActivity(get());
  },

  removeExercise: (localId) => {
    set((s) => ({
      exercises: normalizeSupersets(s.exercises.filter((e) => e.localId !== localId)).map((e, i) => ({ ...e, order: i })),
    }));
    updateLiveActivity(get());
  },

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

  addSet: (exLocalId) => {
    set((s) => {
      let counter = s.counter;
      const nextId = () => String(++counter);
      const exercises = s.exercises.map((e) =>
        e.localId === exLocalId
          ? { ...e, sets: appendRound(e.sets, !!e.exercise.unilateral, e.exercise.leadSide, nextId) }
          : e
      );
      return { counter, exercises };
    });
    updateLiveActivity(get());
  },

  updateSet: (exLocalId, setLocalId, patch) => {
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.localId !== exLocalId
          ? e
          : { ...e, sets: e.sets.map((st) => (st.localId === setLocalId ? { ...st, ...patch } : st)) }
      ),
    }));
    // Only completing/uncompleting a set changes the activity — skip weight/rep keystrokes.
    if ('done' in patch) updateLiveActivity(get());
  },

  removeSet: (exLocalId, setLocalId) => {
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.localId !== exLocalId
          ? e
          : { ...e, sets: removeSetOrRound(e.sets, setLocalId, !!e.exercise.unilateral) }
      ),
    }));
    updateLiveActivity(get());
  },

  setNotes: (exLocalId, notes) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.localId === exLocalId ? { ...e, notes } : e)),
    })),

  setRestSeconds: (exLocalId, restSeconds) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.localId === exLocalId ? { ...e, restSeconds } : e)),
    })),

  setExercisePerSide: (exLocalId, perSide) => {
    const ex = get().exercises.find((e) => e.localId === exLocalId);
    if (!ex) return;
    workoutRepo.setExercisePerSide(ex.exercise.id, perSide); // persist on the exercise definition
    set((s) => ({
      exercises: s.exercises.map((e) =>
        e.localId === exLocalId ? { ...e, exercise: { ...e.exercise, perSide } } : e
      ),
    }));
  },

  setAttachment: (exLocalId, attachment) =>
    set((s) => ({
      exercises: s.exercises.map((e) => {
        if (e.localId !== exLocalId) return e;
        // Ghosts follow the attachment — each attachment is its own progress line.
        const lastSets = workoutRepo.getLastSetsForExercise(e.exercise.id, attachment ?? null);
        return { ...e, attachment: attachment ?? null, lastSets };
      }),
    })),

  setUnilateral: (exLocalId, unilateral) =>
    set((s) => {
      let counter = s.counter;
      const nextId = () => String(++counter);
      const exercises = s.exercises.map((e) => {
        if (e.localId !== exLocalId) return e;
        workoutRepo.setExerciseUnilateral(e.exercise.id, unilateral); // persist on the exercise definition
        const sets = unilateral
          ? expandToPairs(e.sets, e.exercise.leadSide, nextId)
          : collapseToSingles(e.sets, e.exercise.leadSide);
        return { ...e, exercise: { ...e.exercise, unilateral }, sets };
      });
      return { counter, exercises };
    }),

  setLeadSide: (exLocalId, leadSide) =>
    set((s) => ({
      exercises: s.exercises.map((e) => {
        if (e.localId !== exLocalId) return e;
        workoutRepo.setExerciseLeadSide(e.exercise.id, leadSide); // persist on the exercise definition
        const sets = e.exercise.unilateral ? reorderLead(e.sets, leadSide) : e.sets;
        return { ...e, exercise: { ...e.exercise, leadSide }, sets };
      }),
    })),

  setName: (name) => set({ name }),

  finish: (caloriesBurned) => {
    const { sessionLocalId, exercises } = get();
    if (!sessionLocalId) return null;

    // Build payload — only completed sets count. Detect PRs via Epley vs history (per attachment).
    const payload = exercises.map((e) => {
      const best = workoutRepo.getBestEpleyForExercise(e.exerciseId, e.attachment ?? null);
      let newBest = best;
      const sets = e.sets
        .filter((st) => st.done && st.reps > 0)
        .map((st) => {
          const e1rm = epley1RM(st.weightKg, st.reps);
          const isPersonalBest = e1rm > newBest + 0.01;
          if (isPersonalBest) newBest = e1rm;
          return { setNumber: st.setNumber, weightKg: st.weightKg, reps: st.reps, rpe: st.rpe, isPersonalBest, side: st.side ?? null };
        });
      return { exerciseLocalId: e.exerciseId, notes: e.notes || undefined, order: e.order, supersetGroup: e.supersetGroup ?? null, attachment: e.attachment ?? null, sets };
    }).filter((e) => e.sets.length > 0);

    workoutRepo.finishSession(sessionLocalId, payload, nowIso(), caloriesBurned ?? null);
    const id = sessionLocalId;
    set({ active: false, sessionLocalId: null, name: '', startedAt: null, exercises: [], counter: 0, pendingSuperset: null });
    endLiveActivity();
    return id;
  },

  discard: () => {
    const { sessionLocalId } = get();
    if (sessionLocalId) workoutRepo.discardSession(sessionLocalId);
    set({ active: false, sessionLocalId: null, name: '', startedAt: null, exercises: [], counter: 0, pendingSuperset: null });
    endLiveActivity();
  },
}));
