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
 * Each notification is an ASCII frame, e.g. `*01240;00000;0000PM\n`:
 *   x[0]   = 0x2A '*'
 *   x[1..4]= circumference digits (low nibble of each ASCII byte); value/10 = cm
 *   x[17]  = status char: LSB set ('S') = confirmed (tape button pressed), else 'P' live
 *   x[18]  = unit char: 'M' metric, 'I' imperial
 */
export const TAPE_SERVICE_UUID = '0783B03E-8535-B5A0-7140-A304D2495CB7';
export const TAPE_CHAR_UUID = '0783B03E-8535-B5A0-7140-A304D2495CB8';
const TAPE_NAME = 'ES_TAPE';

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
  if (bytes.length < 18 || bytes[0] !== 0x2a) return null;
  const nib = (b: number) => b & 0x0f;
  const raw = 1000 * nib(bytes[1]) + 100 * nib(bytes[2]) + 10 * nib(bytes[3]) + nib(bytes[4]);
  // Device reports tenths of its display unit. Normalise everything to cm.
  let cm = raw / 10;
  if (bytes[18] === 0x49 /* 'I' */) cm = (raw / 10) * 2.54; // device set to inches
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
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const subRef = useRef<Subscription | null>(null);

  const teardown = useCallback(() => {
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
  }, [teardown]);

  const start = useCallback(async () => {
    setError(null);
    setReading(null);
    if (!(await requestPermissions())) {
      setError('Bluetooth permission was denied.');
      setStatus('error');
      return;
    }
    if (!managerRef.current) managerRef.current = new BleManager();
    const manager = managerRef.current;

    const state = await manager.state();
    if (state !== 'PoweredOn') {
      setError('Turn on Bluetooth, then try again.');
      setStatus('error');
      return;
    }

    setStatus('scanning');
    manager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      if (err) {
        setError(err.message);
        setStatus('error');
        manager.stopDeviceScan();
        return;
      }
      if (!device) return;
      const matches =
        device.name === TAPE_NAME ||
        device.localName === TAPE_NAME ||
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
            setStatus('idle');
          });
          subRef.current = d.monitorCharacteristicForService(TAPE_SERVICE_UUID, TAPE_CHAR_UUID, (mErr, ch) => {
            if (mErr || !ch?.value) return;
            const parsed = parseTapePacket(base64ToBytes(ch.value));
            if (parsed) setReading(parsed);
          });
          setStatus('connected');
        })
        .catch((e) => {
          setError(e?.message ?? 'Failed to connect.');
          setStatus('error');
        });
    });
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
