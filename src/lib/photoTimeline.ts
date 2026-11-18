/**
 * Progress-photo timeline logic — pure (no DB / native), so it's unit-tested. Photos are one per
 * (date, pose); dates are local `YYYY-MM-DD` calendar days, so string comparison orders them.
 */

export type Pose = 'front' | 'side' | 'back';
export const POSES: Pose[] = ['front', 'side', 'back'];
export const POSE_LABEL: Record<Pose, string> = { front: 'Front', side: 'Side', back: 'Back' };

export interface ProgressPhoto {
  id: string;
  date: string; // YYYY-MM-DD
  pose: Pose;
  fileName: string;
  createdAt: string;
}

export const isPose = (p: unknown): p is Pose => p === 'front' || p === 'side' || p === 'back';

/** One day in the gallery: its photos in pose order (front → side → back). */
export interface PhotoDay { date: string; photos: ProgressPhoto[] }

/** Group photos by day, newest day first, each day's photos in pose order. */
export function groupByDate(photos: ProgressPhoto[]): PhotoDay[] {
  const byDate = new Map<string, ProgressPhoto[]>();
  for (const p of photos) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, list]) => ({ date, photos: list.sort((a, b) => POSES.indexOf(a.pose) - POSES.indexOf(b.pose)) }));
}

/** Every photo of one pose, oldest → newest (the timelapse / compare order). */
export function timelineFor(photos: ProgressPhoto[], pose: Pose): ProgressPhoto[] {
  return photos.filter((p) => p.pose === pose).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The first and latest photo of a pose — the headline before/after. Null until there are two
 * different days to compare. With no pose given, uses the pose that has the most photos (ties →
 * front first), so the card shows the user's real routine.
 */
export function firstAndLatest(photos: ProgressPhoto[], pose?: Pose): { first: ProgressPhoto; latest: ProgressPhoto; pose: Pose } | null {
  const chosen = pose ?? mostUsedPose(photos);
  if (!chosen) return null;
  const line = timelineFor(photos, chosen);
  if (line.length < 2 || line[0].date === line[line.length - 1].date) return null;
  return { first: line[0], latest: line[line.length - 1], pose: chosen };
}

export function mostUsedPose(photos: ProgressPhoto[]): Pose | null {
  let best: Pose | null = null;
  let bestN = 0;
  for (const pose of POSES) {
    const n = photos.filter((p) => p.pose === pose).length;
    if (n > bestN) { best = pose; bestN = n; }
  }
  return best;
}

/** The pose to suggest next on a day: the first one not yet taken (front → side → back). */
export function nextPose(photosOnDay: ProgressPhoto[]): Pose {
  const taken = new Set(photosOnDay.map((p) => p.pose));
  return POSES.find((p) => !taken.has(p)) ?? 'front';
}

/**
 * The most recent photo of `pose` taken before `date` — the ghost the camera overlays so the new
 * shot lines up with the last one. Falls back to the latest of that pose on any day (incl. today,
 * e.g. retaking), else null.
 */
export function ghostFor(photos: ProgressPhoto[], pose: Pose, date: string): ProgressPhoto | null {
  const line = timelineFor(photos, pose);
  const before = line.filter((p) => p.date < date);
  return before[before.length - 1] ?? line[line.length - 1] ?? null;
}

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS; // calendar-day index (UTC math on a date-only value is DST-safe)
};

/** Whole days between two calendar dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(dayNum(b) - dayNum(a));
}

/**
 * The weigh-in to show with a photo: same day, else the closest within `maxDays` (a photo taken
 * the morning after a weigh-in still reads as that weight). Null if none is close enough.
 */
export function weightNear<T extends { date: string }>(date: string, weights: T[], maxDays = 3): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const w of weights) {
    const gap = Math.abs(daysBetween(w.date, date));
    if (gap <= maxDays && gap < bestGap) { best = w; bestGap = gap; }
  }
  return best;
}

/** Index of the timelapse frame nearest a 0..1 scrub position (clamped, never out of range). */
export function frameAt(fraction: number, count: number): number {
  if (count <= 0) return 0;
  const f = Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0;
  return Math.min(count - 1, Math.round(f * (count - 1)));
}
