import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local reminder/notification preferences. Each reminder type has its **own**
 * interface + schedule shape (a discriminated union on `mode`):
 *   - `interval` (measurements): "every N days/weeks/months/years" at a time.
 *   - `schedule` (weight, workout): chosen weekdays (all 7 = every day) at a time.
 *   - `food`: one or more times of day — only alerts if nothing's been logged that day.
 *
 * Every reminder has its own `enabled` flag and is **off by default**, so users set up
 * only the ones they want. The store is the source of truth for both the scheduled local
 * notifications (`lib/reminders.ts`) and the dismissible Dashboard banner
 * (`lib/reminderStatus.ts` + `ReminderBanner`).
 */

export type ReminderKey = 'measurements' | 'weight' | 'workout' | 'food';
export type IntervalUnit = 'days' | 'weeks' | 'months' | 'years';
export type ReminderMode = 'interval' | 'schedule' | 'food';

interface ReminderBase {
  enabled: boolean;
  /** ISO date (YYYY-MM-DD) the Dashboard banner was last dismissed. */
  bannerDismissedFor: string | null;
}

/** Measurements: "every N days/weeks/months/years" at a time of day. */
export interface IntervalReminder extends ReminderBase {
  mode: 'interval';
  every: number; // ≥ 1
  unit: IntervalUnit;
  hour: number; // 0–23
  minute: number; // 0–59
  /** ISO date the cadence counts from (reset to today when the interval changes). */
  anchorDate: string;
}

/** Weight + workout: the weekdays it fires on (all 7 = every day) at a time of day. */
export interface ScheduleReminder extends ReminderBase {
  mode: 'schedule';
  weekdays: number[]; // 0=Sun…6=Sat
  hour: number;
  minute: number;
}

/** Food: one or more daily times; smart — only alerts if nothing's been logged that day. */
export interface FoodReminder extends ReminderBase {
  mode: 'food';
  times: { hour: number; minute: number }[];
}

export type ReminderConfig = IntervalReminder | ScheduleReminder | FoodReminder;

/** A patch that's valid for any reminder mode (every field optional). */
export type ReminderPatch = Partial<Omit<IntervalReminder, 'mode'>> &
  Partial<Omit<ScheduleReminder, 'mode'>> &
  Partial<Omit<FoodReminder, 'mode'>>;

export const REMINDER_KEYS: ReminderKey[] = ['measurements', 'weight', 'workout', 'food'];

/** Which interface/schedule shape each reminder uses. */
export const REMINDER_MODE: Record<ReminderKey, ReminderMode> = {
  measurements: 'interval',
  weight: 'schedule',
  workout: 'schedule',
  food: 'food',
};

/** Static per-reminder copy + the in-app destination its banner/notification points at. */
export const REMINDER_META: Record<ReminderKey, { title: string; body: string; cta: string }> = {
  measurements: { title: 'Measure your body', body: 'Time for your body measurements.', cta: 'Measure now' },
  weight: { title: 'Log your weight', body: "Don't forget to log today's weigh-in.", cta: 'Log weight' },
  workout: { title: 'Time to train', body: 'Keep your streak going — log a workout.', cta: 'Start workout' },
  food: { title: 'Log your food', body: "You haven't logged any food yet today.", cta: 'Log food' },
};

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local

const DEFAULTS: {
  measurements: IntervalReminder;
  weight: ScheduleReminder;
  workout: ScheduleReminder;
  food: FoodReminder;
} = {
  measurements: { mode: 'interval', enabled: false, every: 4, unit: 'weeks', hour: 9, minute: 0, anchorDate: '', bannerDismissedFor: null },
  weight: { mode: 'schedule', enabled: false, weekdays: [...EVERY_DAY], hour: 8, minute: 0, bannerDismissedFor: null },
  workout: { mode: 'schedule', enabled: false, weekdays: [1, 3, 5], hour: 17, minute: 0, bannerDismissedFor: null },
  food: { mode: 'food', enabled: false, times: [{ hour: 19, minute: 0 }], bannerDismissedFor: null },
};

const cloneDefaults = (): Record<ReminderKey, ReminderConfig> => ({
  measurements: { ...DEFAULTS.measurements },
  weight: { ...DEFAULTS.weight, weekdays: [...EVERY_DAY] },
  workout: { ...DEFAULTS.workout, weekdays: [1, 3, 5] },
  food: { ...DEFAULTS.food, times: [{ hour: 19, minute: 0 }] },
});

/** Old (v0/v1) shape: a single uniform `{ enabled, frequency, weekdays, hour, minute }` per key. */
interface LegacyConfig { enabled?: boolean; weekdays?: number[]; hour?: number; minute?: number; bannerDismissedFor?: string | null }

/** Map a persisted legacy reminder onto its new per-mode shape (preserves enabled + time). */
function migrateLegacy(old: Partial<Record<ReminderKey, LegacyConfig>> | undefined): Record<ReminderKey, ReminderConfig> {
  const out = cloneDefaults();
  if (!old) return out;
  for (const key of REMINDER_KEYS) {
    const o = old[key];
    if (!o) continue;
    const base = { enabled: !!o.enabled, bannerDismissedFor: o.bannerDismissedFor ?? null };
    if (REMINDER_MODE[key] === 'interval') {
      out[key] = { ...DEFAULTS.measurements, ...base, hour: o.hour ?? 9, minute: o.minute ?? 0 };
    } else if (REMINDER_MODE[key] === 'schedule') {
      out[key] = { ...(out[key] as ScheduleReminder), ...base, weekdays: o.weekdays?.length ? o.weekdays : [...EVERY_DAY], hour: o.hour ?? 8, minute: o.minute ?? 0 };
    } else {
      out[key] = { ...DEFAULTS.food, ...base, times: [{ hour: o.hour ?? 19, minute: o.minute ?? 0 }] };
    }
  }
  return out;
}

interface RemindersState {
  reminders: Record<ReminderKey, ReminderConfig>;
  /** Whether the OS notification permission has been granted (best-effort cache). */
  permissionGranted: boolean;
  hydrated: boolean;
  setReminder: (key: ReminderKey, patch: ReminderPatch) => void;
  dismissBanner: (key: ReminderKey, isoDate: string) => void;
  setPermissionGranted: (granted: boolean) => void;
}

export const useRemindersStore = create<RemindersState>()(
  persist(
    (set) => ({
      reminders: cloneDefaults(),
      permissionGranted: false,
      hydrated: false,
      setReminder: (key, patch) =>
        set((s) => ({ reminders: { ...s.reminders, [key]: { ...s.reminders[key], ...patch } as ReminderConfig } })),
      dismissBanner: (key, isoDate) =>
        set((s) => ({ reminders: { ...s.reminders, [key]: { ...s.reminders[key], bannerDismissedFor: isoDate } } })),
      setPermissionGranted: (granted) => set({ permissionGranted: granted }),
    }),
    {
      name: 'fitself-reminders',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ reminders: s.reminders, permissionGranted: s.permissionGranted }),
      // v0/v1 → v2: convert the old uniform reminder shape to the per-mode union.
      migrate: (persisted, version) => {
        const p = (persisted as { reminders?: Partial<Record<ReminderKey, LegacyConfig>>; permissionGranted?: boolean }) ?? {};
        if (version < 2) return { ...p, reminders: migrateLegacy(p.reminders) };
        return p;
      },
      // Backfill any reminder key added after a user's data was persisted.
      merge: (persisted, current) => {
        const p = (persisted as { reminders?: Partial<Record<ReminderKey, ReminderConfig>>; permissionGranted?: boolean }) ?? {};
        const reminders = cloneDefaults();
        for (const key of REMINDER_KEYS) {
          if (p.reminders?.[key]) reminders[key] = { ...reminders[key], ...p.reminders[key] } as ReminderConfig;
        }
        return { ...current, ...p, reminders };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
