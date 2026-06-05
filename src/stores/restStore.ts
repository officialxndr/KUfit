import { create } from 'zustand';

import { setLiveActivityRest, updateLiveActivity } from '@/lib/liveActivity';
import { scheduleRestEndNotification, cancelRestEndNotification } from '@/lib/reminders';
import { useSessionStore } from '@/stores/sessionStore';
import { syncWatch } from '@/lib/watch';

/**
 * The active rest countdown, lifted out of the session screen so it has a single owner that
 * both the phone (`src/app/session.tsx`) and the Apple Watch (`src/lib/watch.ts`) can read and
 * drive. `endsAt` is a wall-clock epoch (ms), not a decrementing counter, so it stays correct
 * after the app is backgrounded (JS timers freeze; `endsAt` doesn't).
 *
 * `startRest` / `skipRest` carry the side effects that used to live in the session screen so
 * they fire no matter which device triggered the rest: feed the Live Activity countdown, push
 * a fresh watch snapshot, and (for `startRest`) schedule the locked-phone rest-end notification.
 * `resetRest` is a pure clear for teardown on finish/discard — it must NOT poke the Live
 * Activity (that would resurrect a just-ended activity).
 */
interface RestState {
  exId: string | null;
  setId: string | null;
  /** Epoch ms when this rest ends (0 = not resting). */
  endsAt: number;
  /** Total rest length in seconds (for the ring/bar fill). */
  total: number;
  startRest: (exId: string, setId: string, secs: number) => void;
  skipRest: () => void;
  resetRest: () => void;
}

export const useRestStore = create<RestState>((set) => ({
  exId: null,
  setId: null,
  endsAt: 0,
  total: 0,

  startRest: (exId, setId, secs) => {
    const endsAt = Date.now() + secs * 1000;
    set({ exId, setId, endsAt, total: secs });
    // Feed the same end time to the Live Activity so its countdown stays in sync (and keeps
    // ticking natively on the Lock Screen / Dynamic Island even while the app is backgrounded).
    setLiveActivityRest(endsAt);
    updateLiveActivity(useSessionStore.getState());
    // Background safety net: a local notification fires the buzz if the phone is locked when
    // rest ends (JS is suspended + Vibration can't fire from the background).
    scheduleRestEndNotification(secs);
    syncWatch();
  },

  skipRest: () => {
    set({ exId: null, setId: null, endsAt: 0, total: 0 });
    setLiveActivityRest(0);
    updateLiveActivity(useSessionStore.getState());
    cancelRestEndNotification();
    syncWatch();
  },

  resetRest: () => {
    set({ exId: null, setId: null, endsAt: 0, total: 0 });
    cancelRestEndNotification();
  },
}));
