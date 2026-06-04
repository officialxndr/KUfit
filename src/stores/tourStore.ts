import { create } from 'zustand';
import { tourStepsFor, type ResolvedTourStep, type TourTier } from '@/lib/tourSteps';
import { beginTourPreview, endTourPreview } from '@/lib/tourPreview';

/**
 * Runtime-only state for the guided feature tour (no persistence). The chooser
 * (`menuOpen`, driven by `TourMenu`) lets the user pick a **Basic** or **Advanced**
 * tour, or replay a single page; `begin` resolves the step list for that choice and
 * runs it. Opened from onboarding `finish()` and Settings → "Take the app tour". The
 * `FeatureTour` overlay reads `steps`/`step` and drives the shell via `navStore`.
 *
 * On `begin` we load temporary **sample data** so screens look alive (only when the
 * account is empty); ending the tour removes it — both via `lib/tourPreview`.
 */
interface TourState {
  active: boolean;
  step: number;
  steps: ResolvedTourStep[];
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  /** Resolve + start a run from a tier (and optional single page). */
  startTour: (tier: TourTier, pageKey?: string) => void;
  next: () => void;
  back: () => void;
  stop: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  step: 0,
  steps: [],
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
  startTour: (tier, pageKey) => {
    const steps = tourStepsFor(tier, pageKey);
    if (steps.length === 0) return;
    beginTourPreview(); // temporary sample data so the tour isn't a blank app
    set({ active: true, step: 0, steps, menuOpen: false });
  },
  next: () => {
    const { step, steps } = get();
    if (step >= steps.length - 1) { endTourPreview(); set({ active: false, step: 0, steps: [] }); }
    else set({ step: step + 1 });
  },
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  stop: () => { endTourPreview(); set({ active: false, step: 0, steps: [] }); },
}));
