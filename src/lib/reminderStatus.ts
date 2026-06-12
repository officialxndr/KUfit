import type { IntervalUnit, ReminderConfig, ReminderKey } from '@/stores/remindersStore';
import { EVERY_DAY, REMINDER_KEYS } from '@/stores/remindersStore';

/**
 * Pure decision logic for the Dashboard reminder banner. The screen gathers the
 * lightweight context (last-logged dates, today's calories, the time of day) from
 * the repos and this picks which reminders are "due" — side-effect-free so it's
 * unit-testable. Each mode has its own notion of "due":
 *   - schedule (weight/workout): today is a scheduled weekday and the action is outstanding.
 *   - interval (measurements): it's been ≥ one interval since the last measurement.
 *   - food: nothing's been logged yet and the earliest reminder time has passed.
 * A banner is also suppressed once dismissed for the day or if the reminder is off.
 */

export interface ReminderContext {
  today: string; // YYYY-MM-DD (local)
  todayWeekday: number; // 0=Sun…6=Sat
  nowMinutes: number; // minutes since local midnight
  lastWeightDate: string | null;
  lastMeasurementDate: string | null;
  lastWorkoutDate: string | null;
  caloriesToday: number;
}

/** Banner display priority (first = most prominent). */
const PRIORITY: ReminderKey[] = ['measurements', 'weight', 'food', 'workout'];

const UNIT_DAYS: Record<IntervalUnit, number> = { days: 1, weeks: 7, months: 30.4375, years: 365.25 };
const intervalDays = (every: number, unit: IntervalUnit) => Math.max(1, every) * UNIT_DAYS[unit];

function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity;
  return Math.floor((b - a) / 86400000);
}

export function isReminderDue(cfg: ReminderConfig | undefined, key: ReminderKey, ctx: ReminderContext): boolean {
  if (!cfg?.enabled) return false;
  if (cfg.bannerDismissedFor === ctx.today) return false;

  switch (cfg.mode) {
    case 'schedule': {
      const days = cfg.weekdays.length ? cfg.weekdays : EVERY_DAY;
      if (!days.includes(ctx.todayWeekday)) return false;
      const last = key === 'workout' ? ctx.lastWorkoutDate : ctx.lastWeightDate;
      return last !== ctx.today;
    }
    case 'interval': {
      if (ctx.lastMeasurementDate === ctx.today) return false; // already measured today
      const anchor = ctx.lastMeasurementDate || cfg.anchorDate || ctx.today;
      return daysBetween(anchor, ctx.today) >= intervalDays(cfg.every, cfg.unit);
    }
    case 'food': {
      if (ctx.caloriesToday > 0) return false;
      const earliest = cfg.times.length ? Math.min(...cfg.times.map((t) => t.hour * 60 + t.minute)) : 24 * 60;
      return ctx.nowMinutes >= earliest;
    }
  }
}

export function dueReminders(reminders: Record<ReminderKey, ReminderConfig>, ctx: ReminderContext): ReminderKey[] {
  return REMINDER_KEYS.filter((key) => isReminderDue(reminders[key], key, ctx));
}

/** The single highest-priority due reminder (the Dashboard shows one at a time), or null. */
export function topDueReminder(reminders: Record<ReminderKey, ReminderConfig>, ctx: ReminderContext): ReminderKey | null {
  const due = new Set(dueReminders(reminders, ctx));
  return PRIORITY.find((k) => due.has(k)) ?? null;
}
