import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ActiveCalorieSource, ActivityLevel, GoalMode, GoalType, MacroTargetMode, Sex, UnitSystem,
} from '@/types';
import type { RestEndHaptic } from '@/lib/haptics';

/** Which engine reads nutrition labels.
 *  'off'    = built-in on-device OCR (no AI).
 *  'device' = on-device Gemma vision model (private, offline).
 *  Future:  'gemini' (cloud API key) | 'server' (self-hosted OpenAI-compatible endpoint).
 *  Adding a provider = a new value here + a case in `scanLabel` (lib/nutritionVision). */
export type AiProvider = 'off' | 'device';

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
  /** Whether the goal is driven by a scale weight or a target body-fat %. In 'bodyfat'
   *  mode `goalWeightKg` is derived (kept fresh from current lean mass) and read-only. */
  goalMode: GoalMode;
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
  /** When false, skip the celebratory summary screen after finishing a workout. */
  showWorkoutSummary: boolean;
  /** Vibration pattern played when a rest timer finishes. */
  restEndHaptic: RestEndHaptic;
  /** Master switch for UI motion (also gated by the OS Reduce-Motion setting). */
  animationsEnabled: boolean;
  /** When false, celebration confetti is suppressed (other motion still plays). */
  confettiEnabled: boolean;
  /** When false, don't auto-estimate body fat from tape measurements (U.S. Navy
   *  formula); only a body-fat % you enter yourself (or a DEXA baseline) is shown. */
  navyBodyFatEnabled: boolean;
  /** Chosen on-device AI label-scanning model id (a `lib/llm/models` id), or null = none.
   *  The model *files* live on disk (see `lib/llm/modelManager`); this only records the pick. */
  aiModelId: string | null;
  /** Which engine reads nutrition labels (off / on-device / future API providers). */
  aiProvider: AiProvider;
  /** When true, the on-device vision model reasons before answering — more accurate on
   *  dense labels, but noticeably slower per scan. Off = fastest. */
  aiThinking: boolean;
  // Training goals (Workout section)
  weeklySessionTarget: number | null;
  // Custom secondary nutrient goals (Nutrition section)
  nutrientGoals: NutrientGoal[];
  /** Per-site body-measurement goals, keyed by site, value in cm. */
  measurementGoals: Record<string, number>;
  // ── Milestone progress card (Dashboard + Health → Weight) ──
  /** Milestone spacing: 'small' = 5 lb / 2.5 kg, 'large' = 10 lb / 5 kg. */
  milestoneInterval: 'small' | 'large';
  /** What anchors the left ("starting weight") end of the milestone bar. */
  milestoneStartBasis: 'phase' | 'earliest' | 'peak' | 'custom';
  /** User-set starting weight in kg, used only when milestoneStartBasis === 'custom'. */
  milestoneStartKg: number | null;
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
  goalMode: 'weight',
  goalDate: null,
  calorieGoal: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  macroTargetMode: 'GRAMS',
  lockedMacro: null,
  activeCalorieSource: 'off',
  showCoachingNudges: true,
  showWorkoutSummary: true,
  restEndHaptic: 'pulse',
  animationsEnabled: true,
  confettiEnabled: true,
  navyBodyFatEnabled: true,
  aiModelId: null,
  aiProvider: 'off',
  aiThinking: true,
  weeklySessionTarget: null,
  nutrientGoals: [],
  measurementGoals: {},
  milestoneInterval: 'large',
  milestoneStartBasis: 'phase',
  milestoneStartKg: null,
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
        // Migrate the old on-device AI on/off boolean to the provider enum.
        const aiLegacy = p.profile as { aiVisionEnabled?: boolean; aiProvider?: AiProvider } | undefined;
        if (aiLegacy && aiLegacy.aiProvider == null) {
          profile.aiProvider = aiLegacy.aiVisionEnabled === false ? 'off' : (profile.aiModelId ? 'device' : 'off');
        }
        return { ...current, ...p, profile };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
