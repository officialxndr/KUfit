import { describe, it, expect } from '@jest/globals';
import {
  groupByDate, timelineFor, firstAndLatest, mostUsedPose, nextPose, ghostFor, daysBetween, weightNear, frameAt,
  isPose, type ProgressPhoto, type Pose,
} from '@/lib/photoTimeline';

let n = 0;
const ph = (date: string, pose: Pose): ProgressPhoto => ({ id: `p${++n}`, date, pose, fileName: `f${n}.jpg`, createdAt: `${date}T08:00:00Z` });

// A realistic 6-week routine: full sets most weeks, a side-only week, a skipped week.
const photos: ProgressPhoto[] = [
  ph('2026-09-06', 'front'), ph('2026-09-06', 'side'), ph('2026-09-06', 'back'),
  ph('2026-09-13', 'front'), ph('2026-09-13', 'back'),
  ph('2026-09-20', 'side'),
  // 09-27 skipped
  ph('2026-10-04', 'back'), ph('2026-10-04', 'front'), ph('2026-10-04', 'side'),
  ph('2026-10-11', 'front'),
];

describe('groupByDate', () => {
  it('groups by day, newest first, poses in front→side→back order', () => {
    const days = groupByDate(photos);
    expect(days.map((d) => d.date)).toEqual(['2026-10-11', '2026-10-04', '2026-09-20', '2026-09-13', '2026-09-06']);
    expect(days[1].photos.map((p) => p.pose)).toEqual(['front', 'side', 'back']); // inserted back, front, side
  });
  it('empty in → empty out', () => expect(groupByDate([])).toEqual([]));
});

describe('timelineFor', () => {
  it('is one pose, oldest → newest', () => {
    expect(timelineFor(photos, 'front').map((p) => p.date)).toEqual(['2026-09-06', '2026-09-13', '2026-10-04', '2026-10-11']);
    expect(timelineFor(photos, 'side').map((p) => p.date)).toEqual(['2026-09-06', '2026-09-20', '2026-10-04']);
  });
});

describe('firstAndLatest', () => {
  it('defaults to the most-used pose', () => {
    const r = firstAndLatest(photos)!;
    expect(r.pose).toBe('front');
    expect(r.first.date).toBe('2026-09-06');
    expect(r.latest.date).toBe('2026-10-11');
  });
  it('honors an explicit pose', () => {
    const r = firstAndLatest(photos, 'back')!;
    expect([r.first.date, r.latest.date]).toEqual(['2026-09-06', '2026-10-04']);
  });
  it('needs two different days', () => {
    expect(firstAndLatest([ph('2026-10-01', 'front')])).toBeNull();
    expect(firstAndLatest([])).toBeNull();
    expect(firstAndLatest(photos.filter((p) => p.date === '2026-09-06'))).toBeNull(); // one day, three poses
  });
  it('mostUsedPose ties break toward front', () => {
    expect(mostUsedPose([ph('2026-01-01', 'side'), ph('2026-01-02', 'front')])).toBe('front');
    expect(mostUsedPose([])).toBeNull();
  });
});

describe('nextPose (camera auto-advance)', () => {
  it('suggests the first pose not yet taken that day', () => {
    expect(nextPose([])).toBe('front');
    expect(nextPose([ph('2026-10-12', 'front')])).toBe('side');
    expect(nextPose([ph('2026-10-12', 'front'), ph('2026-10-12', 'side')])).toBe('back');
    expect(nextPose([ph('2026-10-12', 'side')])).toBe('front');
    expect(nextPose(photos.filter((p) => p.date === '2026-09-06'))).toBe('front'); // all taken → start over
  });
});

describe('ghostFor (camera overlay)', () => {
  it('uses the latest earlier photo of the same pose', () => {
    expect(ghostFor(photos, 'side', '2026-10-18')?.date).toBe('2026-10-04');
    expect(ghostFor(photos, 'front', '2026-10-04')?.date).toBe('2026-09-13'); // strictly before the shoot day
  });
  it('falls back to the latest of that pose (a same-day retake), else null', () => {
    expect(ghostFor(photos, 'front', '2026-09-06')?.date).toBe('2026-10-11');
    expect(ghostFor([], 'front', '2026-10-01')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts calendar days, DST-safe', () => {
    expect(daysBetween('2026-09-06', '2026-10-11')).toBe(35);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1); // US DST ends Nov 1
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1); // US DST starts Mar 8
    expect(daysBetween('2026-10-11', '2026-09-06')).toBe(-35);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
  });
});

describe('weightNear', () => {
  const weights = [{ date: '2026-09-05', kg: 90 }, { date: '2026-09-13', kg: 89 }, { date: '2026-10-20', kg: 86 }];
  it('prefers the same day, else the closest within 3 days', () => {
    expect(weightNear('2026-09-13', weights)?.kg).toBe(89);
    expect(weightNear('2026-09-06', weights)?.kg).toBe(90); // weighed the day before
    expect(weightNear('2026-09-15', weights)?.kg).toBe(89);
  });
  it('returns null when nothing is close enough', () => {
    expect(weightNear('2026-10-04', weights)).toBeNull();
    expect(weightNear('2026-10-04', [])).toBeNull();
  });
});

describe('frameAt (timelapse scrubber)', () => {
  it('maps a 0..1 position to the nearest frame, clamped', () => {
    expect(frameAt(0, 5)).toBe(0);
    expect(frameAt(1, 5)).toBe(4);
    expect(frameAt(0.5, 5)).toBe(2);
    expect(frameAt(0.6, 5)).toBe(2);
    expect(frameAt(0.65, 5)).toBe(3);
    expect(frameAt(-0.3, 5)).toBe(0); // finger dragged past the left edge
    expect(frameAt(1.7, 5)).toBe(4);
    expect(frameAt(NaN, 5)).toBe(0);
    expect(frameAt(0.5, 1)).toBe(0);
    expect(frameAt(0.5, 0)).toBe(0);
  });
});

it('isPose guards stored values', () => {
  expect(isPose('front')).toBe(true);
  expect(isPose('Front')).toBe(false);
  expect(isPose(null)).toBe(false);
});
