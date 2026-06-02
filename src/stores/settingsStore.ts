import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActiveCalorieSource, ActivityLevel, GoalType, MacroTargetMode, Sex, TrainingFocus, UnitSystem,
} from '@/types';

/** A user-tracked secondary nutrient goal (beyond calories/macros). */
export interface NutrientGoal {
  /** A NUTRIENT_DEFS key (e.g. "potassium") or a core key: fiber/sugar/sodium/saturatedFat. */
  key: string;
  /** Daily target in the nutrient's display unit (g for most, mg for sodium, etc.). */
  target: number;
  /** "limit" = stay under (sodium/sugar…), "goal" = reach at least (fiber/protein…). */
  direction: 'limit' | 'goal';
}

/**
 * Local-first user profile. In the no-server mode this IS the source of truth
 * for the user's settings, goals and targets. Field names mirror the server's
 * UserProfile so the optional sync layer can map 1:1 later.
 */
export interface Profile {
  name: string | null;
  avatarUri: string | null;
  birthDate: string | null; // ISO date
  heightCm: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel;
  unitSystem: UnitSystem;
  goalType: GoalType;
  goalWeightKg: number | null;
  /** Maintain buffer (± kg) around goalWeightKg; null = single target. */
  goalRangeKg: number | null;
  /** Goal weight we last offered to auto-switch to maintain for (avoids re-prompting). */
  maintainPromptedFor: number | null;
  goalBodyFat: number | null;
  goalDate: string | null;
  calorieGoal: number | null; // manual override; null = auto from TDEE
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  macroTargetMode: MacroTargetMode;
  /** A macro pinned in the goal editor so the other two flex to fit calories. */
  lockedMacro: 'protein' | 'carbs' | 'fat' | null;
  /** Where the daily budget eats active calories back from (off by default). */
  activeCalorieSource: ActiveCalorieSource;
  /** When false, hide proactive goal-coaching nudges (pace alerts, "cut calories", etc.). */
  showCoachingNudges: boolean;
  // Training goals (Workout section)
  weeklySessionTarget: number | null;
  trainingFocus: TrainingFocus | null;
  // Custom secondary nutrient goals (Nutrition section)
  nutrientGoals: NutrientGoal[];
  /** Per-site body-measurement goals, keyed by site, value in cm. */
  measurementGoals: Record<string, number>;
}

const DEFAULT_PROFILE: Profile = {
  name: null,
  avatarUri: null,
  birthDate: null,
  heightCm: null,
  sex: null,
  activityLevel: 'MODERATE',
  unitSystem: 'IMPERIAL',
  goalType: 'MAINTAIN',
  goalWeightKg: null,
  goalRangeKg: null,
  maintainPromptedFor: null,
  goalBodyFat: null,
  goalDate: null,
  calorieGoal: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  macroTargetMode: 'GRAMS',
  lockedMacro: null,
  activeCalorieSource: 'off',
  showCoachingNudges: true,
  weeklySessionTarget: null,
  trainingFocus: null,
  nutrientGoals: [],
  measurementGoals: {},
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
      // Backfill any profile fields added after a user's data was persisted.
      merge: (persisted, current) => {
        const p = (persisted as { profile?: Partial<Profile>; onboarded?: boolean }) ?? {};
        const profile = { ...DEFAULT_PROFILE, ...(p.profile ?? {}) };
        // Migrate the old boolean eat-back flag to the new source enum.
        const legacy = p.profile as { countActiveCalories?: boolean } | undefined;
        if (legacy?.countActiveCalories && (p.profile as Partial<Profile>)?.activeCalorieSource == null) {
          profile.activeCalorieSource = 'inapp';
        }
        return { ...current, ...p, profile };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
