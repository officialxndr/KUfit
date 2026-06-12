import type { Device } from 'react-native-ble-plx';

/** One weight sample, **always normalized to grams** (the app's storage unit). */
export interface ScaleReading {
  /** Net weight in grams (after the adapter converts from the scale's display unit). */
  grams: number;
  /** True once the scale signals the reading has settled (vs. still changing). */
  stable: boolean;
  /** The scale's current display unit if the protocol reports it ('g'|'oz'|'ml'|…). */
  displayUnit?: string;
  /** Raw value in the display unit (diagnostics only). */
  raw?: number;
}

/** Minimal view of a scanned device for matching (so adapters don't import ble-plx Device). */
export interface ScanResult {
  name?: string | null;
  localName?: string | null;
  serviceUUIDs?: string[] | null;
}

/** Semantic display units the app can ask a scale to switch to (the adapter maps to its wire code). */
export type ScaleDisplayUnit = 'g' | 'oz' | 'ml' | 'floz';

/**
 * A pluggable scale driver. Add a new scale by implementing this and registering it in
 * `registry.ts` — the generic `useScale` hook scans, asks each adapter `matches()`, then
 * connects the first hit and subscribes to `notify` running its `parse`. All weight is
 * normalized to **grams** inside `parse`, so the rest of the app never sees a scale's
 * display unit (g/oz/ml) or protocol quirks. Most scales need only UUIDs + a parser; the
 * optional `init`/`tare` cover handshakes and hardware-tare commands.
 */
export interface ScaleAdapter {
  id: string;
  displayName: string;
  /** Service UUIDs to bias the scan toward (optional; matching also works on name). */
  serviceUUIDs?: string[];
  /** Does this scanned device belong to this adapter? */
  matches: (d: ScanResult) => boolean;
  /** The notify service + characteristic that streams weight. */
  notify: { service: string; characteristic: string };
  /** Parse one raw notification into a grams-normalized reading (null = ignore frame). */
  parse: (bytes: Uint8Array) => ScaleReading | null;
  /** Optional handshake write the scale needs before it starts streaming. */
  init?: (device: Device) => Promise<void>;
  /** Optional hardware tare over BLE (else the hook falls back to software tare). */
  tare?: (device: Device) => Promise<void>;
  /** Optional: set the scale's on-device display unit so its LCD follows the app's unit picker. */
  setUnit?: (device: Device, unit: ScaleDisplayUnit) => Promise<void>;
}

export type ScaleStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';
