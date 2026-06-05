import { Platform } from 'react-native';
import { ExtensionStorage } from '@bacons/apple-targets';

import { resolveTargets } from '@/lib/targets';
import { formatWeight, formatVolume, UNIT_LABELS } from '@/lib/units';
import { estimateBodyFat, navyBodyFat } from '@/lib/bodyComposition';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore, type Profile } from '@/stores/settingsStore';
import { useRoutineStore, getNextTemplateId } from '@/stores/routineStore';
import { colors, getActiveTheme, SURFACE_PRESETS } from '@/theme/tokens';

/**
 * iOS widget bridge. Three home/lock-screen widgets (Food / Workout / Health) read a small
 * JSON snapshot the app writes to the shared App Group `UserDefaults`; the widget can't read
 * SQLite. All number formatting (units, body-fat, volume) is done here so SwiftUI just renders
 * strings + a few raw numbers for the ring/bars. The current app **theme** (accent + surface
 * colors) rides along so the home widgets match the in-app appearance.
 *
 * `ExtensionStorage` is a no-op when the native module is absent (Expo Go / Android) and the
 * whole thing is wrapped — the widget is best-effort and can never break the app. Call
 * `syncWidget()` when the app backgrounds (see `_layout.tsx`) and when the theme changes.
 */
export const APP_GROUP = 'group.com.zanderhalverson.hale';
const SNAPSHOT_KEY = 'snapshot';
const DAY_MS = 86_400_000;

const storage = new ExtensionStorage(APP_GROUP);

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ── Nutrition ────────────────────────────────────────────────────────────────
function buildNutrition(profile: Profile) {
  const targets = resolveTargets(profile);
  const totals = foodRepo.getDayTotals(isoDate(new Date()));
  const calorieTarget = Math.round(targets.calorieTarget ?? 0);
  const caloriesConsumed = Math.round(totals.calories);
  return {
    caloriesLeft: calorieTarget > 0 ? calorieTarget - caloriesConsumed : 0,
    calorieTarget,
    caloriesConsumed,
    proteinConsumed: Math.round(totals.protein),
    proteinTarget: Math.round(targets.proteinTarget ?? 0),
    carbsConsumed: Math.round(totals.carbs),
    carbsTarget: Math.round(targets.carbsTarget ?? 0),
    fatConsumed: Math.round(totals.fat),
    fatTarget: Math.round(targets.fatTarget ?? 0),
  };
}

// ── Health (weight + body fat + trend) ───────────────────────────────────────
/** Current body-fat %, matching the Health → Body priority: measured → DEXA baseline → Navy tape. */
function currentBodyFat(profile: Profile): number | null {
  const latest = healthRepo.getLatestWeightEntry();
  if (!latest) return null;
  if (latest.bodyFat != null) return latest.bodyFat;

  const baseline = healthRepo.getLatestBodyFatBaseline();
  if (baseline?.bodyFat != null) return estimateBodyFat(baseline.weightKg, baseline.bodyFat, latest.weightKg);

  if (profile.navyBodyFatEnabled && profile.heightCm && (profile.sex === 'MALE' || profile.sex === 'FEMALE')) {
    const m = healthRepo.getLatestMeasurementBySite();
    if (m) {
      const bf = navyBodyFat({
        sex: profile.sex,
        heightCm: profile.heightCm,
        neckCm: m.neck ?? 0,
        waistCm: m.waist ?? 0,
        hipCm: m.hips,
      });
      if (bf != null && Number.isFinite(bf) && bf > 0) return bf;
    }
  }
  return null;
}

function buildHealth(profile: Profile) {
  const unit = profile.unitSystem;
  const latest = healthRepo.getLatestWeightEntry();
  const stats = healthRepo.computeStats(profile.goalWeightKg, profile.goalDate);

  const bf = currentBodyFat(profile);
  const bodyFatPct = bf != null ? Math.round(bf * 10) / 10 : 0;

  // Weekly trend: avg7 − avg14 (kg). Negative = trending down.
  let weightTrend = '';
  const wc = stats.weeklyChange;
  if (wc != null && Math.abs(wc) >= 0.05) {
    weightTrend = `${wc < 0 ? '↓' : '↑'} ${formatWeight(Math.abs(wc), unit)}/wk`;
  }

  // Lean / fat mass from the current weight + body-fat %.
  let leanMassDisplay = '';
  let fatMassDisplay = '';
  if (bf != null && latest) {
    const fatKg = (latest.weightKg * bf) / 100;
    leanMassDisplay = `Lean ${formatWeight(latest.weightKg - fatKg, unit)}`;
    fatMassDisplay = `Fat ${formatWeight(fatKg, unit)}`;
  }

  return {
    weightDisplay: latest ? formatWeight(latest.weightKg, unit) : '',
    bodyFatPct,
    bodyFatDisplay: bf != null ? `${bodyFatPct}% bf` : '',
    weightTrend,
    goalWeightDisplay: profile.goalWeightKg != null ? `Goal ${formatWeight(profile.goalWeightKg, unit)}` : '',
    leanMassDisplay,
    fatMassDisplay,
  };
}

// ── Workout (next + last + this week) ─────────────────────────────────────────
function buildWorkout(profile: Profile) {
  // Next up from the default routine (or the first one).
  let nextWorkout = '';
  let nextWorkoutExercises = 0;
  const { routines, defaultRoutineId } = useRoutineStore.getState();
  const routine = routines.find((r) => r.id === defaultRoutineId) ?? routines[0];
  if (routine) {
    const nextId = getNextTemplateId(routine);
    const t = nextId ? workoutRepo.getTemplates().find((x) => x.id === nextId) : null;
    if (t) {
      nextWorkout = t.name;
      nextWorkoutExercises = t.exercises.length;
    }
  }

  // Last finished workout + how long ago.
  const [last] = workoutRepo.getSessions(1);
  let lastWorkout = '';
  let lastWorkoutAgo = '';
  if (last) {
    lastWorkout = last.name;
    const days = Math.floor((Date.now() - new Date(last.startedAt).getTime()) / DAY_MS);
    lastWorkoutAgo = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
  }

  // This week (rolling 7 days): session count + total volume + sets + a per-day volume series.
  const from = isoDate(new Date(Date.now() - 6 * DAY_MS));
  const now = new Date().toISOString();
  const vols = workoutRepo.getVolumeBySession(from, now);
  const workoutsThisWeek = vols.length;
  const weeklyVolumeKg = vols.reduce((s, v) => s + (v.volume || 0), 0);
  const weeklyVolumeDisplay = weeklyVolumeKg > 0 ? formatVolume(weeklyVolumeKg, profile.unitSystem) : '';
  const weeklySets = workoutRepo.getSetCount(from, now);

  // Volume per day for the last 7 days (oldest → today), for the sparkline.
  const volByDate = new Map<string, number>();
  for (const v of vols) volByDate.set(v.date.slice(0, 10), (volByDate.get(v.date.slice(0, 10)) ?? 0) + (v.volume || 0));
  const volumeSeries: number[] = [];
  for (let i = 6; i >= 0; i--) {
    volumeSeries.push(Math.round(volByDate.get(isoDate(new Date(Date.now() - i * DAY_MS))) ?? 0));
  }

  return {
    nextWorkout, nextWorkoutExercises, lastWorkout, lastWorkoutAgo,
    workoutsThisWeek, weeklySets, weeklyVolumeDisplay, volumeSeries,
  };
}

// ── Theme (so home widgets match the in-app appearance) ───────────────────────
/** The live app theme (accent + surface colors) as flat values for native extensions.
 *  Shared by the iOS widget snapshot here and the Apple Watch snapshot (`src/lib/watch.ts`). */
export function buildTheme() {
  const { preset } = getActiveTheme();
  const dark = SURFACE_PRESETS[preset]?.dark ?? true;
  return {
    accent: colors.primary,
    bg: colors.bg,
    surface: colors.surface,
    surfaceHigh: colors.surfaceHigh,
    text: colors.text,
    muted: colors.muted,
    border: colors.border,
    track: colors.ringTrack,
    protein: colors.macroProtein,
    carbs: colors.macroCarbs,
    fat: colors.macroFat,
    dark: dark ? 1 : 0,
  };
}

/** Rebuild the snapshot and reload all iOS widgets. Safe to call anywhere; no-op off iOS. */
export function syncWidget(): void {
  if (Platform.OS !== 'ios') return;
  try {
    const { profile } = useSettingsStore.getState();
    const snapshot = {
      ...buildNutrition(profile),
      ...buildHealth(profile),
      ...buildWorkout(profile),
      unitLabel: UNIT_LABELS[profile.unitSystem].weight,
      theme: buildTheme(),
    };
    storage.set(SNAPSHOT_KEY, snapshot as unknown as Record<string, string | number>);
    ExtensionStorage.reloadWidget();
  } catch (err) {
    if (__DEV__) console.warn('[widget] sync skipped:', err);
  }
}
