import { create } from 'zustand';
import { TOUR_STEPS } from '@/lib/tourSteps';
import { beginTourPreview, endTourPreview } from '@/lib/tourPreview';

/**
 * Runtime-only state for the guided feature tour (no persistence). Started once
 * for brand-new users from onboarding `finish()`, and any time from Settings →
 * "Take the app tour". The `FeatureTour` overlay reads this and drives the shell
 * via `navStore`; nothing here is saved, so backgrounding mid-tour just ends it.
 *
 * On start we load temporary **sample data** so the screens look alive (only when the
 * account is empty); `endTour` removes it again — both via `lib/tourPreview`.
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
  start: () => {
    beginTourPreview(); // temporary sample data so the tour isn't a blank app
    set({ active: true, step: 0 });
  },
  next: () => {
    const { step } = get();
    if (step >= TOUR_STEPS.length - 1) { endTourPreview(); set({ active: false, step: 0 }); }
    else set({ step: step + 1 });
  },
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  stop: () => { endTourPreview(); set({ active: false, step: 0 }); },
}));
