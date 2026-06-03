import { useReducedMotion } from 'react-native-reanimated';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Single gate for all UI motion. Combines the OS Reduce-Motion accessibility
 * setting with the in-app "Animations" toggle (`profile.animationsEnabled`).
 *
 * - `animate` — play transitions/micro-interactions. When false, animated
 *   components should render their final state instantly.
 * - `confetti` — additionally honors the "Celebration confetti" toggle; only
 *   true when motion is on AND confetti is enabled.
 */
export function useMotion(): { animate: boolean; confetti: boolean } {
  const reduced = useReducedMotion();
  const animationsEnabled = useSettingsStore((s) => s.profile.animationsEnabled);
  const confettiEnabled = useSettingsStore((s) => s.profile.confettiEnabled);
  const animate = animationsEnabled && !reduced;
  return { animate, confetti: animate && confettiEnabled };
}
