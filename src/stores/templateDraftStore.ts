import { create } from 'zustand';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { normalizeSupersets } from '@/lib/supersets';
import type { Exercise, ExerciseSet, WorkoutTemplate } from '@/types';

export interface DraftExercise {
  exercise: Exercise;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
  restSeconds: number;
  /** Group key shared by adjacent exercises in a superset (null = solo). */
  supersetGroup: string | null;
  /** Default cable attachment for this exercise (Rope, V-Bar, …); null = none. */
  attachment: string | null;
  /** Variation this exercise belongs to (null = shared across all variants). */
  variant: string | null;
}

interface TemplateDraftState {
  editingId: string | null;
  name: string;
  description: string;
  label: string;
  exercises: DraftExercise[];
  /** Variation names for an A/B workout (empty = a plain template). */
  variants: string[];
  /** Which variant the editor is currently showing/editing (null = template has no variants). */
  activeVariant: string | null;
  /** When set, the next added exercise joins this superset group after `afterId`. */
  pendingSuperset: { group: string; afterId: string } | null;
  reset: () => void;
  loadTemplate: (t: WorkoutTemplate) => void;
  setName: (name: string) => void;
  setLabel: (label: string) => void;
  /** Replace the variant list; reassigns exercises pinned to a removed variant back to shared. */
  setVariants: (variants: string[]) => void;
  setActiveVariant: (variant: string | null) => void;
  /** Pin an exercise to a variant (null = shared). A superset moves as a unit — all its members
   *  get the same variant — so a group can never straddle two versions (which would break on reorder). */
  setExerciseVariant: (exerciseId: string, variant: string | null) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  moveExercise: (exerciseId: string, dir: -1 | 1) => void;
  /** Replace the exercise list wholesale — used by drag-to-reorder. */
  setExercises: (exercises: DraftExercise[]) => void;
  patch: (exerciseId: string, p: Partial<DraftExercise>) => void;
  startSuperset: (exerciseId: string) => void;
  ungroup: (exerciseId: string) => void;
  /** Superset `draggedId` with `targetId` (drag-onto): both share a group, dragged sits right after target. */
  linkExerciseInto: (draggedId: string, targetId: string) => void;
  save: () => string | null;
}

export const useTemplateDraftStore = create<TemplateDraftState>((set, get) => ({
  editingId: null,
  name: '',
  description: '',
  label: '',
  exercises: [],
  variants: [],
  activeVariant: null,
  pendingSuperset: null,
  reset: () => set({ editingId: null, name: '', description: '', label: '', exercises: [], variants: [], activeVariant: null, pendingSuperset: null }),
  loadTemplate: (t) => set({
    editingId: t.id,
    name: t.name,
    description: t.description ?? '',
    label: t.label ?? '',
    variants: t.variants ?? [],
    activeVariant: t.variants?.[0] ?? null,
    pendingSuperset: null,
    exercises: normalizeSupersets(
      t.exercises
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((te) => ({
          exercise: te.exercise,
          defaultSets: te.defaultSets ?? 3,
          defaultReps: te.defaultReps ?? 8,
          defaultWeightKg: te.defaultWeightKg ?? null,
          restSeconds: te.restSeconds ?? 120,
          supersetGroup: te.supersetGroup ?? null,
          attachment: te.attachment ?? null,
          variant: te.variant ?? null,
        }))
    ),
  }),
  setName: (name) => set({ name }),
  setLabel: (label) => set({ label }),
  setVariants: (variants) => set((s) => ({
    variants,
    activeVariant: variants.includes(s.activeVariant ?? '') ? s.activeVariant : (variants[0] ?? null),
    // Reassign any exercise pinned to a now-removed variant back to shared, so nothing is hidden/lost.
    exercises: s.exercises.map((e) => (e.variant && !variants.includes(e.variant) ? { ...e, variant: null } : e)),
  })),
  setActiveVariant: (activeVariant) => set({ activeVariant }),
  setExerciseVariant: (exerciseId, variant) => set((s) => {
    const ex = s.exercises.find((e) => e.exercise.id === exerciseId);
    if (!ex) return s;
    const group = ex.supersetGroup;
    return {
      exercises: s.exercises.map((e) =>
        e.exercise.id === exerciseId || (group != null && e.supersetGroup === group) ? { ...e, variant } : e
      ),
    };
  }),
  addExercise: (exercise) => {
    // Prefill the default weight + reps with what you last lifted, so building a routine doesn't mean
    // looking up the other workout. Uses the heaviest set from this exercise's most recent finished
    // workout — weight and reps come from the SAME set so they stay a coherent pair (a heavy 100×1
    // day prefills 100×1, not 100×8). No history → blank weight + the 8-rep planning default.
    const lastSets = workoutRepo.getLastSetsForExercise(exercise.id);
    const top = lastSets.reduce<ExerciseSet | null>((best, s) => (best && best.weightKg >= s.weightKg ? best : s), null);
    set((s) => {
      if (s.exercises.some((e) => e.exercise.id === exercise.id)) return s;
      const pending = s.pendingSuperset;
      const draft: DraftExercise = {
        exercise, defaultSets: 3,
        defaultReps: top?.reps ?? 8,
        defaultWeightKg: top && top.weightKg > 0 ? top.weightKg : null,
        restSeconds: 120,
        supersetGroup: pending?.group ?? null, attachment: null,
        // A newly added exercise is tagged with the variant currently being edited (null = shared).
        variant: s.activeVariant ?? null,
      };
      if (!pending) return { exercises: [...s.exercises, draft] };
      // Commit the group on the source exercise and insert the new one right after it.
      const base = s.exercises.map((e) =>
        e.exercise.id === pending.afterId ? { ...e, supersetGroup: pending.group } : e
      );
      const at = base.findIndex((e) => e.exercise.id === pending.afterId);
      const next = at < 0 ? [...base, draft] : [...base.slice(0, at + 1), draft, ...base.slice(at + 1)];
      return { exercises: next, pendingSuperset: null };
    });
  },
  removeExercise: (exerciseId) =>
    set((s) => ({ exercises: normalizeSupersets(s.exercises.filter((e) => e.exercise.id !== exerciseId)) })),
  moveExercise: (exerciseId, dir) =>
    set((s) => {
      const i = s.exercises.findIndex((e) => e.exercise.id === exerciseId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const next = [...s.exercises];
      [next[i], next[j]] = [next[j], next[i]];
      return { exercises: normalizeSupersets(next) };
    }),
  setExercises: (exercises) => set({ exercises: normalizeSupersets(exercises) }),
  patch: (exerciseId, p) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.exercise.id === exerciseId ? { ...e, ...p } : e)),
    })),
  startSuperset: (exerciseId) =>
    set((s) => {
      const ex = s.exercises.find((e) => e.exercise.id === exerciseId);
      if (!ex) return s;
      const group = ex.supersetGroup ?? `sg-${Math.random().toString(36).slice(2, 8)}`;
      return { pendingSuperset: { group, afterId: exerciseId } };
    }),
  ungroup: (exerciseId) =>
    set((s) => ({
      exercises: normalizeSupersets(
        s.exercises.map((e) => (e.exercise.id === exerciseId ? { ...e, supersetGroup: null } : e))
      ),
    })),
  linkExerciseInto: (draggedId, targetId) =>
    set((s) => {
      if (draggedId === targetId) return s;
      const target = s.exercises.find((e) => e.exercise.id === targetId);
      const dragged = s.exercises.find((e) => e.exercise.id === draggedId);
      if (!target || !dragged) return s;
      // Join the target's existing superset if it has one, else start a new group.
      const group = target.supersetGroup ?? `sg-${Math.random().toString(36).slice(2, 8)}`;
      const without = s.exercises.filter((e) => e.exercise.id !== draggedId);
      const ti = without.findIndex((e) => e.exercise.id === targetId);
      const next = without.map((e) => (e.exercise.id === targetId ? { ...e, supersetGroup: group } : e));
      next.splice(ti + 1, 0, { ...dragged, supersetGroup: group });
      return { exercises: normalizeSupersets(next) };
    }),
  save: () => {
    const { editingId, name, description, label, variants, exercises } = get();
    if (!name.trim() || exercises.length === 0) return null;
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      label: label.trim() || null,
      variants,
      exercises: exercises.map((e, i) => ({
        exerciseId: e.exercise.id,
        defaultSets: e.defaultSets,
        defaultReps: e.defaultReps,
        defaultWeightKg: e.defaultWeightKg ?? undefined,
        restSeconds: e.restSeconds,
        order: i,
        supersetGroup: e.supersetGroup ?? null,
        attachment: e.attachment ?? null,
        variant: e.variant ?? null,
      })),
    };
    let id: string;
    if (editingId) { workoutRepo.updateTemplate(editingId, input); id = editingId; }
    else { id = workoutRepo.saveTemplate(input); }
    set({ editingId: null, name: '', description: '', label: '', exercises: [], variants: [], activeVariant: null, pendingSuperset: null });
    return id;
  },
}));
