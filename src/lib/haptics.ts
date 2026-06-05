import { Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin, crash-safe wrappers around expo-haptics. All calls are fire-and-forget
 * and swallow errors (e.g. unsupported devices / simulators).
 */
export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

/** Dev diagnostic: fire a haptic WITHOUT swallowing errors, so a missing/broken native module
 *  surfaces (vs. a device that's just silent). Used by the Settings → Developer haptics check. */
export function fireDiagnosticHaptic(): Promise<void> {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// ── Rest-timer "time's up" alert ────────────────────────────────────────────────
//
// The subtle Taptic (UIFeedbackGenerator) cues didn't feel like a real timer going off, so the
// rest-end alert uses the classic **vibration motor** (`Vibration`) — a ~3-second buzz pattern,
// like the Clock app's timer. Patterns are `[wait, on, wait, on, …]`; iOS uses a fixed vibration
// length (so the "on" values just need to be > 0) and honors the gaps, Android honors both.

export type RestEndHaptic = 'pulse' | 'rapid' | 'double' | 'heartbeat';
export const REST_END_DEFAULT: RestEndHaptic = 'pulse';

const REST_END_PATTERNS: Record<RestEndHaptic, number[]> = {
  // ~3s of evenly spaced buzzes.
  pulse: [0, 300, 250, 300, 250, 300, 250, 300, 250, 300],
  // Urgent, fast train.
  rapid: [0, 120, 90, 120, 90, 120, 90, 120, 90, 120, 90, 120, 90, 120, 90, 120],
  // Buzz-buzz … pause … buzz-buzz.
  double: [0, 150, 110, 150, 520, 150, 110, 150, 520, 150, 110, 150],
  // Lub-dub heartbeat rhythm.
  heartbeat: [0, 140, 150, 140, 700, 140, 150, 140, 700, 140],
};

/** Options for the rest-end vibration picker (Settings → Appearance). */
export const REST_END_HAPTICS: { key: RestEndHaptic; label: string }[] = [
  { key: 'pulse', label: 'Pulse' },
  { key: 'rapid', label: 'Rapid' },
  { key: 'double', label: 'Double' },
  { key: 'heartbeat', label: 'Heartbeat' },
];

/** Play the rest-end vibration (foreground only — iOS won't vibrate from the background). */
export function playRestEndHaptic(key: RestEndHaptic = REST_END_DEFAULT): void {
  try {
    Vibration.vibrate(REST_END_PATTERNS[key] ?? REST_END_PATTERNS[REST_END_DEFAULT]);
  } catch {
    /* unsupported (e.g. simulator) */
  }
}
