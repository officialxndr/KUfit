import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActivityLevel, GoalType, MacroTargetMode, Sex, UnitSystem,
} from '@/types';

/**
 * Local-first user profile. In the no-server mode this IS the source of truth
 * for the user's settings, goals and targets. Field names mirror the server's
 * UserProfile so the optional sync layer can map 1:1 later.
 */
export interface Profile {
  name: string | null;
  birthDate: string | null; // ISO date
  heightCm: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel;
  unitSystem: UnitSystem;
  goalType: GoalType;
  goalWeightKg: number | null;
  goalBodyFat: number | null;
  goalDate: string | null;
  calorieGoal: number | null; // manual override; null = auto from TDEE
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  macroTargetMode: MacroTargetMode;
  countActiveCalories: boolean;
}

const DEFAULT_PROFILE: Profile = {
  name: null,
  birthDate: null,
  heightCm: null,
  sex: null,
  activityLevel: 'MODERATE',
  unitSystem: 'IMPERIAL',
  goalType: 'MAINTAIN',
  goalWeightKg: null,
  goalBodyFat: null,
  goalDate: null,
  calorieGoal: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  macroTargetMode: 'GRAMS',
  countActiveCalories: false,
};

interface SettingsState {
  profile: Profile;
  onboarded: boolean;
  hydrated: boolean;
  setProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      onboarded: false,
      hydrated: false,
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      completeOnboarding: () => set({ onboarded: true }),
      resetProfile: () => set({ profile: DEFAULT_PROFILE, onboarded: false }),
    }),
    {
      name: 'fitself-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ profile: s.profile, onboarded: s.onboarded }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
