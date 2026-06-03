import type { ReminderConfig, ReminderKey } from '@/stores/remindersStore';
import { REMINDER_KEYS } from '@/stores/remindersStore';

/**
 * Pure decision logic for the Dashboard reminder banner. The screen gathers the
 * lightweight context (last-logged dates etc.) from the repos and this picks
 * which reminders are "due" — kept side-effect-free so it's unit-testable.
 *
 * A reminder is due when: enabled, today is one of its scheduled days, its banner
 * wasn't already dismissed today, and the underlying action is still outstanding.
 */

export interface ReminderContext {
  today: string; // YYYY-MM-DD (local)
  todayWeekday: number; // 0=Sun…6=Sat
  lastWeightDate: string | null;
  lastMeasurementDate: string | null;
  lastWorkoutDate: string | null;
  caloriesToday: number;
}

/** Banner display priority (first = most prominent). */
const PRIORITY: ReminderKey[] = ['measurements', 'weight', 'food', 'workout'];

function isScheduledToday(cfg: ReminderConfig, weekday: number): boolean {
  if (cfg.frequency === 'daily') return true;
  return cfg.weekdays.includes(weekday);
}

function isOutstanding(key: ReminderKey, ctx: ReminderContext): boolean {
  switch (key) {
    case 'weight': return ctx.lastWeightDate !== ctx.today;
    case 'measurements': return ctx.lastMeasurementDate !== ctx.today;
    case 'workout': return ctx.lastWorkoutDate !== ctx.today;
    case 'food': return ctx.caloriesToday <= 0;
  }
}

export function isReminderDue(cfg: ReminderConfig | undefined, key: ReminderKey, ctx: ReminderContext): boolean {
  if (!cfg?.enabled) return false;
  if (cfg.bannerDismissedFor === ctx.today) return false;
  if (!isScheduledToday(cfg, ctx.todayWeekday)) return false;
  return isOutstanding(key, ctx);
}

export function dueReminders(reminders: Record<ReminderKey, ReminderConfig>, ctx: ReminderContext): ReminderKey[] {
  return REMINDER_KEYS.filter((key) => isReminderDue(reminders[key], key, ctx));
}

/** The single highest-priority due reminder (the Dashboard shows one at a time), or null. */
export function topDueReminder(reminders: Record<ReminderKey, ReminderConfig>, ctx: ReminderContext): ReminderKey | null {
  const due = new Set(dueReminders(reminders, ctx));
  return PRIORITY.find((k) => due.has(k)) ?? null;
}
