import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  REMINDER_KEYS, REMINDER_META, type ReminderConfig, type ReminderKey,
} from '@/stores/remindersStore';

/**
 * Local notification orchestration for the reminders system. All on-device —
 * schedules repeating local notifications via `expo-notifications`. Needs a dev
 * build + runtime permission (no remote push / server involved).
 *
 * The store (`remindersStore`) is the source of truth; call
 * `syncScheduledNotifications(reminders)` after any change and once on app start
 * so the OS schedule always reflects the user's current settings.
 */

const ANDROID_CHANNEL = 'reminders';

/** Banner/list display config — call once at app startup before scheduling. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // The rest-end notification is a background-only safety net: when it's delivered while the
      // app is foreground, the in-app vibration already fired, so suppress the banner/sound.
      if (notification.request.content.data?.restEnd) {
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Request OS notification permission; returns whether it's granted. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/** Triggers covering this reminder's frequency (one weekly trigger per weekday). */
function triggersFor(cfg: ReminderConfig): Notifications.NotificationTriggerInput[] {
  const channelId = Platform.OS === 'android' ? ANDROID_CHANNEL : undefined;
  if (cfg.frequency === 'daily') {
    return [{ type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: cfg.hour, minute: cfg.minute, channelId }];
  }
  // weekly / custom — Expo weekdays are 1–7 (Sunday = 1); store uses 0–6 (Sunday = 0).
  const days = cfg.weekdays.length ? cfg.weekdays : [1];
  return days.map((d) => ({
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: (d % 7) + 1,
    hour: cfg.hour,
    minute: cfg.minute,
    channelId,
  }));
}

/**
 * Cancel all app-scheduled notifications and reschedule every enabled reminder.
 * No-ops gracefully if permission isn't granted or the native module is absent.
 */
export async function syncScheduledNotifications(reminders: Record<ReminderKey, ReminderConfig>): Promise<void> {
  try {
    const granted = await ensurePermission();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!granted) return;
    await ensureAndroidChannel();
    for (const key of REMINDER_KEYS) {
      const cfg = reminders[key];
      if (!cfg?.enabled) continue;
      const meta = REMINDER_META[key];
      for (const trigger of triggersFor(cfg)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: meta.title, body: meta.body, data: { reminderKey: key } },
          trigger,
        });
      }
    }
  } catch {
    /* notifications unavailable (e.g. Expo Go) — reminders still show as banners */
  }
}

/**
 * Dev tool: fire a one-off local notification a couple seconds out to confirm permission is
 * granted and delivery works. Returns the outcome so the UI can report it.
 */
export async function sendTestNotification(): Promise<'sent' | 'denied' | 'unavailable'> {
  try {
    const granted = await ensurePermission();
    if (!granted) return 'denied';
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hale test notification',
        body: 'Notifications are working — you can lock your screen to see it on the Lock Screen too.',
        data: { test: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL : undefined,
      },
    });
    return 'sent';
  } catch {
    return 'unavailable';
  }
}

// ── Rest-timer "time's up" notification ─────────────────────────────────────────
// Fires when a rest timer ends while the app is backgrounded/locked (JS is suspended and
// `Vibration` can't fire from the background, so the in-app buzz alone never reaches a locked
// phone). Suppressed in the foreground by the handler above. Only ever one rest is pending.

let restNotificationId: string | null = null;

/** Schedule the rest-over alert `seconds` out (cancels any previous one). No-op without permission. */
export async function scheduleRestEndNotification(seconds: number): Promise<void> {
  await cancelRestEndNotification();
  try {
    if (!(await ensurePermission())) return;
    await ensureAndroidChannel();
    restNotificationId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest’s over 💪', body: 'Back to it — your next set is ready.', sound: true, data: { restEnd: true } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL : undefined,
      },
    });
  } catch {
    restNotificationId = null;
  }
}

/** Cancel a pending rest-over notification (rest skipped / ended in-app / workout finished). */
export async function cancelRestEndNotification(): Promise<void> {
  const id = restNotificationId;
  restNotificationId = null;
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* already fired / unavailable */
  }
}
