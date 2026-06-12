import type { ScaleAdapter, ScaleReading, ScanResult } from './types';

/**
 * Renpho ES-SNG01 / Etekcity ESN00 food scale (both VeSync) BLE adapter.
 *
 * Protocol (community-documented — hertzg/metekcity):
 *   service     00001910-0000-1000-8000-00805f9b34fb   (0x1910)
 *   notify char 00002c12-0000-1000-8000-00805f9b34fb   (0x2c12)  device → app
 *   write char  00002c11-0000-1000-8000-00805f9b34fb   (0x2c11)  app → device (commands)
 *
 * A MEASUREMENT frame has type byte 0xD0 followed by a 5-byte payload:
 *   [0] sign    0x00 = +, 0x01 = −
 *   [1..2] weight  big-endian uint16
 *   [3] unit    0=g 1=lb:oz 2=ml 3=fl-oz 4=ml(milk) 5=fl-oz(milk) 6=oz   (enum, not bitmask)
 *   [4] stable  0x00 = measuring, 0x01 = settled
 * In grams the value is ×10 (so grams = weight / 10) — and the unit byte reports the scale's
 * DISPLAY unit, so we convert to grams from whatever the scale is set to.
 *
 * NOTE: the frame header (magic/length/checksum) isn't confirmed yet, so `parse` locates the
 * 0xD0 type byte and validates the payload rather than assuming a fixed offset. Confirm the
 * exact framing with the raw inspector (Settings → Bluetooth scale) on first connect, then
 * tighten this + wire the 0xC1 SET_TARE command (left to software tare until then).
 */
export const ESN00_SERVICE = '00001910-0000-1000-8000-00805f9b34fb';
export const ESN00_NOTIFY = '00002c12-0000-1000-8000-00805f9b34fb';
export const ESN00_WRITE = '00002c11-0000-1000-8000-00805f9b34fb';

const OZ_TO_G = 28.3495;
const FLOZ_TO_G = 29.5735; // volume → grams assuming water density (best effort)

/** Convert a raw display-unit value to grams. The `g`/`ml` paths are solid; oz/fl-oz scaling
 *  is a best guess (÷100) flagged for verification with the real scale. */
function toGrams(raw: number, unit: number): { grams: number; displayUnit: string } {
  switch (unit) {
    case 0: return { grams: raw / 10, displayUnit: 'g' };
    case 2: return { grams: raw / 10, displayUnit: 'ml' };        // water ≈ 1 g/ml
    case 4: return { grams: raw / 10, displayUnit: 'ml' };        // milk ≈ 1 g/ml
    case 6: return { grams: (raw / 100) * OZ_TO_G, displayUnit: 'oz' };        // VERIFY scaling
    case 3: return { grams: (raw / 100) * FLOZ_TO_G, displayUnit: 'fl oz' };   // VERIFY scaling
    case 5: return { grams: (raw / 100) * FLOZ_TO_G, displayUnit: 'fl oz' };   // VERIFY scaling
    case 1: return { grams: (raw / 100) * OZ_TO_G, displayUnit: 'lb:oz' };     // VERIFY scaling
    default: return { grams: raw / 10, displayUnit: 'g' };
  }
}

export function parseEsn00Packet(bytes: Uint8Array): ScaleReading | null {
  for (let i = 0; i + 5 < bytes.length; i++) {
    if (bytes[i] !== 0xd0) continue;
    const sign = bytes[i + 1];
    if (sign > 1) continue;
    const weight = (bytes[i + 2] << 8) | bytes[i + 3];
    const unit = bytes[i + 4];
    if (unit > 6) continue;
    const stable = bytes[i + 5];
    if (stable > 1) continue;
    const { grams, displayUnit } = toGrams(weight, unit);
    const signed = sign === 1 ? -grams : grams;
    // Sanity-gate against coincidental 0xD0 bytes: a 5 kg scale won't exceed ~6000 g.
    if (!Number.isFinite(signed) || Math.abs(signed) > 6000) continue;
    return { grams: Math.round(signed * 10) / 10, stable: stable === 1, displayUnit, raw: weight };
  }
  return null;
}

const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const esn00Adapter: ScaleAdapter = {
  id: 'esn00',
  displayName: 'Renpho / Etekcity food scale',
  serviceUUIDs: [ESN00_SERVICE],
  matches: (d: ScanResult) => {
    const names = [norm(d.name), norm(d.localName)];
    // Brand/model tokens only — NOT a bare 'scale' (that would greedily claim any other adapter's
    // device). A real ES-SNG01/ESN00 also advertises the 0x1910 service, caught by bySvc below.
    const byName = names.some((n) => n && (n.includes('renpho') || n.includes('etekcity') || n.includes('esn') || n.includes('sng') || n.includes('vesync')));
    const bySvc = d.serviceUUIDs?.some((u) => u.toLowerCase() === ESN00_SERVICE.toLowerCase()) ?? false;
    return byName || bySvc;
  },
  notify: { service: ESN00_SERVICE, characteristic: ESN00_NOTIFY },
  parse: parseEsn00Packet,
  // tare: left undefined until the 0xC1 command framing is confirmed → software tare is used.
};
