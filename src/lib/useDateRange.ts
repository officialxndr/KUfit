import { useState } from 'react';

/**
 * Shared date-window state for screens that browse a time range (Dashboard
 * Reports, Food Trends). The window `[fromIso, endIso]` is the source of truth;
 * `periodKey` is just which preset chip is highlighted. Paired with the
 * `DateRangeBar` component for the segmented presets + ‹ › paging + custom-range
 * picker + Today button.
 */
const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const addDaysIso = (iso: string, n: number) => isoDate(new Date(parse(iso).getTime() + n * DAY_MS));
const dayDiff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS);

export type PeriodKey = 'week' | 'month' | 'q' | 'year';
export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'q', label: '3 Mo', days: 90 },
  { key: 'year', label: 'Year', days: 365 },
];

export interface DateRange {
  periodKey: PeriodKey | 'custom';
  fromIso: string;
  endIso: string;
  days: number;
  isCurrent: boolean;
  todayIso: string;
  rangeLabel: string;
  /** Format a date in the window's style (adds the year when the range spans years). */
  fmt: (iso: string) => string;
  selectPeriod: (key: PeriodKey) => void;
  jumpToday: () => void;
  goBack: () => void;
  goFwd: () => void;
  /** Move the window to end on `iso`, keeping its current length. */
  jumpEnd: (iso: string) => void;
  /** Set an explicit custom range (auto-sorted, capped at today). */
  setCustom: (a: string, b: string) => void;
}

export function useDateRange(initial: PeriodKey = 'month'): DateRange {
  const todayIso = isoDate(new Date());
  const initDays = PERIODS.find((p) => p.key === initial)!.days;
  const [periodKey, setPeriodKey] = useState<PeriodKey | 'custom'>(initial);
  const [fromIso, setFromIso] = useState(() => addDaysIso(todayIso, -(initDays - 1)));
  const [endIso, setEndIso] = useState(todayIso);

  const days = dayDiff(fromIso, endIso) + 1;
  const isCurrent = endIso >= todayIso;
  const cap = (iso: string) => (iso > todayIso ? todayIso : iso);

  const selectPeriod = (key: PeriodKey) => {
    const p = PERIODS.find((x) => x.key === key)!;
    setPeriodKey(key);
    setFromIso(addDaysIso(endIso, -(p.days - 1)));
  };
  const jumpToday = () => { setEndIso(todayIso); setFromIso(addDaysIso(todayIso, -(days - 1))); };
  const goBack = () => { setFromIso(addDaysIso(fromIso, -days)); setEndIso(addDaysIso(endIso, -days)); };
  const goFwd = () => {
    const nextEnd = cap(addDaysIso(endIso, days));
    setEndIso(nextEnd); setFromIso(addDaysIso(nextEnd, -(days - 1)));
  };
  const jumpEnd = (iso: string) => { const e = cap(iso); setEndIso(e); setFromIso(addDaysIso(e, -(days - 1))); };
  const setCustom = (a: string, b: string) => {
    const x = cap(a), y = cap(b);
    setFromIso(x <= y ? x : y); setEndIso(x <= y ? y : x); setPeriodKey('custom');
  };

  const sameYear = fromIso.slice(0, 4) === endIso.slice(0, 4);
  const fmt = (iso: string) => parse(iso).toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: '2-digit' });
  const rangeLabel = `${fmt(fromIso)} – ${fmt(endIso)}`;

  return { periodKey, fromIso, endIso, days, isCurrent, todayIso, rangeLabel, fmt, selectPeriod, jumpToday, goBack, goFwd, jumpEnd, setCustom };
}
