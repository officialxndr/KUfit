import { create } from 'zustand';
import { AppState } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Optional Face ID / passcode lock for progress photos (`profile.photoLock`, off by default).
 *
 * Unlocking lasts for the app session and **re-locks whenever the app leaves the foreground**, so a
 * phone handed to someone (or left unlocked on a table) doesn't expose the photos. The unlocked flag
 * is in-memory only — never persisted. `expo-local-authentication` is native and lazily required, so
 * a build without it degrades to "unlocked" rather than locking the user out of their own photos.
 */
interface LockState { unlocked: boolean; setUnlocked: (v: boolean) => void }
const useLockStore = create<LockState>((set) => ({ unlocked: false, setUnlocked: (unlocked) => set({ unlocked }) }));

let listening = false;
function ensureRelockOnBackground() {
  if (listening) return;
  listening = true;
  // 'background' only — the Face ID sheet itself (and Control Center) briefly make the app
  // 'inactive', which must not undo the unlock that's in progress.
  AppState.addEventListener('change', (s) => { if (s === 'background') useLockStore.getState().setUnlocked(false); });
}

function authModule(): any | null {
  try { return require('expo-local-authentication'); } catch { return null; }
}

/** Whether this device can do biometric/passcode auth at all (false → the lock can't be enabled). */
export async function canUsePhotoLock(): Promise<boolean> {
  const LA = authModule();
  if (!LA) return false;
  try {
    // isEnrolledAsync covers Face ID/Touch ID; a device passcode alone also works via the fallback.
    const [hw, level] = await Promise.all([LA.hasHardwareAsync(), LA.getEnrolledLevelAsync?.()]);
    return !!hw || (level != null && level > 0);
  } catch { return false; }
}

/** Prompt Face ID (falling back to the device passcode). Resolves true on success. */
export async function authenticateForPhotos(reason = 'Unlock your progress photos'): Promise<boolean> {
  const LA = authModule();
  if (!LA) return true; // module absent in this build → never lock the user out
  try {
    const res = await LA.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancel', disableDeviceFallback: false });
    return !!res.success;
  } catch { return false; }
}

/**
 * The lock state for UI. `locked` is true only when the user enabled the lock AND hasn't unlocked
 * this session. `unlock()` prompts and flips the session flag on success.
 */
export function usePhotoLock(): { locked: boolean; unlock: () => Promise<boolean> } {
  ensureRelockOnBackground();
  const enabled = useSettingsStore((s) => s.profile.photoLock);
  const unlocked = useLockStore((s) => s.unlocked);
  const unlock = async () => {
    const ok = await authenticateForPhotos();
    if (ok) useLockStore.getState().setUnlocked(true);
    return ok;
  };
  return { locked: !!enabled && !unlocked, unlock };
}

/** Mark unlocked (e.g. right after the user authenticated to turn the lock on). */
export function markPhotosUnlocked() { useLockStore.getState().setUnlocked(true); }
