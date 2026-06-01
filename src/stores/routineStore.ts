import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Workout routines: named rotations of templates. Auto-rotation picks whichever
 * template in the routine was done least recently. Local-only (no server model),
 * so this persists to AsyncStorage rather than the synced SQLite layer.
 */
export interface Routine {
  id: string;
  name: string;
  templateIds: string[];
  lastDones: Record<string, number>; // templateId -> epoch ms
}

interface RoutineState {
  routines: Routine[];
  defaultRoutineId: string | null;
  addRoutine: (name: string, templateIds: string[]) => void;
  updateRoutine: (id: string, patch: { name?: string; templateIds?: string[] }) => void;
  deleteRoutine: (id: string) => void;
  setDefaultRoutine: (id: string | null) => void;
  markDone: (routineId: string, templateId: string) => void;
}

/** The template in a routine that's "next up" — done least recently (or never). */
export function getNextTemplateId(routine: Routine): string | null {
  if (!routine.templateIds.length) return null;
  let nextId = routine.templateIds[0];
  let nextTime = routine.lastDones[nextId] ?? 0;
  for (const id of routine.templateIds) {
    const t = routine.lastDones[id] ?? 0;
    if (t < nextTime) {
      nextId = id;
      nextTime = t;
    }
  }
  return nextId;
}

export const useRoutineStore = create<RoutineState>()(
  persist(
    (set) => ({
      routines: [],
      defaultRoutineId: null,
      addRoutine: (name, templateIds) =>
        set((s) => {
          const id = `r${Date.now()}`;
          return {
            routines: [...s.routines, { id, name: name.trim(), templateIds, lastDones: {} }],
            // First routine becomes the default automatically.
            defaultRoutineId: s.defaultRoutineId ?? id,
          };
        }),
      updateRoutine: (id, patch) =>
        set((s) => ({
          routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch, name: patch.name?.trim() ?? r.name } : r)),
        })),
      deleteRoutine: (id) =>
        set((s) => ({
          routines: s.routines.filter((r) => r.id !== id),
          defaultRoutineId: s.defaultRoutineId === id ? null : s.defaultRoutineId,
        })),
      setDefaultRoutine: (id) => set({ defaultRoutineId: id }),
      markDone: (routineId, templateId) =>
        set((s) => ({
          routines: s.routines.map((r) =>
            r.id !== routineId ? r : { ...r, lastDones: { ...r.lastDones, [templateId]: Date.now() } }
          ),
        })),
    }),
    {
      name: 'fitself-routines',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
