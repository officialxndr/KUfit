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
  /** Rest-timer "time's up" cue — a double buzz so it's noticeable mid-set. */
  restOver: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 180);
  },
};

const impact = (s: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(s).catch(() => {});
const notify = (t: Haptics.NotificationFeedbackType) => Haptics.notificationAsync(t).catch(() => {});
const { Light, Medium, Heavy } = Haptics.ImpactFeedbackStyle;

/**
 * Candidate "rest is over" haptic patterns — surfaced in the hidden dev tools so we can feel
 * each on a real device and pick the best one. `haptic.restOver` above is the one workouts use.
 */
export const REST_END_HAPTICS: { key: string; label: string; play: () => void }[] = [
  {
    key: 'double',
    label: 'Double buzz (current)',
    play: () => {
      notify(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => impact(Heavy), 180);
    },
  },
  {
    key: 'triple',
    label: 'Triple pulse',
    play: () => {
      impact(Medium);
      setTimeout(() => impact(Medium), 130);
      setTimeout(() => impact(Medium), 260);
    },
  },
  {
    key: 'ramp',
    label: 'Ramp up (light → heavy)',
    play: () => {
      impact(Light);
      setTimeout(() => impact(Medium), 120);
      setTimeout(() => impact(Heavy), 260);
    },
  },
  {
    key: 'warning',
    label: 'Warning + heavy',
    play: () => {
      notify(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => impact(Heavy), 220);
    },
  },
];
