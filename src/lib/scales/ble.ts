import { Platform, PermissionsAndroid } from 'react-native';

/** Decode a base64 string (ble-plx characteristic value) to raw bytes. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out.push((n >> 16) & 0xff);
    if (clean[i + 2] !== undefined && clean[i + 2] !== '=') out.push((n >> 8) & 0xff);
    if (clean[i + 3] !== undefined && clean[i + 3] !== '=') out.push(n & 0xff);
  }
  return Uint8Array.from(out);
}

/** Encode raw bytes to base64 (for ble-plx writes). */
export function bytesToBase64(bytes: number[] | Uint8Array): string {
  let out = '';
  const arr = Array.from(bytes);
  for (let i = 0; i < arr.length; i += 3) {
    const a = arr[i], b = arr[i + 1], c = arr[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

/** Hex dump for the raw-packet inspector (e.g. "a5 12 d0 00 …"). */
export const bytesToHex = (bytes: Uint8Array | number[]) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');

/** Request the Android BLE runtime permissions (no-op on iOS — handled by Info.plist). */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const sdk = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const perms = sdk >= 31
    ? [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  try {
    const res = await PermissionsAndroid.requestMultiple(perms);
    return (
      res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] !== PermissionsAndroid.RESULTS.DENIED &&
      res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] !== PermissionsAndroid.RESULTS.DENIED &&
      Object.values(res).some((v) => v === PermissionsAndroid.RESULTS.GRANTED)
    );
  } catch {
    return false;
  }
}
