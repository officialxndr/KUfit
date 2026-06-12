import { bytesToBase64 } from './ble';
import type { ScaleAdapter, ScaleDisplayUnit, ScaleReading, ScanResult } from './types';

/**
 * Etekcity Nutrition Scale (and other "A5"-protocol kitchen scales) BLE adapter.
 *
 *   service     0000fff0-0000-1000-8000-00805f9b34fb   (0xFFF0)
 *   notify char 0000fff1-0000-1000-8000-00805f9b34fb   (0xFFF1)  device → app (weight frames)
 *   write char  0000fff2-0000-1000-8000-00805f9b34fb   (0xFFF2)  app → device (Write w/o Response)
 *
 * Decoded from nRF Connect captures (zero + 427 g + 426 ml water + 414 ml milk + oz/lb/fl-oz).
 * Each device→app notification is a fixed 17-byte frame:
 *
 *   off    field        notes
 *   0      0xA5         sync / header
 *   1      flags        0x02 default; the 0x20 bit rides along in non-gram / active modes (unused)
 *   2      sequence     rolling counter (unused)
 *   3      0x0B         constant
 *   4      0x00         constant
 *   5      checksum     chosen so (sum of all 17 bytes) & 0xFF === 0xFF
 *   6-7    0x01 0x87    constant
 *   8      0xA1         constant
 *   9-10   0x00 0x00    constant
 *   11-13  weight       signed LITTLE-endian (byte 13 is the high byte, 0 for any load < 6.5 kg
 *                       and 0xFF for negatives); value = display reading × 10 (g/ml) or × 100 (oz/fl-oz)
 *   14     unit         0=oz 1=lb:oz 2=g 3=ml 4=fl-oz
 *   15     sub-mode     ml/fl-oz density: 1=water, 2=milk; else 0
 *   16     stable flag  best-effort settle flag (1 = reading present/settled)
 *
 * grams = display value converted from the display unit. g + ml(water) are exact; ml(milk) applies the
 * scale's ~1.03 density (427 g read back as 414 ml); oz is ×100 (confirmed: 1510 → 15.10 oz ≈ 428 g) and
 * converts by mass factor; fl-oz assumed ×100; lb:oz raw layout unverified (not reachable from the UI).
 *
 * The 0xA5 header + the (sum ≡ 0xFF) checksum + a unit ≤ 4 gate make `parse` self-validating,
 * so it safely ignores any non-measurement frame on the same characteristic.
 */

// Confirmed on hardware (Etekcity Nutrition Scale) via nRF Connect — the FFF0 service, not VeSync's.
export const A5_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
export const A5_NOTIFY = '0000fff1-0000-1000-8000-00805f9b34fb';
export const A5_WRITE = '0000fff2-0000-1000-8000-00805f9b34fb'; // Write w/o Response — app → scale commands

const FRAME_LEN = 17;
const MILK_DENSITY = 1.03; // 427 g read back as 414 ml → 427/414 ≈ 1.031
const OZ_TO_G = 28.3495;
const FLOZ_ML = 29.5735; // 1 US fl-oz in ml

/** Frame is valid when the running sum of all 17 bytes ends in 0xFF (the checksum byte tunes it). */
function checksumOk(b: Uint8Array, i: number): boolean {
  let sum = 0;
  for (let k = 0; k < FRAME_LEN; k++) sum += b[i + k];
  return (sum & 0xff) === 0xff;
}

/** Convert the raw signed weight field to grams + the human display value. The raw integer is the
 *  display reading scaled by 10 (g/ml) or 100 (oz/fl-oz, for their 2-decimal display). g + ml(water)
 *  are exact; ml(milk) uses a ~1.03 density; oz/fl-oz convert by mass/volume factor; lb:oz unverified. */
function toGrams(raw: number, unit: number, sub: number): { grams: number; displayUnit: string; display: number } {
  switch (unit) {
    case 2: { const v = raw / 10;  return { grams: v, displayUnit: 'g', display: v }; }                         // grams (exact)
    case 3: { const v = raw / 10;  return sub === 2                                                             // ml
      ? { grams: v * MILK_DENSITY, displayUnit: 'ml (milk)', display: v }
      : { grams: v, displayUnit: 'ml', display: v }; }
    case 0: { const v = raw / 100; return { grams: v * OZ_TO_G, displayUnit: 'oz', display: v }; }              // oz ×100 (confirmed: 1510 → 15.10 oz)
    case 4: { const v = raw / 100; return { grams: v * FLOZ_ML * (sub === 2 ? MILK_DENSITY : 1), displayUnit: 'fl oz', display: v }; } // assumed ×100
    case 1: { const v = raw / 100; return { grams: v * OZ_TO_G, displayUnit: 'lb:oz', display: v }; }           // lb:oz raw layout unverified
    default: { const v = raw / 10;  return { grams: v, displayUnit: 'g', display: v }; }
  }
}

export function parseA5Packet(bytes: Uint8Array): ScaleReading | null {
  for (let i = 0; i + FRAME_LEN <= bytes.length; i++) {
    if (bytes[i] !== 0xa5) continue;
    if (!checksumOk(bytes, i)) continue;
    const unit = bytes[i + 14];
    if (unit > 4) continue;
    const sub = bytes[i + 15];
    if (sub > 2) continue;
    // weight: signed little-endian over bytes 11-13 (byte 13 = high byte / sign extension)
    const u24 = bytes[i + 11] | (bytes[i + 12] << 8) | (bytes[i + 13] << 16);
    const signed = u24 >= 0x800000 ? u24 - 0x1000000 : u24;
    const { grams, displayUnit, display } = toGrams(signed, unit, sub);
    // Sanity-gate against a coincidental frame: no kitchen scale exceeds ~11 kg.
    if (!Number.isFinite(grams) || Math.abs(grams) > 11000) continue;
    return { grams: Math.round(grams * 10) / 10, stable: bytes[i + 16] === 1, displayUnit, raw: Math.round(display * 100) / 100 };
  }
  return null;
}

/**
 * App → scale commands (written to FFF2) share the weight frame's A5 framing + checksum:
 *   [0] 0xA5  [1] 0x22  [2] sequence (rolling — the app increments it per command)  [3] payload length
 *   [4] 0x00  [5] checksum (sum of all bytes ≡ 0xFF)  [6..] payload
 * Decoded from VeSync-app captures:
 *   tare      → payload  01 85 A1 00
 *   set unit  → payload  01 80 A1 00 <unit> 00   (unit = the notify enum: 0=oz 1=lb:oz 2=g 3=ml 4=fl-oz)
 * Verified: buildCommand() reproduces all three captured frames (tare / set-g / set-oz) byte-for-byte.
 */
let cmdSeq = 0;
function buildCommand(payload: number[]): number[] {
  cmdSeq = (cmdSeq + 1) & 0xff;
  const frame = [0xa5, 0x22, cmdSeq, payload.length, 0x00, 0x00, ...payload];
  let sum = 0;
  for (const b of frame) sum += b;
  frame[5] = (0xff - (sum & 0xff)) & 0xff; // tune the checksum so the byte sum ends in 0xFF
  return frame;
}

const tareCommand = () => buildCommand([0x01, 0x85, 0xa1, 0x00]);
/** Force the scale's display unit (notify enum: 0=oz 1=lb:oz 2=g 3=ml 4=fl-oz). */
export const setUnitCommand = (unit: number) => buildCommand([0x01, 0x80, 0xa1, 0x00, unit & 0xff, 0x00]);

/** Semantic display unit → this scale's wire enum (ml uses the water sub-mode). */
const UNIT_CODE: Record<ScaleDisplayUnit, number> = { oz: 0, g: 2, ml: 3, floz: 4 };

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const a5Adapter: ScaleAdapter = {
  id: 'etekcity-nutrition',
  displayName: 'Etekcity Nutrition Scale',
  serviceUUIDs: [A5_SERVICE],
  matches: (d: ScanResult) => {
    // Advertised name is "Etekcity Nutrition Scale" (confirmed in nRF Connect). Match on the
    // distinctive 'nutrition' token (kept off bare 'etekcity' so it stays disjoint from esn00),
    // or on the FFF0 service if the advert carries it.
    const names = [norm(d.name), norm(d.localName)];
    const byName = names.some((n) => n.includes('nutrition'));
    const bySvc = d.serviceUUIDs?.some((u) => u.toLowerCase() === A5_SERVICE.toLowerCase()) ?? false;
    return byName || bySvc;
  },
  notify: { service: A5_SERVICE, characteristic: A5_NOTIFY },
  parse: parseA5Packet,
  tare: async (device) => {
    await device.writeCharacteristicWithoutResponseForService(A5_SERVICE, A5_WRITE, bytesToBase64(tareCommand()));
  },
  setUnit: async (device, unit) => {
    await device.writeCharacteristicWithoutResponseForService(A5_SERVICE, A5_WRITE, bytesToBase64(setUnitCommand(UNIT_CODE[unit])));
  },
};
