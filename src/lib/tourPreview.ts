import AsyncStorage from '@react-native-async-storage/async-storage';

import { db } from '@/lib/db';
import { loadDemoData, clearLoggedData, DEMO_PROFILE_KEYS } from '@/lib/demoSeed';
import { useSettingsStore } from '@/stores/settingsStore';
import type { Profile } from '@/stores/settingsStore';
import { useRefreshStore } from '@/stores/refreshStore';

/**
 * Temporary "sample data" for the guided tour. A brand-new account has empty screens,
 * which sells the app poorly, so when the tour starts on an **empty** account we load
 * the demo dataset (the same one the dev seeder uses) purely as a preview, then remove
 * it again when the tour ends — restoring the exact prior state. We **never** seed when
 * the account already has logged data, so a real account is never touched (an existing
 * user replaying the tour just sees their own data).
 *
 * A marker is persisted while the preview is live so a force-quit mid-tour is undone on
 * the next launch (`recoverTourPreview`) — the tour store itself is runtime-only.
 */

const MARKER = '@fitself/tourPreview';
// The one food `loadDemoData` inserts into the catalog (base foods are pre-seeded); used
// as the "demo data is present" signal so recovery can't wipe a real account on a stale marker.
const DEMO_FOOD_BARCODE = 'demo:whey-shake';

// Profile fields `loadDemoData` may fill in (only when unset) — captured so teardown can
// put them back exactly as they were (e.g. so a new user isn't left with a demo
// height/sex/birth date). Mirrors `DEMO_PROFILE_KEYS`.
type ProfileSnapshot = Partial<Profile>;

let seeded = false;
let snapshot: ProfileSnapshot | null = null;

function hasLoggedData(): boolean {
  for (const t of ['food_logs', 'workout_sessions', 'weight_entries', 'body_measurements']) {
    if (db.getFirstSync(`SELECT 1 FROM ${t} LIMIT 1`)) return true;
  }
  return false;
}

function demoDataPresent(): boolean {
  return !!db.getFirstSync(`SELECT 1 FROM food_items WHERE barcode = ? LIMIT 1`, [DEMO_FOOD_BARCODE]);
}

function snapProfile(): ProfileSnapshot {
  const p = useSettingsStore.getState().profile;
  const snap: Record<string, unknown> = {};
  for (const k of DEMO_PROFILE_KEYS) snap[k] = p[k] ?? null;
  return snap as ProfileSnapshot;
}

/** Remove every trace of the demo dataset (logged rows + the demo catalog food). */
function clearDemoArtifacts(): void {
  clearLoggedData();
  db.runSync(`DELETE FROM food_items WHERE barcode = ?`, [DEMO_FOOD_BARCODE]);
}

/** Seed preview data if (and only if) the account has no logged data of its own. */
export function beginTourPreview(): void {
  if (seeded || hasLoggedData()) return;
  snapshot = snapProfile();
  AsyncStorage.setItem(MARKER, JSON.stringify(snapshot)).catch(() => {});
  loadDemoData();
  seeded = true;
  useRefreshStore.getState().bump();
}

/** Remove the preview data and restore the prior profile fields. No-op if we didn't seed. */
export function endTourPreview(): void {
  if (!seeded) return;
  clearDemoArtifacts();
  if (snapshot) useSettingsStore.getState().setProfile(snapshot);
  seeded = false;
  snapshot = null;
  AsyncStorage.removeItem(MARKER).catch(() => {});
  useRefreshStore.getState().bump();
}

/** Launch-time cleanup: undo a preview that a force-quit left behind. */
export async function recoverTourPreview(): Promise<void> {
  if (seeded) return;
  try {
    const raw = await AsyncStorage.getItem(MARKER);
    if (raw == null) return;
    // Only clear if the demo data is actually there — guards against a stale marker
    // wiping a real account that has since added data.
    if (demoDataPresent()) {
      clearDemoArtifacts();
      useSettingsStore.getState().setProfile(JSON.parse(raw) as ProfileSnapshot);
      useRefreshStore.getState().bump();
    }
    await AsyncStorage.removeItem(MARKER);
  } catch {
    // Best-effort; leave the marker so a later launch can retry.
  }
}
