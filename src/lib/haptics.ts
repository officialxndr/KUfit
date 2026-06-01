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
