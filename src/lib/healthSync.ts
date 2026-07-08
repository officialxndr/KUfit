import { Platform } from 'react-native';
import { health } from '@/lib/health';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRefreshStore } from '@/stores/refreshStore';
import { syncWidget } from '@/lib/widget';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';

/**
 * Keeps the local weight log in step with Apple Health / Health Connect **without the user
 * having to re-tap "Connect"**. Once auto-import is on (`profile.healthWeightSync`, set the
 * first time they connect), `syncHealthWeights()` runs on every foreground and via a live
 * observer, importing any weigh-ins added elsewhere (a smart scale, the Health app, etc.).
 *
 * Imports are conflict-safe: `HealthRepo.upsertWeightFromHealth` never overwrites a
 * hand-logged entry, so re-running this on every foreground is idempotent and harmless.
 */

const enabled = () => {
  const p = useSettingsStore.getState().profile;
  return (p.healthWeightSync || p.healthBodyFatImport) && health.isAvailable();
};

const DAY = 86_400_000;
const FULL_SINCE = new Date(0).toISOString(); // epoch — full-history read for body fat

/** ISO lower bound for the incremental read: a few days before our latest imported day, so
 *  the window tightens over time instead of re-scanning ~90 days on every foreground. For
 *  users migrated on before any `HEALTH` row exists we anchor on their latest weigh-in of
 *  any source; ~90 days back only when the log is empty. */
function incrementalSince(): string {
  const anchor = healthRepo.getLatestHealthWeightDate() ?? healthRepo.getLatestWeightEntry()?.date ?? null;
  const base = anchor ? new Date(`${anchor}T00:00:00`).getTime() : Date.now() - 90 * DAY;
  return new Date(base - 3 * DAY).toISOString();
}

// All syncs run one-at-a-time on this chain: a forced full backfill (Connect) can never be
// dropped by an in-flight incremental run, and a burst of observer/foreground fires coalesces
// into a single trailing run — so a weigh-in that lands mid-sync is still picked up right after.
let chain: Promise<number> = Promise.resolve(0);
let trailingQueued = false;

async function runSync(full: boolean): Promise<number> {
  if (!health.isAvailable()) return 0;
  const profile = useSettingsStore.getState().profile;
  const since = full ? FULL_SINCE : incrementalSince();
  let changed = 0;

  if (profile.healthWeightSync) {
    const readings = full ? await health.getAllWeights() : await health.getWeightsSince(since);
    // Collapse to one weigh-in per day (latest sample wins); drop non-finite weights so a bad
    // sample can't hit the `weightKg REAL NOT NULL` constraint.
    const byDay = new Map<string, number>();
    for (const r of readings) if (Number.isFinite(r.weightKg)) byDay.set(r.date, r.weightKg);
    byDay.forEach((kg, date) => {
      try { if (healthRepo.upsertWeightFromHealth(date, kg)) changed++; } catch {} // one bad row can't abort the batch
    });
  }

  // Opt-in: attach imported body-fat % to that day's HEALTH weigh-in (never DEXA/manual).
  if (profile.healthBodyFatImport) {
    const bfReadings = await health.getBodyFatSince(since);
    const bfByDay = new Map<string, number>();
    for (const r of bfReadings) if (Number.isFinite(r.pct)) bfByDay.set(r.date, r.pct);
    bfByDay.forEach((pct, date) => {
      try { if (healthRepo.upsertBodyFatFromHealth(date, pct)) changed++; } catch {}
    });
  }

  if (changed > 0) {
    useRefreshStore.getState().bump(); // refresh any focused screen without a remount
    syncWidget();
    syncBodyFatGoalWeight(); // body composition may have changed → refresh a body-fat-mode goal weight
  }
  return changed;
}

/**
 * Pull weigh-ins from the health store into the local DB. `full` reads the entire history
 * (the one-time backfill on connect); otherwise it's a cheap incremental read. `force`
 * bypasses the enabled flag (used right after the user connects, before the store update
 * has necessarily propagated). Returns the number of days inserted/updated by this run.
 */
export function syncHealthWeights(opts: { full?: boolean; force?: boolean } = {}): Promise<number> {
  if (!opts.force && !enabled()) return Promise.resolve(0);
  if (!health.isAvailable()) return Promise.resolve(0);
  const full = !!opts.full;
  if (!opts.force && !full) {
    // Incremental (foreground / observer): coalesce into at most one queued trailing run
    // so bursts can't pile up, while still guaranteeing a run *after* any in-flight one.
    if (trailingQueued) return chain;
    trailingQueued = true;
    chain = chain.catch(() => 0).then(() => { trailingQueued = false; return runSync(false); });
    return chain;
  }
  // Forced / full backfill (Connect): must run — serialize after any in-flight work.
  chain = chain.catch(() => 0).then(() => runSync(full));
  return chain;
}

let weightSub: (() => void) | null = null;

/**
 * (Re)start the live HealthKit observer so a weigh-in added while the app is open imports
 * immediately. Idempotent — safe to call on launch, on foreground, and after connect; it
 * tears the observer down when auto-import is off. iOS only (Android's health seam has no
 * observer API, so it leans on the foreground sync).
 */
export function ensureHealthWeightObserver(): void {
  if (!enabled() || Platform.OS !== 'ios' || typeof health.subscribeToWeightChanges !== 'function') {
    weightSub?.();
    weightSub = null;
    return;
  }
  if (weightSub) return; // already observing
  weightSub = health.subscribeToWeightChanges(() => { syncHealthWeights().catch(() => {}); });
}
