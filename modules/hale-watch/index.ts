import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Native WatchConnectivity bridge for the Hale Apple Watch app. `null` when the native
 * module isn't present (Expo Go / Android) — callers must guard. The orchestration (building
 * the workout snapshot, applying incoming watch commands to the session) lives in
 * `src/lib/watch.ts`. The phone module is a thin relay: it pushes a JSON snapshot to the
 * watch (`updateState`) and forwards every `[String: Any]` message the watch sends back
 * through the `onMessage` event.
 */
export interface WatchMessage {
  type: string;
  [key: string]: unknown;
}

export interface HaleWatchModule {
  /** True when WatchConnectivity is available on this device (a watch may still be unpaired). */
  isSupported(): boolean;
  /** True when the paired watch app is reachable right now (foreground + in range). */
  isReachable(): boolean;
  /** Push the latest workout snapshot (JSON string) to the watch. */
  updateState(json: string): void;
  addListener(
    event: 'onMessage',
    listener: (msg: WatchMessage) => void
  ): { remove: () => void };
}

export default requireOptionalNativeModule<HaleWatchModule>('HaleWatch');
