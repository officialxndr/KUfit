import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local reminder/notification preferences. Each reminder type has its own
 * schedule (frequency + time of day) and an opt-in `enabled` flag that drives
 * both the scheduled local notification (`lib/reminders.ts`) and the dismissible
 * Dashboard banner (`lib/reminderStatus.ts` + `ReminderBanner`).
 *
 * Opt-in by default (all disabled) so nothing changes for existing users until
 * they turn a reminder on. Designed to grow: add a key to REMINDER_KEYS + a copy
 * entry and it flows through the screen, scheduler and banner.
 */

export type ReminderKey = 'measurements' | 'weight' | 'workout' | 'food';
export type ReminderFrequency = 'daily' | 'weekly' | 'custom';

export interface ReminderConfig {
  enabled: boolean;
  frequency: ReminderFrequency;
  /** Weekdays (0=Sun…6=Sat) the reminder applies to; used by weekly/custom. */
  weekdays: number[];
  hour: number; // 0–23 local
  minute: number; // 0–59 local
  /** ISO date (YYYY-MM-DD) the Dashboard banner was last dismissed. */
  bannerDismissedFor: string | null;
}

export const REMINDER_KEYS: ReminderKey[] = ['measurements', 'weight', 'workout', 'food'];

/** Static per-reminder copy + the in-app destination its banner/notification points at. */
export const REMINDER_META: Record<ReminderKey, {
  title: string;
  // Notification body.
  body: string;
  // Dashboard banner CTA label.
  cta: string;
}> = {
  measurements: { title: 'Measure your body', body: 'Time for your body measurements.', cta: 'Measure now' },
  weight: { title: 'Log your weight', body: "Don't forget to log today's weigh-in.", cta: 'Log weight' },
  workout: { title: 'Time to train', body: 'Keep your streak going — log a workout.', cta: 'Start workout' },
  food: { title: 'Log your food', body: "You haven't logged any food yet today.", cta: 'Log food' },
};

const defaultConfig = (frequency: ReminderFrequency, weekday: number, hour: number): ReminderConfig => ({
  enabled: false,
  frequency,
  weekdays: frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [weekday],
  hour,
  minute: 0,
  bannerDismissedFor: null,
});

const DEFAULT_REMINDERS: Record<ReminderKey, ReminderConfig> = {
  weight: defaultConfig('daily', 1, 8), // every morning
  food: defaultConfig('daily', 1, 19), // every evening
  measurements: defaultConfig('weekly', 1, 8), // Monday morning
  workout: defaultConfig('weekly', 1, 17), // Monday late afternoon
};

interface RemindersState {
  reminders: Record<ReminderKey, ReminderConfig>;
  /** Whether the OS notification permission has been granted (best-effort cache). */
  permissionGranted: boolean;
  hydrated: boolean;
  setReminder: (key: ReminderKey, patch: Partial<ReminderConfig>) => void;
  dismissBanner: (key: ReminderKey, isoDate: string) => void;
  setPermissionGranted: (granted: boolean) => void;
}

export const useRemindersStore = create<RemindersState>()(
  persist(
    (set) => ({
      reminders: DEFAULT_REMINDERS,
      permissionGranted: false,
      hydrated: false,
      setReminder: (key, patch) =>
        set((s) => ({ reminders: { ...s.reminders, [key]: { ...s.reminders[key], ...patch } } })),
      dismissBanner: (key, isoDate) =>
        set((s) => ({ reminders: { ...s.reminders, [key]: { ...s.reminders[key], bannerDismissedFor: isoDate } } })),
      setPermissionGranted: (granted) => set({ permissionGranted: granted }),
    }),
    {
      name: 'fitself-reminders',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ reminders: s.reminders, permissionGranted: s.permissionGranted }),
      // Backfill any reminder key added after a user's data was persisted.
      merge: (persisted, current) => {
        const p = (persisted as { reminders?: Partial<Record<ReminderKey, ReminderConfig>>; permissionGranted?: boolean }) ?? {};
        const reminders = { ...DEFAULT_REMINDERS };
        for (const key of REMINDER_KEYS) {
          if (p.reminders?.[key]) reminders[key] = { ...reminders[key], ...p.reminders[key] };
        }
        return { ...current, ...p, reminders };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
