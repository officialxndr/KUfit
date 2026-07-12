/**
 * Screen-orientation control, lazy + crash-safe. The app is portrait-locked everywhere (root layout)
 * except the progress-photo compare screen, which allows landscape so two photos fill the screen.
 *
 * `expo-screen-orientation` is a native module — loaded lazily and every call is guarded, so a JS-only
 * OTA landing on an older binary that predates the module simply no-ops (no rotation, but no crash)
 * until a build that includes it ships. Needs `orientation: "default"` in app.json (the iOS Info.plist
 * must allow the orientations before the runtime lock can pick between them).
 */

function mod(): any {
  try { return require('expo-screen-orientation'); } catch { return null; }
}

/** Pin to portrait (the app's default everywhere outside the photo viewer). */
export async function lockPortrait(): Promise<void> {
  const m = mod();
  if (!m) return;
  try { await m.lockAsync(m.OrientationLock.PORTRAIT_UP); } catch { /* module absent / call failed */ }
}

/** Allow the device to rotate freely (used while comparing two photos). */
export async function allowRotation(): Promise<void> {
  const m = mod();
  if (!m) return;
  try { await m.unlockAsync(); } catch { /* module absent / call failed */ }
}
