import { Platform } from 'react-native';

/**
 * Cross-platform health integration: **Apple HealthKit** (iOS) and **Android
 * Health Connect**. Native modules are loaded lazily inside each method (never
 * at import) so the app launches fine in a build that predates them; they
 * activate after a native rebuild with the libs + permissions.
 *
 * iOS note: HealthKit also needs the HealthKit *entitlement* enabled on your
 * Apple Developer account (paid program) to authorize at runtime.
 */
export interface WeightReading {
  weightKg: number;
  date: string; // ISO date (YYYY-MM-DD)
}

export interface BodyFatReading {
  pct: number; // body-fat percentage 0–100 (normalized inside the adapter)
  date: string; // ISO date (YYYY-MM-DD)
}

export interface HealthService {
  isAvailable(): boolean;
  requestPermissions(): Promise<boolean>;
  getLatestWeight(): Promise<WeightReading | null>;
  /** All weight readings (full history) for a one-time backfill. */
  getAllWeights(): Promise<WeightReading[]>;
  /** Weight readings recorded on/after `sinceIso` — the cheap incremental read used by
   *  the auto-import that runs on every foreground (`lib/healthSync.ts`). */
  getWeightsSince(sinceIso: string): Promise<WeightReading[]>;
  /** Body-fat % readings recorded on/after `sinceIso`, normalized to 0–100. Only imported
   *  when the user opts in (`profile.healthBodyFatImport`); off by default. */
  getBodyFatSince(sinceIso: string): Promise<BodyFatReading[]>;
  /**
   * Subscribe to new weight samples landing in the health store while the app is open, so
   * a fresh weigh-in imports immediately (not just on the next foreground). Returns an
   * unsubscribe fn, or `null` when the platform has no observer API (Android relies on the
   * foreground sync). The callback fires on *any* body-mass change; callers re-read.
   */
  subscribeToWeightChanges?(onChange: () => void): (() => void) | null;
  /**
   * Total active energy burned (kcal) in the given window — e.g. a workout's
   * start→finish. Returns `null` when no data is available (no watch / not
   * authorized), so callers can fall back to a time-based estimate.
   */
  getActiveEnergyBurned(startIso: string, endIso: string): Promise<number | null>;
  /**
   * Heart-rate samples (BPM, chronological) recorded in the given window — e.g.
   * a workout's start→finish. `null` when no data is available.
   */
  getHeartRateSamples(startIso: string, endIso: string): Promise<number[] | null>;
  /** Most recent heart-rate reading (BPM) in the last ~2 min, for a live readout. */
  getLatestHeartRate(): Promise<number | null>;
}

const isoDay = (d: string | number | Date) => new Date(d).toISOString().slice(0, 10);

const unavailable: HealthService = {
  isAvailable: () => false,
  requestPermissions: async () => false,
  getLatestWeight: async () => null,
  getAllWeights: async () => [],
  getWeightsSince: async () => [],
  getBodyFatSince: async () => [],
  getActiveEnergyBurned: async () => null,
  getHeartRateSamples: async () => null,
  getLatestHeartRate: async () => null,
  subscribeToWeightChanges: () => null,
};

const appleHealth: HealthService = {
  isAvailable() {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      return !!hk.isHealthDataAvailable?.();
    } catch {
      return false;
    }
  },
  async requestPermissions() {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      return await hk.requestAuthorization({
        toRead: [
          'HKQuantityTypeIdentifierBodyMass',
          'HKQuantityTypeIdentifierBodyFatPercentage',
          'HKQuantityTypeIdentifierStepCount',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          'HKQuantityTypeIdentifierHeartRate',
        ],
      });
    } catch {
      return false;
    }
  },
  async getLatestWeight() {
    const all = await this.getAllWeights();
    return all.length ? all[all.length - 1] : null;
  },
  async getAllWeights() {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
        unit: 'kg',
        limit: 10000,
        ascending: true,
      });
      return (samples ?? [])
        .filter((s: any) => typeof s?.quantity === 'number')
        .map((s: any) => ({ weightKg: s.quantity, date: isoDay(s.endDate ?? s.startDate ?? Date.now()) }));
    } catch {
      return [];
    }
  },
  async getWeightsSince(sinceIso) {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
        unit: 'kg',
        limit: 10000,
        ascending: true,
        filter: { date: { startDate: new Date(sinceIso), endDate: new Date() } },
      });
      return (samples ?? [])
        .filter((s: any) => typeof s?.quantity === 'number')
        .map((s: any) => ({ weightKg: s.quantity, date: isoDay(s.endDate ?? s.startDate ?? Date.now()) }));
    } catch {
      return [];
    }
  },
  async getBodyFatSince(sinceIso) {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyFatPercentage', {
        unit: '%',
        limit: 10000,
        ascending: true,
        filter: { date: { startDate: new Date(sinceIso), endDate: new Date() } },
      });
      return (samples ?? [])
        .filter((s: any) => typeof s?.quantity === 'number')
        // HealthKit's percent unit yields a fraction (0.22 = 22%); a value ≤ 1 is a fraction.
        .map((s: any) => ({ pct: s.quantity <= 1 ? s.quantity * 100 : s.quantity, date: isoDay(s.endDate ?? s.startDate ?? Date.now()) }))
        .filter((r: any) => r.pct >= 1 && r.pct <= 75);
    } catch {
      return [];
    }
  },
  subscribeToWeightChanges(onChange) {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      if (typeof hk.subscribeToChanges !== 'function') return null;
      const sub = hk.subscribeToChanges('HKQuantityTypeIdentifierBodyMass', () => onChange());
      return () => { try { sub?.remove?.(); } catch {} };
    } catch {
      return null;
    }
  },
  async getActiveEnergyBurned(startIso, endIso) {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const start = new Date(startIso);
      const end = new Date(endIso);
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', {
        unit: 'kcal',
        limit: 10000,
        // Correct filter shape for this lib — `from`/`to` are ignored and would
        // otherwise return *all* recent samples (summing many days).
        filter: { date: { startDate: start, endDate: end } },
      });
      const sMs = start.getTime();
      const eMs = end.getTime();
      const inWindow = (samples ?? []).filter((s: any) => {
        if (typeof s?.quantity !== 'number') return false;
        // Belt-and-suspenders: also bound by date in JS so a filter/API change can't leak older samples.
        const endMs = new Date(s.endDate ?? s.startDate ?? 0).getTime();
        const startMs = new Date(s.startDate ?? s.endDate ?? 0).getTime();
        return endMs >= sMs && startMs <= eMs;
      });
      if (!inWindow.length) return null;
      return inWindow.reduce((sum: number, s: any) => sum + s.quantity, 0);
    } catch {
      return null;
    }
  },
  async getHeartRateSamples(startIso, endIso) {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const start = new Date(startIso);
      const end = new Date(endIso);
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        unit: 'count/min',
        limit: 10000,
        ascending: true,
        filter: { date: { startDate: start, endDate: end } },
      });
      const sMs = start.getTime();
      const eMs = end.getTime();
      const bpms = (samples ?? [])
        .filter((s: any) => {
          if (typeof s?.quantity !== 'number') return false;
          const ts = new Date(s.endDate ?? s.startDate ?? 0).getTime();
          return ts >= sMs && ts <= eMs;
        })
        .map((s: any) => s.quantity);
      return bpms.length ? bpms : null;
    } catch {
      return null;
    }
  },
  async getLatestHeartRate() {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const end = new Date();
      const start = new Date(end.getTime() - 2 * 60 * 1000);
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        unit: 'count/min',
        limit: 1,
        ascending: false,
        filter: { date: { startDate: start, endDate: end } },
      });
      const latest = (samples ?? []).find((s: any) => typeof s?.quantity === 'number');
      return latest ? Math.round(latest.quantity) : null;
    } catch {
      return null;
    }
  },
};

const androidHealth: HealthService = {
  isAvailable() {
    try {
      require('react-native-health-connect');
      return true; // real availability is checked on connect via getSdkStatus
    } catch {
      return false;
    }
  },
  async requestPermissions() {
    try {
      const hc = require('react-native-health-connect');
      const status = await hc.getSdkStatus();
      if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
      await hc.initialize();
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'Weight' },
        { accessType: 'read', recordType: 'BodyFat' },
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
        { accessType: 'read', recordType: 'HeartRate' },
      ]);
      return Array.isArray(granted) && granted.length > 0;
    } catch {
      return false;
    }
  },
  async getLatestWeight() {
    const all = await this.getAllWeights();
    return all.length ? all[all.length - 1] : null;
  },
  async getAllWeights() {
    try {
      const hc = require('react-native-health-connect');
      await hc.initialize();
      const end = new Date();
      const start = new Date(end.getTime() - 5 * 365 * 86400000);
      const res = await hc.readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      return (res?.records ?? [])
        .map((r: any) => ({ weightKg: r?.weight?.inKilograms, date: isoDay(r?.time ?? Date.now()) }))
        .filter((r: any) => typeof r.weightKg === 'number');
    } catch {
      return [];
    }
  },
  async getWeightsSince(sinceIso) {
    try {
      const hc = require('react-native-health-connect');
      await hc.initialize();
      const res = await hc.readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: new Date(sinceIso).toISOString(), endTime: new Date().toISOString() },
      });
      return (res?.records ?? [])
        .map((r: any) => ({ weightKg: r?.weight?.inKilograms, date: isoDay(r?.time ?? Date.now()) }))
        .filter((r: any) => typeof r.weightKg === 'number');
    } catch {
      return [];
    }
  },
  async getBodyFatSince(sinceIso) {
    try {
      const hc = require('react-native-health-connect');
      await hc.initialize();
      const res = await hc.readRecords('BodyFat', {
        timeRangeFilter: { operator: 'between', startTime: new Date(sinceIso).toISOString(), endTime: new Date().toISOString() },
      });
      // Health Connect BodyFat.percentage.value is already 0–100.
      return (res?.records ?? [])
        .map((r: any) => ({ pct: r?.percentage?.value, date: isoDay(r?.time ?? Date.now()) }))
        .filter((r: any) => typeof r.pct === 'number' && r.pct >= 1 && r.pct <= 75);
    } catch {
      return [];
    }
  },
  async getActiveEnergyBurned(startIso, endIso) {
    try {
      const hc = require('react-native-health-connect');
      await hc.initialize();
      const res = await hc.readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
      });
      const records = (res?.records ?? []).filter(
        (r: any) => typeof r?.energy?.inKilocalories === 'number'
      );
      if (!records.length) return null;
      return records.reduce((sum: number, r: any) => sum + r.energy.inKilocalories, 0);
    } catch {
      return null;
    }
  },
  async getHeartRateSamples(startIso, endIso) {
    try {
      const hc = require('react-native-health-connect');
      await hc.initialize();
      const res = await hc.readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
      });
      // Each HeartRate record nests a `samples: [{ time, beatsPerMinute }]` array.
      const bpms = (res?.records ?? [])
        .flatMap((r: any) => r?.samples ?? [])
        .map((s: any) => s?.beatsPerMinute)
        .filter((b: any) => typeof b === 'number');
      return bpms.length ? bpms : null;
    } catch {
      return null;
    }
  },
  async getLatestHeartRate() {
    try {
      const hc = require('react-native-health-connect');
      await hc.initialize();
      const end = new Date();
      const start = new Date(end.getTime() - 2 * 60 * 1000);
      const res = await hc.readRecords('HeartRate', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      const samples = (res?.records ?? [])
        .flatMap((r: any) => r?.samples ?? [])
        .filter((s: any) => typeof s?.beatsPerMinute === 'number');
      if (!samples.length) return null;
      // Newest by timestamp.
      samples.sort((a: any, b: any) => new Date(a.time ?? 0).getTime() - new Date(b.time ?? 0).getTime());
      return Math.round(samples[samples.length - 1].beatsPerMinute);
    } catch {
      return null;
    }
  },
};

export const health: HealthService =
  Platform.OS === 'ios' ? appleHealth : Platform.OS === 'android' ? androidHealth : unavailable;

export const healthPlatformLabel =
  Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'Health';
