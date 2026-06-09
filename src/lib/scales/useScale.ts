import { useCallback, useEffect, useRef, useState } from 'react';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';

import { base64ToBytes, bytesToHex, requestBlePermissions } from './ble';
import { matchAdapter } from './registry';
import type { ScaleAdapter, ScaleReading, ScaleStatus } from './types';

export interface UseScale {
  status: ScaleStatus;
  /** Latest reading, grams-normalized and software-tare-adjusted. */
  reading: ScaleReading | null;
  error: string | null;
  deviceName: string | null;
  /** True if the connected scale supports a hardware tare command (else tare is software). */
  tareSupported: boolean;
  /** Last raw notify frame in hex (diagnostics). */
  lastRawHex: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Zero the reading — hardware tare if the scale supports it, else software offset. */
  tare: () => void;
}

/**
 * Drives scan → match a registered `ScaleAdapter` → connect → subscribe → live grams.
 * Mirrors `useRenphoTape`: stays scanning while open and auto-reconnects when the scale
 * powers back on. `simulate: true` skips BLE entirely and emits a mock pour-and-settle
 * weight, so the whole flow is testable without hardware (and in Expo Go).
 */
export function useScale(opts?: { simulate?: boolean }): UseScale {
  const simulate = !!opts?.simulate;
  const [status, setStatus] = useState<ScaleStatus>('idle');
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastRawHex, setLastRawHex] = useState<string | null>(null);
  const [tareSupported, setTareSupported] = useState(false);

  const managerRef = useRef<BleManager | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const adapterRef = useRef<ScaleAdapter | null>(null);
  const subRef = useRef<Subscription | null>(null);
  const stateSubRef = useRef<Subscription | null>(null);
  const closingRef = useRef(false);
  const scanRef = useRef<() => void>(() => {});
  // Software tare: grams subtracted from every raw reading; the latest raw is kept so a
  // tare press can capture it as the new zero.
  const offsetRef = useRef(0);
  const rawGramsRef = useRef(0);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emit = useCallback((r: ScaleReading) => {
    rawGramsRef.current = r.grams;
    setReading({ ...r, grams: Math.round((r.grams - offsetRef.current) * 10) / 10 });
  }, []);

  const teardown = useCallback(() => {
    closingRef.current = true;
    if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = null; }
    stateSubRef.current?.remove(); stateSubRef.current = null;
    subRef.current?.remove(); subRef.current = null;
    deviceRef.current?.cancelConnection().catch(() => {});
    deviceRef.current = null;
    adapterRef.current = null;
    managerRef.current?.stopDeviceScan();
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus('idle'); setReading(null); setError(null); setDeviceName(null); setLastRawHex(null); setTareSupported(false);
    offsetRef.current = 0; rawGramsRef.current = 0;
  }, [teardown]);

  // ── Simulator ───────────────────────────────────────────────────────────────
  const startSim = useCallback(() => {
    setStatus('connected'); setDeviceName('Simulated scale'); setTareSupported(false);
    let current = 0, target = 0, settleTicks = 0;
    simTimerRef.current = setInterval(() => {
      if (Math.abs(current - target) < 1) {
        settleTicks += 1;
        if (settleTicks > 6) { target = Math.round(Math.random() * 480 + 20); settleTicks = 0; } // new "pour"
      } else {
        current += (target - current) * 0.35 + (Math.random() - 0.5) * 4; // approach + jitter
        settleTicks = 0;
      }
      const stable = Math.abs(current - target) < 1.5;
      emit({ grams: Math.max(0, Math.round(current * 10) / 10), stable, displayUnit: 'g' });
    }, 350);
  }, [emit]);

  // ── BLE scan → connect ────────────────────────────────────────────────────────
  const scan = useCallback(() => {
    const manager = managerRef.current;
    if (!manager || closingRef.current || deviceRef.current) return;
    setStatus('scanning');
    manager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      if (err || !device) return;
      const adapter = matchAdapter({ name: device.name, localName: device.localName, serviceUUIDs: device.serviceUUIDs });
      if (!adapter) return;

      manager.stopDeviceScan();
      setStatus('connecting');
      device.connect()
        .then((d) => d.discoverAllServicesAndCharacteristics())
        .then(async (d) => {
          deviceRef.current = d; adapterRef.current = adapter;
          setDeviceName(d.name ?? adapter.displayName);
          setTareSupported(!!adapter.tare);
          if (adapter.init) await adapter.init(d).catch(() => {});
          d.onDisconnected(() => {
            subRef.current?.remove(); subRef.current = null;
            deviceRef.current = null; setReading(null);
            if (closingRef.current) return;
            scanRef.current();
          });
          subRef.current = d.monitorCharacteristicForService(adapter.notify.service, adapter.notify.characteristic, (mErr, ch) => {
            if (mErr || !ch?.value) return;
            const bytes = base64ToBytes(ch.value);
            setLastRawHex(bytesToHex(bytes));
            const parsed = adapter.parse(bytes);
            if (parsed) emit(parsed);
          });
          setStatus('connected');
        })
        .catch(() => { deviceRef.current = null; if (!closingRef.current) scanRef.current(); });
    });
  }, [emit]);
  scanRef.current = scan;

  const start = useCallback(async () => {
    setError(null); setReading(null); closingRef.current = false;
    offsetRef.current = 0; rawGramsRef.current = 0;
    if (simulate) { startSim(); return; }
    if (!(await requestBlePermissions())) { setError('Bluetooth permission was denied.'); setStatus('error'); return; }
    try {
      if (!managerRef.current) managerRef.current = new BleManager();
    } catch {
      // No native BLE module (e.g. Expo Go) — offer the simulator instead.
      setError('Bluetooth needs a dev build. Tap Simulate to preview.'); setStatus('error'); return;
    }
    const manager = managerRef.current;
    stateSubRef.current?.remove();
    stateSubRef.current = manager.onStateChange((state) => {
      if (closingRef.current) return;
      if (state === 'PoweredOn') { setError(null); scanRef.current(); }
      else { manager.stopDeviceScan(); deviceRef.current = null; setReading(null); setError('Turn on Bluetooth, then try again.'); setStatus('error'); }
    }, true);
  }, [simulate, startSim]);

  const tare = useCallback(() => {
    const adapter = adapterRef.current, device = deviceRef.current;
    if (adapter?.tare && device) {
      offsetRef.current = 0;
      adapter.tare(device).catch(() => { offsetRef.current = rawGramsRef.current; }); // fall back to software on failure
    } else {
      offsetRef.current = rawGramsRef.current; // software tare
    }
    setReading((r) => (r ? { ...r, grams: 0 } : r));
  }, []);

  useEffect(() => () => { teardown(); managerRef.current?.destroy(); managerRef.current = null; }, [teardown]);

  return { status, reading, error, deviceName, tareSupported, lastRawHex, start, stop, tare };
}
