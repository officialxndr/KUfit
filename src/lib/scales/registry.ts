import { a5Adapter } from './a5scale';
import { esn00Adapter } from './esn00';
import type { ScaleAdapter, ScanResult } from './types';

/** Registered scale drivers. Add a scale = one adapter file + one line here. Each adapter should
 *  `matches()` as narrowly as it can (ideally on its service UUID or a distinctive name token) so
 *  it doesn't claim another scale's device; `matchAdapter` resolves any overlap below. */
export const SCALE_ADAPTERS: ScaleAdapter[] = [a5Adapter, esn00Adapter];

/**
 * Pick the adapter for a scanned device. When more than one claims it, prefer the adapter whose
 * declared service UUID is actually advertised (a strong signal) over a name-only match; otherwise
 * fall back to registry order. Returns null if none match.
 */
export function matchAdapter(d: ScanResult): ScaleAdapter | null {
  const hits = SCALE_ADAPTERS.filter((a) => a.matches(d));
  if (hits.length <= 1) return hits[0] ?? null;
  const advertised = (d.serviceUUIDs ?? []).map((u) => u.toLowerCase());
  return hits.find((a) => a.serviceUUIDs?.some((u) => advertised.includes(u.toLowerCase()))) ?? hits[0];
}
