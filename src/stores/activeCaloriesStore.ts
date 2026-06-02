import { create } from 'zustand';
import { computeActiveCaloriesToday } from '@/lib/activeCalories';
import type { ActiveCalorieSource } from '@/types';

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Caches today's active-calorie eat-back so the synchronous `resolveTargets`
 * can read it on render. `refresh` recomputes it (async watch reads) and should
 * be called on focus of the calorie surfaces and after a workout finishes.
 */
interface ActiveCaloriesState {
  day: string;
  kcal: number;
  refresh: (source: ActiveCalorieSource) => Promise<void>;
}

export const useActiveCaloriesStore = create<ActiveCaloriesState>((set) => ({
  day: todayStr(),
  kcal: 0,
  refresh: async (source) => {
    const kcal = await computeActiveCaloriesToday(source);
    set({ day: todayStr(), kcal });
  },
}));

/** Today's cached eat-back kcal (0 if stale/not yet computed). For non-reactive reads. */
export function activeCaloriesToday(): number {
  const { day, kcal } = useActiveCaloriesStore.getState();
  return day === todayStr() ? kcal : 0;
}
