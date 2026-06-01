/**
 * Pick a profile picture from the photo library, persist a copy into the app's
 * document directory (so the URI survives cache eviction), and return its URI.
 * Returns null if cancelled/denied or the native module isn't in this build.
 *
 * NOTE: `expo-image-picker` is a **native module** — it's loaded lazily inside
 * this function (not at import time) so the app still launches in a dev build
 * that predates the module. It activates after a native rebuild.
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
      const dest = new File(Paths.document, `avatar-${Date.now()}.jpg`);
      if (dest.exists) dest.delete();
      new File(res.assets[0].uri).copy(dest);
      return dest.uri;
    } catch {
      return res.assets[0].uri; // fall back to the picker URI if the copy fails
    }
  } catch {
    return null; // native module unavailable in this build, or picker error
  }
}
