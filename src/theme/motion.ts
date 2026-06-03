/**
 * Shared motion tokens — one source of truth for animation timing so the whole
 * app feels consistent. Kept deliberately short/snappy to match the flat,
 * dark-first aesthetic (springs that settle, not bounce).
 *
 * Gate every animation on `useMotion()` (`src/lib/useMotion.ts`) so the OS
 * Reduce-Motion setting and the in-app Animations toggle are respected.
 */
import { Easing } from 'react-native-reanimated';

export const DURATION = {
  fast: 150,
  base: 220,
  slow: 320,
} as const;

export const EASE = {
  out: Easing.out(Easing.cubic),
  /** Pronounced decelerate — quick to move, long slow settle into the final value. */
  outStrong: Easing.out(Easing.poly(4)),
  inOut: Easing.inOut(Easing.cubic),
  /** Material-ish standard curve for entrances. */
  standard: Easing.bezier(0.2, 0, 0, 1),
} as const;

/** Chart/graph reveal timing — a touch slower so the ease-out settle reads. */
export const CHART = {
  bar: 420,
  line: 560,
} as const;

export const SPRING = {
  /** Snappy, low-bounce — press feedback, the nav indicator, small pops. */
  snappy: { damping: 18, stiffness: 220, mass: 0.6 },
  /** Gentler settle — larger moves. */
  gentle: { damping: 20, stiffness: 160, mass: 0.8 },
} as const;
