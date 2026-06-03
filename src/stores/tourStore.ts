import { create } from 'zustand';
import { TOUR_STEPS } from '@/lib/tourSteps';

/**
 * Runtime-only state for the guided feature tour (no persistence). Started once
 * for brand-new users from onboarding `finish()`, and any time from Settings →
 * "Take the app tour". The `FeatureTour` overlay reads this and drives the shell
 * via `navStore`; nothing here is saved, so backgrounding mid-tour just ends it.
 */
interface TourState {
  active: boolean;
  step: number;
  start: () => void;
  next: () => void;
  back: () => void;
  stop: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  next: () => {
    const { step } = get();
    if (step >= TOUR_STEPS.length - 1) set({ active: false, step: 0 });
    else set({ step: step + 1 });
  },
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  stop: () => set({ active: false, step: 0 }),
}));
