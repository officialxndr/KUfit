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

export interface HealthService {
  isAvailable(): boolean;
  requestPermissions(): Promise<boolean>;
  getLatestWeight(): Promise<WeightReading | null>;
  /** All weight readings (full history) for a one-time backfill. */
  getAllWeights(): Promise<WeightReading[]>;
  /**
   * Total active energy burned (kcal) in the given window — e.g. a workout's
   * start→finish. Returns `null` when no data is available (no watch / not
   * authorized), so callers can fall back to a time-based estimate.
   */
  getActiveEnergyBurned(startIso: string, endIso: string): Promise<number | null>;
}

const isoDay = (d: string | number | Date) => new Date(d).toISOString().slice(0, 10);

const unavailable: HealthService = {
  isAvailable: () => false,
  requestPermissions: async () => false,
  getLatestWeight: async () => null,
  getAllWeights: async () => [],
  getActiveEnergyBurned: async () => null,
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
          'HKQuantityTypeIdentifierStepCount',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
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
  async getActiveEnergyBurned(startIso, endIso) {
    try {
      const hk = require('@kingstinct/react-native-healthkit');
      const samples = await hk.queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', {
        unit: 'kcal',
        from: new Date(startIso),
        to: new Date(endIso),
        limit: 10000,
      });
      const arr = (samples ?? []).filter((s: any) => typeof s?.quantity === 'number');
      if (!arr.length) return null;
      return arr.reduce((sum: number, s: any) => sum + s.quantity, 0);
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
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
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
};

export const health: HealthService =
  Platform.OS === 'ios' ? appleHealth : Platform.OS === 'android' ? androidHealth : unavailable;

export const healthPlatformLabel =
  Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'Health';
