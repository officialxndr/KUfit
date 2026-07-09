/**
 * Local calendar-day helpers. Stored dates are `YYYY-MM-DD` strings (a *calendar day*, not
 * an instant), so both "what day is it" and "parse a stored day for display" must use the
 * device's LOCAL timezone — never UTC.
 *
 * Two bugs this replaces:
 *  - `new Date('2026-07-09')` parses as UTC midnight, so `.toLocaleDateString()` renders the
 *    *previous* day in negative-offset (e.g. US) zones → the off-by-one on the weight trend.
 *  - `new Date().toISOString().slice(0,10)` is the UTC day, which in the evening (US) has
 *    already rolled to *tomorrow* → an evening entry filed under the wrong date.
 */

/** Today's local calendar day as `YYYY-MM-DD`. `en-CA` formats as ISO date, in local time. */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** Parse a `YYYY-MM-DD` string as LOCAL midnight (not UTC), safe to format for display. */
export function parseLocalDay(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

/** `YYYY-MM-DD` for a Date, in local time (mirrors `todayLocal` for arbitrary dates). */
export function isoLocalDay(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

/** Add `n` days to a `YYYY-MM-DD` string, staying on local calendar days. */
export function addDays(d: string, n: number): string {
  const dt = parseLocalDay(d);
  dt.setDate(dt.getDate() + n);
  return isoLocalDay(dt);
}

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

/** Format a `YYYY-MM-DD` day for display (default "Jul 9"), parsed as local. */
export function shortDate(d: string, opts: Intl.DateTimeFormatOptions = DEFAULT_OPTS): string {
  return parseLocalDay(d).toLocaleDateString('en-US', opts);
}

/** Format a `YYYY-MM-DD` day with the year ("Jul 9, 2026"), parsed as local. */
export function longDate(d: string): string {
  return parseLocalDay(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
