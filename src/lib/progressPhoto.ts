/**
 * Progress-photo FILES (rows live in `progress_photos` via `PhotoRepo`). Same device-local model as the avatar (`lib/avatar.ts`):
 * copy the picked image into a dedicated `Documents/progress-photos/` dir and store only the
 * FILENAME on the weigh-in — the absolute URI is re-derived at display time, because iOS's app
 * container path changes on update/reinstall (a stored absolute path would dangle). Photos are
 * device-local: not synced, and not carried in the JSON backup (only the filename is).
 *
 * `expo-image-picker` / `expo-file-system` are native — loaded lazily so the app still launches in
 * a build that predates them; camera + library both need a dev/prod build (no Expo Go).
 */

import { Alert, Linking } from 'react-native';

const DIR_NAME = 'progress-photos';

function photoDir(): any {
  const { Directory, Paths } = require('expo-file-system');
  const dir = new Directory(Paths.document, DIR_NAME);
  try { if (!dir.exists) dir.create({ intermediates: true }); } catch { /* already exists */ }
  return dir;
}

/** Longest useful edge for a stored progress photo — sharp full-screen on any iPhone, ~300–500 KB. */
const MAX_WIDTH = 1440;

/**
 * Copy a captured/picked image into progress-photos (downscaled to MAX_WIDTH, JPEG) and return the
 * stored FILENAME. A full-res camera shot is 3–5 MB; three poses a week would bloat the phone fast.
 * Falls back to a straight copy if the manipulator is unavailable. Null on failure.
 */
export async function saveProgressPhoto(srcUri: string, width?: number): Promise<string | null> {
  try {
    const { File } = require('expo-file-system');
    let source = srcUri;
    try {
      const { ImageManipulator, SaveFormat } = require('expo-image-manipulator');
      let ctx = ImageManipulator.manipulate(srcUri);
      if (!width || width > MAX_WIDTH) ctx = ctx.resize({ width: MAX_WIDTH });
      const ref = await ctx.renderAsync();
      const out = await ref.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
      source = out.uri;
    } catch { /* manipulator missing in this build → keep the original */ }
    const name = `photo-${Date.now()}.jpg`;
    const dest = new File(photoDir(), name);
    if (dest.exists) dest.delete();
    await new File(source).copy(dest); // async in expo-file-system 56 — await so the file exists before we return
    return name; // store the filename; resolve to an absolute URI at display time
  } catch {
    return null;
  }
}

/** Ask for photo-library access (pointing at Settings after a hard denial). */
async function ensurePermission(source: 'camera' | 'library'): Promise<boolean> {
  const ImagePicker = require('expo-image-picker');
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.granted) return true;
  // iOS won't re-prompt once permanently denied — point the user at Settings so the tap isn't a
  // silent dead-end. `canAskAgain === false` distinguishes a hard denial from an in-prompt "Don't allow".
  if (perm.canAskAgain === false) {
    const what = source === 'camera' ? 'Camera' : 'Photos';
    Alert.alert(`${what} access needed`, `Enable ${what} access for Hale in Settings to add a progress photo.`, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
  }
  return false;
}

/** Pick an existing image from the library and save it as a progress photo. Null if cancelled. */
export async function pickProgressPhotoFromLibrary(): Promise<string | null> {
  try {
    if (!(await ensurePermission('library'))) return null;
    const ImagePicker = require('expo-image-picker');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = res.canceled ? null : res.assets?.[0];
    if (!asset?.uri) return null;
    return saveProgressPhoto(asset.uri, asset.width);
  } catch {
    return null; // native module unavailable in this build, or picker error
  }
}

/** Camera permission for the in-app progress-photo camera (expo-camera shares the OS permission). */
export async function ensureCameraPermission(): Promise<boolean> {
  try { return await ensurePermission('camera'); } catch { return false; }
}

/**
 * Resolve a stored progress-photo filename to the CURRENT absolute URI (re-derived against the live
 * Documents dir). Recovers legacy absolute values by basename; passes http/data URIs through.
 * Returns null when nothing usable exists.
 */
export function resolveProgressPhotoUri(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('http') || stored.startsWith('data:')) return stored;
  try {
    const { File } = require('expo-file-system');
    const name = stored.split('/').pop() || stored; // basename
    const f = new File(photoDir(), name);
    if (f.exists) return f.uri;
    return stored.startsWith('file:') ? stored : null;
  } catch {
    return stored.startsWith('file:') ? stored : null;
  }
}

/** Delete a progress-photo file (hygiene when a photo is removed or its weigh-in deleted). */
export function deleteProgressPhoto(stored: string | null | undefined): void {
  if (!stored) return;
  try {
    const { File } = require('expo-file-system');
    const name = stored.split('/').pop() || stored;
    const f = new File(photoDir(), name);
    if (f.exists) f.delete();
  } catch { /* ignore */ }
}

/** Remove every progress-photo file (used by the full "delete all my data" wipe). */
export function clearProgressPhotos(): void {
  try {
    const dir = photoDir();
    if (dir.exists) dir.delete(); // recursive — Directory.delete() removes contents too
  } catch { /* ignore */ }
}
