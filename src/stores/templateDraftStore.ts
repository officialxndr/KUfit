import { create } from 'zustand';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import type { Exercise } from '@/types';

export interface DraftExercise {
  exercise: Exercise;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
  restSeconds: number;
}

interface TemplateDraftState {
  name: string;
  description: string;
  exercises: DraftExercise[];
  reset: () => void;
  setName: (name: string) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  patch: (exerciseId: string, p: Partial<DraftExercise>) => void;
  save: () => string | null;
}

export const useTemplateDraftStore = create<TemplateDraftState>((set, get) => ({
  name: '',
  description: '',
  exercises: [],
  reset: () => set({ name: '', description: '', exercises: [] }),
  setName: (name) => set({ name }),
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
  patch: (exerciseId, p) =>
    set((s) => ({
      exercises: s.exercises.map((e) => (e.exercise.id === exerciseId ? { ...e, ...p } : e)),
    })),
  save: () => {
    const { name, description, exercises } = get();
    if (!name.trim() || exercises.length === 0) return null;
    const id = workoutRepo.saveTemplate({
      name: name.trim(),
      description: description.trim() || undefined,
      exercises: exercises.map((e, i) => ({
        exerciseId: e.exercise.id,
        defaultSets: e.defaultSets,
        defaultReps: e.defaultReps,
        defaultWeightKg: e.defaultWeightKg ?? undefined,
        restSeconds: e.restSeconds,
        order: i,
      })),
    });
    set({ name: '', description: '', exercises: [] });
    return id;
  },
}));
