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
  /** A template the user pinned as "next" (overrides the least-recently-done pick until it's
   *  started, which clears it). Null/absent → normal auto-rotation. */
  nextOverride?: string | null;
}

interface RoutineState {
  routines: Routine[];
  defaultRoutineId: string | null;
  addRoutine: (name: string, templateIds: string[]) => void;
  updateRoutine: (id: string, patch: { name?: string; templateIds?: string[] }) => void;
  deleteRoutine: (id: string) => void;
  setDefaultRoutine: (id: string | null) => void;
  /** Pin which template is next in a routine (null clears back to auto-rotation). */
  setNextWorkout: (routineId: string, templateId: string | null) => void;
  markDone: (routineId: string, templateId: string) => void;
}

/** The template in a routine that's "next up": a user-pinned override if valid, else the one
 *  done least recently (or never). */
export function getNextTemplateId(routine: Routine): string | null {
  if (!routine.templateIds.length) return null;
  if (routine.nextOverride && routine.templateIds.includes(routine.nextOverride)) return routine.nextOverride;
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
          routines: s.routines.map((r) => {
            if (r.id !== id) return r;
            // Drop a pinned "next" that's been edited out of the rotation, so it can't resurface later.
            const nextOverride = patch.templateIds && !patch.templateIds.includes(r.nextOverride ?? '') ? null : r.nextOverride;
            return { ...r, ...patch, name: patch.name?.trim() ?? r.name, nextOverride };
          }),
        })),
      deleteRoutine: (id) =>
        set((s) => ({
          routines: s.routines.filter((r) => r.id !== id),
          defaultRoutineId: s.defaultRoutineId === id ? null : s.defaultRoutineId,
        })),
      setDefaultRoutine: (id) => set({ defaultRoutineId: id }),
      setNextWorkout: (routineId, templateId) =>
        set((s) => ({
          routines: s.routines.map((r) => (r.id === routineId ? { ...r, nextOverride: templateId } : r)),
        })),
      markDone: (routineId, templateId) =>
        set((s) => ({
          routines: s.routines.map((r) =>
            // Stamp done + clear the pin (it's been consumed) so rotation resumes normally.
            r.id !== routineId ? r : { ...r, lastDones: { ...r.lastDones, [templateId]: Date.now() }, nextOverride: null }
          ),
        })),
    }),
    {
      name: 'fitself-routines',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
