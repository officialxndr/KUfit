import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Optional-donation prompt state. The app is free forever; this just decides whether
 * the gentle "Support Hale" nudge (wizard + Dashboard banner) is shown. The user is
 * always in control — "remind me later" re-prompts after ~30 days, "dismiss forever"
 * never shows it again. Donating is never required.
 */
interface DonationState {
  /** Never show the prompt again. */
  dismissed: boolean;
  /** Don't prompt again until this epoch-ms (null = eligible now). */
  remindAfter: number | null;
  /** When the user last opened the donate link, so we don't nag right after. */
  donatedAt: number | null;
  hydrated: boolean;
  /** Snooze the prompt ~30 days. */
  remindLater: () => void;
  /** Stop prompting permanently. */
  dismissForever: () => void;
  /** They opened the donate link — snooze + record it. */
  markDonated: () => void;
}

export const useDonationStore = create<DonationState>()(
  persist(
    (set) => ({
      dismissed: false,
      remindAfter: null,
      donatedAt: null,
      hydrated: false,
      remindLater: () => set({ remindAfter: Date.now() + THIRTY_DAYS }),
      dismissForever: () => set({ dismissed: true }),
      markDonated: () => set({ donatedAt: Date.now(), remindAfter: Date.now() + THIRTY_DAYS }),
    }),
    {
      name: 'fitself-donation',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ dismissed: s.dismissed, remindAfter: s.remindAfter, donatedAt: s.donatedAt }),
      onRehydrateStorage: () => (state) => { if (state) state.hydrated = true; },
    }
  )
);

/** Whether the Dashboard donation banner is currently due. */
export function shouldShowDonationPrompt(s: Pick<DonationState, 'dismissed' | 'remindAfter' | 'hydrated'>): boolean {
  if (!s.hydrated || s.dismissed) return false;
  if (s.remindAfter == null) return true;
  return Date.now() >= s.remindAfter;
}
