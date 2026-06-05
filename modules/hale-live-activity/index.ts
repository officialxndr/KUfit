import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Native ActivityKit bridge for the workout Live Activity. `null` when the native module
 * isn't present (Expo Go / Android) — callers must guard. The orchestration (building the
 * content state from the active session) lives in `src/lib/liveActivity.ts`.
 */
export interface HaleLiveActivityModule {
  isSupported(): boolean;
  start(workoutName: string, state: Record<string, string | number>): void;
  update(state: Record<string, string | number>): void;
  end(): void;
}

export default requireOptionalNativeModule<HaleLiveActivityModule>('HaleLiveActivity');
