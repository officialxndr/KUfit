import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';

/**
 * Renpho RF-BMF01 smart tape measure ("ES_TAPE") BLE integration.
 *
 * Protocol (reverse-engineered by the Home Assistant/ESPHome community):
 *   service     0783B03E-8535-B5A0-7140-A304D2495CB7
 *   notify char 0783B03E-8535-B5A0-7140-A304D2495CB8   (no handshake needed)
 *
 * Each notification is an ASCII frame, e.g. `*03140;00000;0000PI\n`:
 *   x[0]   = 0x2A '*'
 *   x[1..5]= circumference digits (low nibble of each ASCII byte); value/100 = cm
 *            ("03140" → 3140 → 31.40 cm). Always cm, even when the display is in inches.
 *   x[17]  = status char: LSB set ('S') = confirmed (tape button pressed), else 'P' live
 *   x[18]  = unit char: 'M' metric, 'I' imperial — DISPLAY mode only; do NOT convert by it
 */
export const TAPE_SERVICE_UUID = '0783B03E-8535-B5A0-7140-A304D2495CB7';
export const TAPE_CHAR_UUID = '0783B03E-8535-B5A0-7140-A304D2495CB8';
// The tape advertises its name as "ES-Tape" (and serviceUUIDs is null in the advert),
// so name is the only thing we can match on. Normalise so hyphen/underscore/case
// variants ("ES_TAPE", "ES-Tape", "es tape"…) all match.
const TAPE_NAME = 'ES_TAPE';
const normalizeName = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAPE_NAME_NORM = normalizeName(TAPE_NAME);

export type TapeStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';
export interface TapeReading {
  cm: number;
  /** True when the tape's confirm button was pressed (a locked-in reading). */
  confirmed: boolean;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
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

/** Parse one tape notification frame into a reading (cm, normalised from the device's unit). */
export function parseTapePacket(bytes: Uint8Array): TapeReading | null {
  if (bytes.length < 19 || bytes[0] !== 0x2a) return null;
  const nib = (b: number) => b & 0x0f;
  // 5-digit field at bytes[1..5] in hundredths of a **centimetre** (e.g. "03140" = 3140 = 31.40 cm).
  const raw =
    10000 * nib(bytes[1]) + 1000 * nib(bytes[2]) + 100 * nib(bytes[3]) + 10 * nib(bytes[4]) + nib(bytes[5]);
  // The tape always transmits in cm regardless of what its own display shows. Byte 18 ('M'/'I')
  // only reports the display's unit mode — it is NOT a hint to convert the value. (Treating 'I'
  // as "value is inches" double-converts: 31.40 cm came through and got ×2.54'd to 79.76.)
  const cm = raw / 100;
  if (!Number.isFinite(cm)) return null;
  return { cm, confirmed: (bytes[17] & 0x01) === 1 };
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const sdk = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const perms =
    sdk >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  try {
    const res = await PermissionsAndroid.requestMultiple(perms);
    // SCAN + CONNECT are the ones that actually gate BLE on 12+; location may be denied there.
    return (
      res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] !== PermissionsAndroid.RESULTS.DENIED &&
      res[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] !== PermissionsAndroid.RESULTS.DENIED &&
      Object.values(res).some((v) => v === PermissionsAndroid.RESULTS.GRANTED)
    );
  } catch {
    return false;
  }
}

/**
 * Hook driving a scan → connect → subscribe flow for the tape. Exposes connection
 * status, the latest live reading (cm), and start/stop controls.
 */
export function useRenphoTape() {
  const [status, setStatus] = useState<TapeStatus>('idle');
  const [reading, setReading] = useState<TapeReading | null>(null);
  // The ONLY hard error: phone Bluetooth is off (or permission denied). Missing-tape is not
  // an error — we just keep scanning. The view shows an instructional prompt while scanning.
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const subRef = useRef<Subscription | null>(null);
  const stateSubRef = useRef<Subscription | null>(null);
  // True while we're intentionally disconnecting (stop()/unmount) so the device's
  // onDisconnected handler doesn't mistake it for the tape powering off and auto-rescan.
  const closingRef = useRef(false);
  // Latest scan fn, so onDisconnected / state changes re-trigger it without a stale closure.
  const scanRef = useRef<() => void>(() => {});

  const teardown = useCallback(() => {
    closingRef.current = true;
    stateSubRef.current?.remove();
    stateSubRef.current = null;
    subRef.current?.remove();
    subRef.current = null;
    deviceRef.current?.cancelConnection().catch(() => {});
    deviceRef.current = null;
    managerRef.current?.stopDeviceScan();
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus('idle');
    setReading(null);
    setError(null);
  }, [teardown]);

  // Start a continuous scan and connect to the tape when it shows up. Stays scanning the
  // whole time the screen is open: on disconnect (the tape powers off when idle) it simply
  // resumes scanning, so it reconnects the moment the tape is switched back on.
  const scan = useCallback(() => {
    const manager = managerRef.current;
    if (!manager || closingRef.current || deviceRef.current) return;
    setStatus('scanning');
    manager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      // Scan errors are almost always "Bluetooth off" — the state listener handles that and
      // will restart scanning when it comes back on, so just bail here.
      if (err) return;
      if (!device) return;
      const matches =
        normalizeName(device.name) === TAPE_NAME_NORM ||
        normalizeName(device.localName) === TAPE_NAME_NORM ||
        (device.serviceUUIDs?.some((u) => u.toLowerCase() === TAPE_SERVICE_UUID.toLowerCase()) ?? false);
      if (!matches) return;

      manager.stopDeviceScan();
      setStatus('connecting');
      device
        .connect()
        .then((d) => d.discoverAllServicesAndCharacteristics())
        .then((d) => {
          deviceRef.current = d;
          d.onDisconnected(() => {
            subRef.current?.remove();
            subRef.current = null;
            deviceRef.current = null;
            setReading(null);
            if (closingRef.current) return; // intentional disconnect — stay stopped
            scanRef.current(); // tape powered off / went away — keep hunting for it
          });
          subRef.current = d.monitorCharacteristicForService(TAPE_SERVICE_UUID, TAPE_CHAR_UUID, (mErr, ch) => {
            if (mErr || !ch?.value) return;
            const parsed = parseTapePacket(base64ToBytes(ch.value));
            if (parsed) setReading(parsed);
          });
          setStatus('connected');
        })
        .catch(() => {
          // Connect failed (tape dropped mid-handshake) — resume scanning rather than erroring.
          deviceRef.current = null;
          if (!closingRef.current) scanRef.current();
        });
    });
  }, []);
  scanRef.current = scan;

  const start = useCallback(async () => {
    setError(null);
    setReading(null);
    closingRef.current = false;
    if (!(await requestPermissions())) {
      setError('Bluetooth permission was denied.');
      setStatus('error');
      return;
    }
    if (!managerRef.current) managerRef.current = new BleManager();
    const manager = managerRef.current;

    // Drive everything off the Bluetooth power state. `true` emits the current state
    // immediately, so this also handles "BT already off at open" and "BT toggled mid-session".
    stateSubRef.current?.remove();
    stateSubRef.current = manager.onStateChange((state) => {
      if (closingRef.current) return;
      if (state === 'PoweredOn') {
        setError(null);
        scanRef.current(); // (no-ops if already connected/scanning)
      } else {
        manager.stopDeviceScan();
        deviceRef.current = null;
        setReading(null);
        setError('Turn on Bluetooth, then try again.');
        setStatus('error');
      }
    }, true);
  }, []);

  useEffect(
    () => () => {
      teardown();
      managerRef.current?.destroy();
      managerRef.current = null;
    },
    [teardown]
  );

  return { status, reading, error, start, stop };
}
