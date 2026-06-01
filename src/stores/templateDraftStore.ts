import { create } from 'zustand';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import type { Exercise, WorkoutTemplate } from '@/types';

export interface DraftExercise {
  exercise: Exercise;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
  restSeconds: number;
}

interface TemplateDraftState {
  editingId: string | null;
  name: string;
  description: string;
  label: string;
  exercises: DraftExercise[];
  reset: () => void;
  loadTemplate: (t: WorkoutTemplate) => void;
  setName: (name: string) => void;
  setLabel: (label: string) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  moveExercise: (exerciseId: string, dir: -1 | 1) => void;
  patch: (exerciseId: string, p: Partial<DraftExercise>) => void;
  save: () => string | null;
}

export const useTemplateDraftStore = create<TemplateDraftState>((set, get) => ({
  editingId: null,
  name: '',
  description: '',
  label: '',
  exercises: [],
  reset: () => set({ editingId: null, name: '', description: '', label: '', exercises: [] }),
  loadTemplate: (t) => set({
    editingId: t.id,
    name: t.name,
    description: t.description ?? '',
    label: t.label ?? '',
    exercises: t.exercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((te) => ({
        exercise: te.exercise,
        defaultSets: te.defaultSets ?? 3,
        defaultReps: te.defaultReps ?? 8,
        defaultWeightKg: te.defaultWeightKg ?? null,
        restSeconds: te.restSeconds ?? 120,
      })),
  }),
  setName: (name) => set({ name }),
  setLabel: (label) => set({ label }),
  addExercise: (exercise) =>
    set((s) =>
      s.exercises.some((e) => e.exercise.id === exercise.id)
        ? s
        : {
            exercises: [
              ...s.exercises,
              { exercise, defaultSets: 3, defaultReps: 8, defaultWeightKg: null, restSeconds: 120 },
            ],
          }
    ),
  removeExercise: (exerciseId) =>
    set((s) => ({ exercises: s.exercises.filter((e) => e.exercise.id !== exerciseId) })),
  moveExercise: (exerciseId, dir) =>
    set((s) => {
      const i = s.exercises.findIndex((e) => e.exercise.id === exerciseId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const next = [...s.exercises];
      [next[i], next[j]] = [next[j], next[i]];
      return { exercises: next };
    }),
  patch: (exerciseId, p) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.exercise.id === exerciseId ? { ...e, ...p } : e)),
    })),
  save: () => {
    const { editingId, name, description, label, exercises } = get();
    if (!name.trim() || exercises.length === 0) return null;
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      label: label.trim() || null,
      exercises: exercises.map((e, i) => ({
        exerciseId: e.exercise.id,
        defaultSets: e.defaultSets,
        defaultReps: e.defaultReps,
        defaultWeightKg: e.defaultWeightKg ?? undefined,
        restSeconds: e.restSeconds,
        order: i,
      })),
    };
    let id: string;
    if (editingId) { workoutRepo.updateTemplate(editingId, input); id = editingId; }
    else { id = workoutRepo.saveTemplate(input); }
    set({ editingId: null, name: '', description: '', label: '', exercises: [] });
    return id;
  },
}));
