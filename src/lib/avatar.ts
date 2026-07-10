/**
 * Pick a profile picture from the photo library, persist a copy into the app's document
 * directory, and return a **stable filename** (e.g. "avatar-123.jpg") — NOT an absolute URI.
 * Returns null if cancelled/denied or the native module isn't in this build.
 *
 * Why a filename, not a URI: iOS's app-container path (the prefix of the absolute file:// URI)
 * changes on app update / reinstall, so a persisted absolute path dangles even though the file
 * itself survives in Documents. `resolveAvatarUri` re-derives the live absolute URI at display
 * time. (This is exactly why the profile picture used to vanish after every update.)
 *
 * NOTE: `expo-image-picker` is a **native module** — loaded lazily so the app still launches in
 * a dev build that predates it. It activates after a native rebuild.
 */
export async function pickAvatar(): Promise<string | null> {
  try {
    const ImagePicker = require('expo-image-picker');
    const { File, Paths } = require('expo-file-system');

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return null;

    try {
      const name = `avatar-${Date.now()}.jpg`;
      const dest = new File(Paths.document, name);
      if (dest.exists) dest.delete();
      new File(res.assets[0].uri).copy(dest);
      return name; // store the filename; resolve to an absolute URI at display time
    } catch {
      return res.assets[0].uri; // fall back to the picker URI if the copy fails
    }
  } catch {
    return null; // native module unavailable in this build, or picker error
  }
}

/**
 * Resolve a stored avatar value (a filename, or a legacy absolute path) to the CURRENT absolute
 * URI, re-derived against the live document directory. Recovers legacy absolute values by their
 * basename (the file is still in Documents; only the container prefix changed). Passes remote /
 * data URIs through. Returns null when nothing usable exists.
 */
export function resolveAvatarUri(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('http') || stored.startsWith('data:')) return stored;
  try {
    const { File, Paths } = require('expo-file-system');
    const name = stored.split('/').pop() || stored; // basename — handles legacy absolute paths
    const f = new File(Paths.document, name);
    if (f.exists) return f.uri;
    return stored.startsWith('file:') ? stored : null; // last resort: the raw value if it's a file uri
  } catch {
    return stored.startsWith('file:') ? stored : null;
  }
}
