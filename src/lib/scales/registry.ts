import { esn00Adapter } from './esn00';
import type { ScaleAdapter, ScanResult } from './types';

/** Registered scale drivers, tried in order. Add a new scale by appending its adapter. */
export const SCALE_ADAPTERS: ScaleAdapter[] = [esn00Adapter];

export function matchAdapter(d: ScanResult): ScaleAdapter | null {
  return SCALE_ADAPTERS.find((a) => a.matches(d)) ?? null;
}
