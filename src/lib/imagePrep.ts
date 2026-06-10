import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Resize a photo to a JPEG suitable for vision models. `expo-image-manipulator` can
 * intermittently throw "image context has been lost" / "renderAsync failed" on large or
 * HEIC photos (a native-side decode/GC issue), so we retry at progressively smaller sizes
 * and, if it still fails, fall back to the original uri (best effort) rather than crashing
 * the whole scan.
 */
export async function prepareVisionImage(uri: string): Promise<string> {
  const widths = [1024, 768, 512];
  for (let i = 0; i < widths.length; i++) {
    try {
      const out = await manipulateAsync(uri, [{ resize: { width: widths[i] } }], { compress: 0.7, format: SaveFormat.JPEG });
      return out.uri;
    } catch {
      // Let the native side settle, then try a smaller decode.
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  return uri;
}
