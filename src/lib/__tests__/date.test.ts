import { describe, it, expect } from '@jest/globals';
import { isoLocalDay, parseLocalDay, addDays, leadingBlanks, weekdayLabels } from '@/lib/date';

describe('local calendar days', () => {
  it('formats a Date as its LOCAL day (not UTC)', () => {
    // 23:30 and 00:05 local on Mar 4 must both stay Mar 4, whatever the machine's timezone.
    expect(isoLocalDay(new Date(2026, 2, 4, 23, 30))).toBe('2026-03-04');
    expect(isoLocalDay(new Date(2026, 2, 4, 0, 5))).toBe('2026-03-04');
  });

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDay('2026-07-09');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 6, 9, 0]);
  });

  it('adds days across month/year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('locale-aware week start', () => {
  it('rotates the weekday headers', () => {
    expect(weekdayLabels(0)).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
    expect(weekdayLabels(1)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  });

  it('offsets day 1 correctly for Sunday- and Monday-first weeks', () => {
    // Nov 1, 2026 is a Sunday.
    expect(leadingBlanks(2026, 10, 0)).toBe(0);
    expect(leadingBlanks(2026, 10, 1)).toBe(6);
    // Jan 1, 2026 is a Thursday.
    expect(leadingBlanks(2026, 0, 0)).toBe(4);
    expect(leadingBlanks(2026, 0, 1)).toBe(3);
  });
});
