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
export type AiProvider = 'off' | 'device' | 'remote';

/** A saved remote AI vision endpoint — OpenAI-compatible (Ollama / LM Studio / OpenWebUI /
 *  OpenAI / OpenRouter) or Google Gemini. Each carries its own URL / key / model + nickname,
 *  so several models can be kept side by side and switched between. */
export interface AiEndpoint {
  id: string;
  name: string;
  kind: 'openai' | 'gemini';
  /** OpenAI-compatible base URL ending in /v1 (unused for gemini). */
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * A user-defined milestone on the weight-progress card: either a target **weight**
 * (→ "when will I reach it?") or a target **date/event** (→ "what will I weigh then?",
 * e.g. Thanksgiving). Weight is stored metric (kg); date is a `YYYY-MM-DD` local day.
 */
export type CustomMilestone = { id: string; label?: string } & (
  | { kind: 'weight'; weightKg: number }
  | { kind: 'date'; date: string }
);

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
  /** Which date the goal stat shows: 'projection' = ETA at current pace, 'target' = your set
   *  goalDate. Tappable to flip; defaults to showing your target date when one is set. */
  goalDateMode: 'projection' | 'target';
  calorieGoal: number | null; // manual override; null = auto from TDEE
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  macroTargetMode: MacroTargetMode;
  /** A macro pinned in the goal editor so the other two flex to fit calories. */
  lockedMacro: 'protein' | 'carbs' | 'fat' | null;
  /** Where the daily budget eats active calories back from (off by default). */
  activeCalorieSource: ActiveCalorieSource;
  /** When true, weigh-ins added to Apple Health / Health Connect are imported automatically
   *  (on every foreground + via a live observer) — no need to re-tap "Connect". Set the first
   *  time the user connects health; see `lib/healthSync.ts`. */
  healthWeightSync: boolean;
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
  /** Which body-fat source drives the Body view when both are available:
   *  'dexa' = a measured % / DEXA-baseline estimate, 'navy' = the U.S. Navy tape estimate.
   *  Only consulted when both exist; otherwise the available source is shown. */
  bodyFatSource: 'dexa' | 'navy';
  /** What anchors the non-Navy ("measured/estimate") body-fat source:
   *  'anyMeasured' = any logged body-fat % (default), 'dexaOnly' = strictly DEXA scans, so
   *  a scale/manually-typed % never pollutes the estimate. See `lib/bodyFatResolve.ts`. */
  bodyFatEstimateBasis: 'anyMeasured' | 'dexaOnly';
  /** When true, import body-fat % from Apple Health / Health Connect alongside weight
   *  (off by default — many body scales write inaccurate values). See `lib/healthSync.ts`. */
  healthBodyFatImport: boolean;
  /** Chosen on-device AI label-scanning model id (a `lib/llm/models` id), or null = none.
   *  The model *files* live on disk (see `lib/llm/modelManager`); this only records the pick. */
  aiModelId: string | null;
  /** Which engine reads nutrition labels (off / on-device / future API providers). */
  aiProvider: AiProvider;
  /** When true, the on-device vision model reasons before answering — more accurate on
   *  dense labels, but noticeably slower per scan. Off = fastest. */
  aiThinking: boolean;
  /** Saved remote AI endpoints (used when aiProvider === 'remote') + which is active. */
  aiEndpoints: AiEndpoint[];
  aiActiveEndpointId: string | null;
  /** User explicitly allowed photos to be sent to their remote AI endpoint (Apple 5.1.2(i)). */
  aiRemoteConsent: boolean;
  // Training goals (Workout section)
  weeklySessionTarget: number | null;
  // Custom secondary nutrient goals (Nutrition section)
  nutrientGoals: NutrientGoal[];
  /** Optional daily water-intake tracker (Food → Today card). Off by default so it stays out of the way. */
  trackWater: boolean;
  /** Daily water goal in **ml** (stored metric; shown in ml or fl oz per `unitSystem`). */
  waterGoalMl: number;
  /** Per-site body-measurement goals, keyed by site, value in cm. */
  measurementGoals: Record<string, number>;
  /** Wrist circumference (cm) — the frame anchor for ideal-proportion targets (config, not a tracked site). */
  wristCm: number | null;
  /** Optional ankle circumference (cm) — refines calf/thigh proportion targets (Reeves anchor). */
  ankleCm: number | null;
  // ── Milestone progress card (Dashboard + Health → Weight) ──
  /** Milestone spacing: 'small' = 5 lb / 2.5 kg, 'large' = 10 lb / 5 kg. */
  milestoneInterval: 'small' | 'large';
  /** What anchors the left ("starting weight") end of the milestone bar. */
  milestoneStartBasis: 'phase' | 'earliest' | 'peak' | 'custom';
  /** User-set starting weight in kg, used only when milestoneStartBasis === 'custom'. */
  milestoneStartKg: number | null;
  /** Milestone timeline basis: 'current' = projected dates at your current pace; 'goaldate' = the dates
   *  you'd need to hit each milestone to reach your goal by your goal date (required pace). */
  milestoneRateMode: 'current' | 'goaldate';
  /** User-defined milestones (target weights and target dates/events) shown on the weight-progress card. */
  customMilestones: CustomMilestone[];
  // ── Adaptive (data-driven) calorie basis ──
  /** What the daily calorie target is based on: 'formula' = Mifflin-St Jeor TDEE (default);
   *  'adaptive' = your empirically-calculated maintenance (from intake vs. weight change) as the base,
   *  with your goal deficit/surplus applied on top. Falls back to the formula when the cache is thin/stale. */
  calorieBasis: 'formula' | 'adaptive';
  /** Cached empirical maintenance (kcal/day) over the trailing window; recomputed on app foreground.
   *  null when there isn't enough consistent logging to trust it. Written by recomputeAdaptiveMaintenance. */
  adaptiveMaintenanceKcal: number | null;
  /** Local day (YYYY-MM-DD) the cache was last recomputed — used for the resolver's staleness guard. */
  adaptiveMaintenanceUpdatedAt: string | null;
  /** How many full-logging days backed the cached number (confidence/coverage display). */
  adaptiveMaintenanceLoggedDays: number | null;
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
  goalDateMode: 'target',
  calorieGoal: null,
  proteinTarget: null,
  carbsTarget: null,
  fatTarget: null,
  macroTargetMode: 'GRAMS',
  lockedMacro: null,
  activeCalorieSource: 'off',
  healthWeightSync: false,
  showCoachingNudges: true,
  showWorkoutSummary: true,
  restEndHaptic: 'pulse',
  animationsEnabled: true,
  confettiEnabled: true,
  navyBodyFatEnabled: true,
  bodyFatSource: 'dexa',
  bodyFatEstimateBasis: 'anyMeasured',
  healthBodyFatImport: false,
  aiModelId: null,
  aiProvider: 'off',
  aiThinking: true,
  aiEndpoints: [],
  aiActiveEndpointId: null,
  aiRemoteConsent: false,
  weeklySessionTarget: null,
  nutrientGoals: [],
  trackWater: false,
  waterGoalMl: 2000,
  measurementGoals: {},
  wristCm: null,
  ankleCm: null,
  milestoneInterval: 'large',
  milestoneStartBasis: 'phase',
  milestoneStartKg: null,
  milestoneRateMode: 'current',
  customMilestones: [],
  calorieBasis: 'formula',
  adaptiveMaintenanceKcal: null,
  adaptiveMaintenanceUpdatedAt: null,
  adaptiveMaintenanceLoggedDays: null,
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
      // API keys never go into AsyncStorage (plain text) — they live in the Keychain via
      // SecureStore (see `loadEndpointKeys` / the subscriber below) and are re-attached in memory.
      partialize: (s) => ({ profile: stripEndpointKeys(s.profile), onboarded: s.onboarded }),
      // Backfill any profile fields added after a user's data was persisted.
      merge: (persisted, current) => {
        const p = (persisted as { profile?: Partial<Profile>; onboarded?: boolean }) ?? {};
        const profile = { ...DEFAULT_PROFILE, ...(p.profile ?? {}) };
        // Migrate the old boolean eat-back flag to the new source enum.
        const legacy = p.profile as { countActiveCalories?: boolean } | undefined;
        if (legacy?.countActiveCalories && (p.profile as Partial<Profile>)?.activeCalorieSource == null) {
          profile.activeCalorieSource = 'inapp';
        }
        // Auto-import of Health weigh-ins is new: enable it for users who already connected
        // Health for active-calorie data (auto/watch imply the permission was granted), so
        // they don't have to reconnect. Everyone else opts in by connecting.
        if ((p.profile as Partial<Profile>)?.healthWeightSync == null) {
          profile.healthWeightSync = profile.activeCalorieSource === 'auto' || profile.activeCalorieSource === 'watch';
        }
        // Migrate the old on-device AI on/off boolean to the provider enum.
        const aiLegacy = p.profile as { aiVisionEnabled?: boolean; aiProvider?: string } | undefined;
        if (aiLegacy && aiLegacy.aiProvider == null) {
          profile.aiProvider = aiLegacy.aiVisionEnabled === false ? 'off' : (profile.aiModelId ? 'device' : 'off');
        }
        // Migrate the earlier single remote endpoint (provider 'openai'/'gemini' + flat
        // aiBaseUrl/aiApiKey/aiApiModel) into the named-endpoints list.
        const remoteLegacy = p.profile as { aiProvider?: string; aiBaseUrl?: string; aiApiKey?: string; aiApiModel?: string } | undefined;
        if (remoteLegacy && (remoteLegacy.aiProvider === 'openai' || remoteLegacy.aiProvider === 'gemini') && profile.aiEndpoints.length === 0) {
          profile.aiEndpoints = [{
            id: 'migrated', name: remoteLegacy.aiProvider === 'gemini' ? 'Gemini' : 'My endpoint',
            kind: remoteLegacy.aiProvider as 'openai' | 'gemini', baseUrl: remoteLegacy.aiBaseUrl ?? '', apiKey: remoteLegacy.aiApiKey ?? '', model: remoteLegacy.aiApiModel ?? '',
          }];
          profile.aiActiveEndpointId = 'migrated';
          profile.aiProvider = 'remote';
        }
        // Coerce any now-invalid persisted provider value.
        if (!['off', 'device', 'remote'].includes(profile.aiProvider)) profile.aiProvider = 'off';
        return { ...current, ...p, profile };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
        // After hydration, pull the keys back out of the Keychain (and migrate any legacy
        // plain-text keys into it). Deferred so the store is fully assigned first.
        setTimeout(() => { loadEndpointKeys().catch(() => {}); }, 0);
      },
    }
  )
);

// ── AI endpoint API keys → Keychain (expo-secure-store) ─────────────────────────────────
// The profile keeps `apiKey` in memory so every consumer works unchanged, but the persisted
// copy (AsyncStorage), backup exports and Hale Hub sync snapshots all get it stripped.

const KEY_PREFIX = 'hale.aiKey.';
const keyName = (id: string) => KEY_PREFIX + id.replace(/[^A-Za-z0-9._-]/g, '_');

/** Lazily load SecureStore so a build/platform without it (web, Expo Go quirks) degrades to
 *  "keys don't persist" rather than crashing. */
async function secureStore(): Promise<typeof import('expo-secure-store') | null> {
  try {
    const m = await import('expo-secure-store');
    return (await m.isAvailableAsync()) ? m : null;
  } catch {
    return null;
  }
}

/** A copy of the profile with every endpoint's API key blanked — safe to persist, export or sync. */
export function stripEndpointKeys(profile: Profile): Profile {
  if (!profile.aiEndpoints?.some((e) => e.apiKey)) return profile;
  return { ...profile, aiEndpoints: profile.aiEndpoints.map((e) => ({ ...e, apiKey: '' })) };
}

// Ids whose keys we last wrote, so removed endpoints get their Keychain item deleted.
let knownKeyIds = new Set<string>();
// Don't mirror state → Keychain until the keys have been loaded once; otherwise the stripped
// (blank) keys from AsyncStorage would overwrite the real ones on startup.
let keysLoaded = false;

async function writeEndpointKeys(endpoints: AiEndpoint[]): Promise<void> {
  const ss = await secureStore();
  if (!ss) return;
  const next = new Set<string>();
  for (const e of endpoints) {
    next.add(e.id);
    try {
      if (e.apiKey) await ss.setItemAsync(keyName(e.id), e.apiKey);
      else await ss.deleteItemAsync(keyName(e.id));
    } catch {}
  }
  for (const id of knownKeyIds) {
    if (!next.has(id)) { try { await ss.deleteItemAsync(keyName(id)); } catch {} }
  }
  knownKeyIds = next;
}

/** Re-attach Keychain keys to the in-memory endpoints; migrate any legacy plain-text keys in. */
async function loadEndpointKeys(): Promise<void> {
  const ss = await secureStore();
  const endpoints = useSettingsStore.getState().profile.aiEndpoints ?? [];
  if (!ss) { keysLoaded = true; return; }
  let legacy = false;
  const withKeys: AiEndpoint[] = [];
  for (const e of endpoints) {
    if (e.apiKey) {
      // Pre-Keychain install: the key was persisted in AsyncStorage. Move it.
      legacy = true;
      withKeys.push(e);
      continue;
    }
    let apiKey = '';
    try { apiKey = (await ss.getItemAsync(keyName(e.id))) ?? ''; } catch {}
    withKeys.push(apiKey ? { ...e, apiKey } : e);
  }
  knownKeyIds = new Set(endpoints.map((e) => e.id));
  keysLoaded = true;
  if (legacy) await writeEndpointKeys(withKeys);
  // Endpoints may have been edited while we were reading — only patch keys onto ids still present.
  const current = useSettingsStore.getState().profile.aiEndpoints ?? [];
  const byId = new Map(withKeys.map((e) => [e.id, e.apiKey]));
  const merged = current.map((e) => (e.apiKey ? e : { ...e, apiKey: byId.get(e.id) ?? '' }));
  useSettingsStore.setState((s) => ({ profile: { ...s.profile, aiEndpoints: merged } }));
  // ^ also re-persists the store, which strips the migrated legacy keys out of AsyncStorage.
}

useSettingsStore.subscribe((s, prev) => {
  if (!keysLoaded || s.profile.aiEndpoints === prev.profile.aiEndpoints) return;
  writeEndpointKeys(s.profile.aiEndpoints ?? []).catch(() => {});
});
