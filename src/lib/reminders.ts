import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  REMINDER_KEYS, REMINDER_META, EVERY_DAY,
  type FoodReminder, type IntervalReminder, type IntervalUnit,
  type ReminderConfig, type ReminderKey, type ScheduleReminder,
} from '@/stores/remindersStore';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';

/**
 * Local notification orchestration for the reminders system. All on-device —
 * schedules local notifications via `expo-notifications`. Needs a dev build +
 * runtime permission (no remote push / server involved).
 *
 * The store (`remindersStore`) is the source of truth; call
 * `syncScheduledNotifications(reminders)` after any change, on app start, and
 * after logging food (so a "smart" food reminder cancels itself) — it cancels
 * everything and reschedules from scratch, so the OS schedule always reflects
 * the current settings.
 *
 * Per mode:
 *  - `schedule` (weight/workout): repeating DAILY (all 7 weekdays) or WEEKLY-per-day triggers.
 *  - `interval` (measurements): a one-shot DATE trigger at the next occurrence (anchored to the
 *    last measurement, or the cadence start), re-armed on the next sync.
 *  - `food`: one-shot DATE triggers for today's remaining times (only if nothing's logged yet) +
 *    tomorrow's times; re-synced after a food log so it stops nagging once you've eaten.
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

const channelId = () => (Platform.OS === 'android' ? ANDROID_CHANNEL : undefined);
const localISO = (d: Date) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local
/** A local Date at the given time on an ISO (YYYY-MM-DD) day. */
const atTime = (iso: string, hour: number, minute: number) =>
  new Date(`${iso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);

/** Advance a date by one interval (calendar math for months/years). */
function addInterval(d: Date, every: number, unit: IntervalUnit): Date {
  const r = new Date(d);
  if (unit === 'days') r.setDate(r.getDate() + every);
  else if (unit === 'weeks') r.setDate(r.getDate() + every * 7);
  else if (unit === 'months') r.setMonth(r.getMonth() + every);
  else r.setFullYear(r.getFullYear() + every);
  return r;
}

/** The first occurrence strictly after `after`, stepping from `anchor` by the interval. */
function nextOccurrence(anchor: Date, every: number, unit: IntervalUnit, after: Date): Date {
  let d = addInterval(anchor, Math.max(1, every), unit);
  for (let guard = 0; d <= after && guard < 5000; guard++) d = addInterval(d, Math.max(1, every), unit);
  return d;
}

type Sched = { content: Notifications.NotificationContentInput; trigger: Notifications.NotificationTriggerInput };

/** Build the notification(s) for one reminder based on its mode. `now` is the reference time. */
function schedulesFor(key: ReminderKey, cfg: ReminderConfig, now: Date): Sched[] {
  const content = { title: REMINDER_META[key].title, body: REMINDER_META[key].body, data: { reminderKey: key } };
  const cid = channelId();

  if (cfg.mode === 'schedule') {
    const s = cfg as ScheduleReminder;
    const days = s.weekdays.length ? s.weekdays : EVERY_DAY;
    if (days.length >= 7) {
      return [{ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: s.hour, minute: s.minute, channelId: cid } }];
    }
    // Expo weekdays are 1–7 (Sunday = 1); the store uses 0–6 (Sunday = 0).
    return days.map((d) => ({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: (d % 7) + 1, hour: s.hour, minute: s.minute, channelId: cid },
    }));
  }

  if (cfg.mode === 'interval') {
    const i = cfg as IntervalReminder;
    // Anchor to the last measurement (so it counts from when you actually measured), else the
    // cadence start, else today. One-shot DATE trigger re-armed on the next sync.
    const lastMeasured = (() => { try { return healthRepo.getMeasurements()[0]?.date ?? null; } catch { return null; } })();
    const anchor = atTime(lastMeasured || i.anchorDate || localISO(now), i.hour, i.minute);
    return [{ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextOccurrence(anchor, i.every, i.unit, now), channelId: cid } }];
  }

  // food — smart: skip today's times once something's been logged; always seed tomorrow's.
  const f = cfg as FoodReminder;
  const today = localISO(now);
  const loggedToday = (() => { try { return foodRepo.getDayTotals(today).calories > 0; } catch { return false; } })();
  const out: Sched[] = [];
  for (const t of f.times) {
    const todayAt = atTime(today, t.hour, t.minute);
    if (!loggedToday && todayAt.getTime() > now.getTime()) {
      out.push({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: todayAt, channelId: cid } });
    }
    const tomorrowAt = new Date(todayAt);
    tomorrowAt.setDate(tomorrowAt.getDate() + 1);
    out.push({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrowAt, channelId: cid } });
  }
  return out;
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
    const now = new Date();
    for (const key of REMINDER_KEYS) {
      const cfg = reminders[key];
      if (!cfg?.enabled) continue;
      for (const { content, trigger } of schedulesFor(key, cfg, now)) {
        await Notifications.scheduleNotificationAsync({ content, trigger });
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
