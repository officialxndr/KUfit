/**
 * Pure milestone math for the weight-progress card. Everything here is
 * **unit-agnostic**: pass weights and the weekly rate in the *same* unit (the
 * card passes display units — lb or kg — so the milestone `value`s come out as
 * the round numbers the user sees). Because positions and ETAs are ratios /
 * linear extrapolations, the unit cancels out.
 *
 * The bar runs start (left) → goal (right); `fraction` is 0 at start, 1 at goal.
 */

const DAY_MS = 86_400_000;

export type MilestoneDirection = 'lose' | 'gain';

export interface MilestoneMarker {
  /** Milestone weight in the unit passed in (a round multiple of `step`, or the goal). */
  value: number;
  /** Position along the bar, 0 (start) … 1 (goal), clamped. */
  fraction: number;
  /** Whether the current weight has already passed this milestone. */
  reached: boolean;
  isGoal: boolean;
  /** Projected calendar date, or null when un-projectable (no/zero/wrong-way trend, or already reached). */
  etaDate: Date | null;
  /** Weeks until `etaDate` (un-rounded), or null. */
  weeksAway: number | null;
}

export interface MilestoneResult {
  direction: MilestoneDirection;
  /** Fraction of the start→goal distance already covered, 0…1. */
  progress: number;
  reachedGoal: boolean;
  /** Round milestone ticks between start and goal, then the goal itself (last). */
  markers: MilestoneMarker[];
}

export interface MilestoneArgs {
  start: number;
  current: number;
  goal: number;
  /** Signed weekly change in the same unit (negative = losing). null/0 ⇒ no projection. */
  weeklyRate: number | null;
  /** Milestone spacing (> 0). */
  step: number;
  now?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export function computeMilestones({
  start,
  current,
  goal,
  weeklyRate,
  step,
  now = Date.now(),
}: MilestoneArgs): MilestoneResult {
  const direction: MilestoneDirection = goal <= start ? 'lose' : 'gain';
  const span = start - goal; // signed: lose > 0, gain < 0
  const position = (w: number) => (span === 0 ? 1 : (start - w) / span);
  const progress = clamp01(position(current));
  const reachedGoal = direction === 'lose' ? current <= goal : current >= goal;
  const isReached = (w: number) => (direction === 'lose' ? current <= w : current >= w);

  // Projected date to *reach* weight `w` from `current` at `weeklyRate`. Only
  // meaningful for a future point we're trending toward (weeks > 0).
  const etaFor = (w: number): { etaDate: Date | null; weeksAway: number | null } => {
    if (weeklyRate == null || weeklyRate === 0) return { etaDate: null, weeksAway: null };
    const weeks = (w - current) / weeklyRate;
    if (!Number.isFinite(weeks) || weeks <= 0) return { etaDate: null, weeksAway: null };
    return { etaDate: new Date(now + weeks * 7 * DAY_MS), weeksAway: weeks };
  };

  const markers: MilestoneMarker[] = [];

  if (step > 0 && span !== 0) {
    const lo = Math.min(start, goal);
    const hi = Math.max(start, goal);
    // Round multiples of `step` strictly inside (lo, hi).
    const first = Math.ceil((lo + 1e-9) / step) * step;
    const inner: number[] = [];
    for (let m = first; m < hi - 1e-9; m += step) inner.push(round1(m));
    // Order start → goal so the list reads as the journey top-to-bottom.
    if (direction === 'lose') inner.reverse();
    for (const value of inner) {
      const { etaDate, weeksAway } = etaFor(value);
      markers.push({
        value,
        fraction: clamp01(position(value)),
        reached: isReached(value),
        isGoal: false,
        etaDate,
        weeksAway,
      });
    }
  }

  // The goal is always the final marker.
  const goalEta = etaFor(goal);
  markers.push({
    value: round1(goal),
    fraction: 1,
    reached: reachedGoal,
    isGoal: true,
    etaDate: goalEta.etaDate,
    weeksAway: goalEta.weeksAway,
  });

  return { direction, progress, reachedGoal, markers };
}
