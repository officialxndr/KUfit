import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';
import type { BodyMeasurement, GoalPhase, GoalType, HealthStats, WeightEntry } from '@/types';
import { todayLocal, longDate } from '@/lib/date';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapWeightEntry(row: any): WeightEntry {
  return {
    id: row.localId,
    date: row.date,
    weightKg: row.weightKg,
    bodyFat: row.bodyFat ?? null,
    boneMassKg: row.boneMassKg ?? null,
    visceralFatKg: row.visceralFatKg ?? null,
    boneTScore: row.boneTScore ?? null,
    photoUri: row.photoUri ?? null,
    source: row.source ?? 'MANUAL',
    createdAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function mapMeasurement(row: any): BodyMeasurement {
  return {
    id: row.localId,
    date: row.date,
    neck: row.neck ?? null,
    shoulders: row.shoulders ?? null,
    chest: row.chest ?? null,
    leftArm: row.leftArm ?? null,
    rightArm: row.rightArm ?? null,
    waist: row.waist ?? null,
    hips: row.hips ?? null,
    leftThigh: row.leftThigh ?? null,
    rightThigh: row.rightThigh ?? null,
    leftCalf: row.leftCalf ?? null,
    rightCalf: row.rightCalf ?? null,
    notes: row.notes ?? null,
    createdAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function mapGoalPhase(row: any): GoalPhase {
  return {
    id: row.localId,
    name: row.name,
    goalType: row.goalType as GoalType,
    startDate: row.startDate,
    endDate: row.endDate,
    targetWeightKg: row.targetWeightKg ?? null,
    targetBodyFat: row.targetBodyFat ?? null,
    weeklyRateKg: row.weeklyRateKg ?? null,
    calorieTarget: row.calorieTarget ?? null,
    proteinTarget: row.proteinTarget ?? null,
    carbsTarget: row.carbsTarget ?? null,
    fatTarget: row.fatTarget ?? null,
    cycleId: row.cycleId ?? null,
  };
}

// ── Repository ────────────────────────────────────────────────────────────────

export class HealthRepo {

  // ── Weight entries ──────────────────────────────────────────────────────────

  getWeightEntries(from: string, to: string): WeightEntry[] {
    return (db.getAllSync(
      `SELECT * FROM weight_entries
       WHERE date >= ? AND date <= ? AND deleted = 0
       ORDER BY date ASC`,
      [from, to]
    ) as any[]).map(mapWeightEntry);
  }

  getLatestWeightEntry(): WeightEntry | null {
    const row = db.getFirstSync(
      `SELECT * FROM weight_entries WHERE deleted = 0 ORDER BY date DESC LIMIT 1`
    );
    return row ? mapWeightEntry(row as any) : null;
  }

  getWeightEntryByDate(date: string): WeightEntry | null {
    const row = db.getFirstSync(
      `SELECT * FROM weight_entries WHERE date = ? AND deleted = 0`, [date]
    );
    return row ? mapWeightEntry(row as any) : null;
  }

  /**
   * Edit an existing weigh-in's weight + body-fat % in place, preserving its DEXA compartments.
   * Pass `bodyFat = null` to clear just the body-fat reading while keeping the weigh-in. A
   * `HEALTH`-sourced row is **promoted to `MANUAL`** so the edit is user-owned — otherwise the
   * next Health import would silently overwrite the correction (DEXA stays DEXA).
   */
  updateWeightEntryValues(localId: string, weightKg: number, bodyFat: number | null): void {
    db.runSync(
      `UPDATE weight_entries
         SET weightKg = ?, bodyFat = ?,
             source = CASE WHEN source = 'HEALTH' THEN 'MANUAL' ELSE source END,
             syncStatus = 'pending', updatedAt = ?
       WHERE localId = ?`,
      [weightKg, bodyFat, new Date().toISOString(), localId]
    );
  }

  /** Attach (or clear, with null) a progress-photo filename on a weigh-in. Doesn't re-own a
   *  HEALTH-sourced entry (a photo isn't a weight edit), so re-imports keep the photo. */
  setWeightPhoto(localId: string, photoUri: string | null): void {
    db.runSync(
      `UPDATE weight_entries SET photoUri = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [photoUri, new Date().toISOString(), localId]
    );
  }

  /** Weigh-ins that have a progress photo, newest first — for the compare picker. */
  getWeighInsWithPhotos(): WeightEntry[] {
    return (db.getAllSync(
      `SELECT * FROM weight_entries WHERE photoUri IS NOT NULL AND deleted = 0 ORDER BY date DESC`
    ) as any[]).map(mapWeightEntry);
  }

  /** Most recent entry that has a *measured* body-fat % — the baseline for estimates. */
  getLatestBodyFatBaseline(): WeightEntry | null {
    const row = db.getFirstSync(
      `SELECT * FROM weight_entries WHERE deleted = 0 AND bodyFat IS NOT NULL ORDER BY date DESC LIMIT 1`
    );
    return row ? mapWeightEntry(row as any) : null;
  }

  /** Most recent weigh-in carrying DEXA data — anchors the 3-compartment body view. */
  getLatestDexa(): WeightEntry | null {
    const row = db.getFirstSync(
      `SELECT * FROM weight_entries
       WHERE deleted = 0 AND (source = 'DEXA' OR boneMassKg IS NOT NULL OR visceralFatKg IS NOT NULL OR boneTScore IS NOT NULL)
       ORDER BY date DESC LIMIT 1`
    );
    return row ? mapWeightEntry(row as any) : null;
  }

  /** Date (YYYY-MM-DD) of the most recent weigh-in that came from the health store, or
   *  null. Used to bound the incremental Apple Health / Health Connect read. */
  getLatestHealthWeightDate(): string | null {
    const row = db.getFirstSync(
      `SELECT date FROM weight_entries WHERE deleted = 0 AND source = 'HEALTH' ORDER BY date DESC LIMIT 1`
    ) as any;
    return row?.date ?? null;
  }

  /**
   * Import one weigh-in from Apple Health / Health Connect (source `'HEALTH'`). Upserts on
   * `date` but **never clobbers a hand-logged entry**: inserts when the day is empty, and only
   * refreshes an existing row when it is itself `'HEALTH'`-sourced (so a value edited in Health
   * propagates). A MANUAL/DEXA entry — or a day the user soft-deleted — is left untouched so
   * auto-import can't undo the user's own edits. Returns true when a row was inserted/changed.
   */
  upsertWeightFromHealth(date: string, weightKg: number): boolean {
    const existing = db.getFirstSync(
      `SELECT localId, weightKg, source, deleted FROM weight_entries WHERE date = ?`, [date]
    ) as any;
    if (!existing) {
      db.runSync(
        `INSERT INTO weight_entries (localId, date, weightKg, source, syncStatus, updatedAt)
         VALUES (?, ?, ?, 'HEALTH', 'pending', ?)`,
        [Crypto.randomUUID(), date, weightKg, new Date().toISOString()]
      );
      return true;
    }
    // Respect a deletion (don't resurrect) and never overwrite a hand-logged entry.
    if (existing.deleted || existing.source !== 'HEALTH') return false;
    if (Math.abs((existing.weightKg ?? 0) - weightKg) < 1e-6) return false; // unchanged
    db.runSync(
      `UPDATE weight_entries SET weightKg = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [weightKg, new Date().toISOString(), existing.localId]
    );
    return true;
  }

  /**
   * Attach a body-fat % imported from the health store to that day's weigh-in. Only ever
   * touches a `'HEALTH'`-sourced, non-deleted entry (so a DEXA/hand-logged reading is never
   * overwritten) and only when a weigh-in exists for the day (body fat has nowhere to live
   * otherwise). Returns true when a value was set/changed. Opt-in — see `lib/healthSync.ts`.
   */
  upsertBodyFatFromHealth(date: string, bodyFat: number): boolean {
    const existing = db.getFirstSync(
      `SELECT localId, bodyFat, source, deleted FROM weight_entries WHERE date = ?`, [date]
    ) as any;
    if (!existing || existing.deleted || existing.source !== 'HEALTH') return false;
    if (existing.bodyFat != null && Math.abs(existing.bodyFat - bodyFat) < 1e-6) return false; // unchanged
    db.runSync(
      `UPDATE weight_entries SET bodyFat = ?, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [bodyFat, new Date().toISOString(), existing.localId]
    );
    return true;
  }

  upsertWeightEntry(date: string, weightKg: number, bodyFat?: number, source = 'MANUAL'): void {
    const existing = db.getFirstSync(
      `SELECT localId FROM weight_entries WHERE date = ?`, [date]
    ) as any;
    if (existing) {
      // `deleted = 0` revives a soft-deleted day so deleting then re-logging the same date
      // isn't silently swallowed (the row is UNIQUE per date, so we can't INSERT a fresh one).
      db.runSync(
        `UPDATE weight_entries SET weightKg = ?, bodyFat = ?, source = ?, deleted = 0, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
        [weightKg, bodyFat ?? null, source, new Date().toISOString(), existing.localId]
      );
    } else {
      db.runSync(
        `INSERT INTO weight_entries (localId, date, weightKg, bodyFat, source, syncStatus, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [Crypto.randomUUID(), date, weightKg, bodyFat ?? null, source, new Date().toISOString()]
      );
    }
  }

  /**
   * Log a DEXA scan as a weigh-in carrying the scan's extra compartments (bone mass,
   * visceral fat, T-score) alongside body fat %. Upserts on `date`, marks source 'DEXA'.
   * Unlike `upsertWeightEntry` (which leaves the DEXA columns untouched), this writes them.
   */
  logDexaScan(input: {
    date: string; weightKg: number; bodyFat?: number | null;
    boneMassKg?: number | null; visceralFatKg?: number | null; boneTScore?: number | null;
  }): void {
    const { date, weightKg, bodyFat, boneMassKg, visceralFatKg, boneTScore } = input;
    const now = new Date().toISOString();
    const existing = db.getFirstSync(`SELECT localId FROM weight_entries WHERE date = ?`, [date]) as any;
    if (existing) {
      db.runSync(
        `UPDATE weight_entries SET weightKg = ?, bodyFat = ?, boneMassKg = ?, visceralFatKg = ?, boneTScore = ?,
                source = 'DEXA', deleted = 0, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
        [weightKg, bodyFat ?? null, boneMassKg ?? null, visceralFatKg ?? null, boneTScore ?? null, now, existing.localId]
      );
    } else {
      db.runSync(
        `INSERT INTO weight_entries (localId, date, weightKg, bodyFat, boneMassKg, visceralFatKg, boneTScore, source, syncStatus, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'DEXA', 'pending', ?)`,
        [Crypto.randomUUID(), date, weightKg, bodyFat ?? null, boneMassKg ?? null, visceralFatKg ?? null, boneTScore ?? null, now]
      );
    }
  }

  deleteWeightEntry(localId: string): void {
    // Also clear photoUri: the file is deleted at the call site, and re-logging this date revives the
    // row (upsertWeightEntry deleted=0) — a lingering filename would resurface as a dangling photo ref.
    db.runSync(
      `UPDATE weight_entries SET deleted = 1, photoUri = NULL, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  /** Hard-wipe all weigh-ins / measurements (used by the demo-data tool). */
  clearAllWeightEntries(): void {
    db.runSync(`DELETE FROM weight_entries`);
  }
  clearAllMeasurements(): void {
    db.runSync(`DELETE FROM body_measurements`);
  }

  upsertWeightEntryFromServer(entry: WeightEntry): void {
    const existing = db.getFirstSync(
      `SELECT localId FROM weight_entries WHERE serverId = ? OR date = ?`,
      [entry.id, entry.date]
    ) as any;
    if (existing) {
      db.runSync(
        `UPDATE weight_entries SET serverId = ?, weightKg = ?, bodyFat = ?, syncStatus = 'synced', updatedAt = ? WHERE localId = ?`,
        [entry.id, entry.weightKg, entry.bodyFat ?? null, entry.createdAt, existing.localId]
      );
    } else {
      db.runSync(
        `INSERT INTO weight_entries (localId, serverId, date, weightKg, bodyFat, source, syncStatus, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [Crypto.randomUUID(), entry.id, entry.date, entry.weightKg, entry.bodyFat ?? null, entry.source, entry.createdAt]
      );
    }
  }

  // ── Local health stats calculation ──────────────────────────────────────────

  computeStats(goalWeightKg?: number | null, goalDate?: string | null): HealthStats {
    const ninety = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const today = todayLocal();
    const entries = this.getWeightEntries(ninety, today);
    const current = entries.length > 0 ? entries[entries.length - 1] : null;

    // 7-day and 14-day averages
    const last7 = entries.slice(-7);
    const prev7 = entries.slice(-14, -7);
    const avg7 = last7.length > 0 ? last7.reduce((s, e) => s + e.weightKg, 0) / last7.length : null;
    const avg14 = prev7.length > 0 ? prev7.reduce((s, e) => s + e.weightKg, 0) / prev7.length : null;
    const weeklyChange = avg7 !== null && avg14 !== null ? avg7 - avg14 : null;

    // Goal ETA
    let goalEta: string | null = null;
    let requiredWeeklyRate: number | null = null;
    let onTrack = false;
    let dailyCalorieDelta: number | null = null;

    if (goalWeightKg != null && current && weeklyChange !== null && weeklyChange !== 0) {
      const weeksNeeded = (current.weightKg - goalWeightKg) / Math.abs(weeklyChange);
      const etaDate = new Date(Date.now() + weeksNeeded * 7 * 86400000);
      goalEta = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (goalWeightKg != null && goalDate != null && current) {
      const weeksUntilGoal = (new Date(goalDate).getTime() - Date.now()) / (7 * 86400000);
      if (weeksUntilGoal > 0) {
        // `requiredWeeklyRate` is signed as (current − goal): positive when you need to
        // lose, negative when you need to gain. The *desired* weeklyChange is therefore
        // its negation, so the gap (how much more deficit/surplus is needed) is the sum,
        // not the difference. Positive gap ⇒ eat less, negative ⇒ eat more.
        requiredWeeklyRate = (current.weightKg - goalWeightKg) / weeksUntilGoal;
        const rateGap = requiredWeeklyRate + (weeklyChange ?? 0);
        dailyCalorieDelta = Math.round((rateGap * 7700) / 7);
        onTrack = Math.abs(rateGap) < 0.1;
      }
    }

    // 7-day calorie average from food_logs
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const calRow = db.getFirstSync(
      `SELECT AVG(day_cal) AS avg FROM (
         SELECT fl.date, SUM(fi.calories * fl.servingQty) AS day_cal
         FROM food_logs fl
         LEFT JOIN food_items fi ON fl.foodItemLocalId = fi.localId
         WHERE fl.date >= ? AND fl.date <= ? AND fl.deleted = 0
         GROUP BY fl.date
       )`,
      [sevenDaysAgo, today]
    ) as any;

    return {
      current,
      avg7,
      avg14,
      weeklyChange,
      goalEta,
      goalTargetDate: goalDate ? longDate(goalDate) : null,
      etaReason: !current ? 'no-trend' : null,
      requiredWeeklyRate,
      dailyCalorieDelta,
      onTrack,
      calorieAvg7: calRow?.avg ?? null,
      entries,
    };
  }

  // ── Body Measurements ───────────────────────────────────────────────────────

  getMeasurements(): BodyMeasurement[] {
    return (db.getAllSync(
      `SELECT * FROM body_measurements WHERE deleted = 0 ORDER BY date DESC`
    ) as any[]).map(mapMeasurement);
  }

  /**
   * A synthetic snapshot using the **most recent non-null value for each site**.
   * Sites are often logged across different days/rows (e.g. waist+neck one day,
   * chest another), so the single newest row may be missing the parts a consumer
   * needs (e.g. the U.S. Navy body-fat estimate needs waist+neck together). This
   * coalesces history into one complete-as-possible reading. Returns null if there
   * are no measurements. `id`/`date` carry the newest row's values.
   */
  getLatestMeasurementBySite(): BodyMeasurement | null {
    const rows = this.getMeasurements(); // newest first
    if (!rows.length) return null;
    const sites: (keyof BodyMeasurement)[] = [
      'neck', 'shoulders', 'chest', 'leftArm', 'rightArm', 'waist',
      'hips', 'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf',
    ];
    const merged: BodyMeasurement = { ...rows[0] };
    for (const site of sites) {
      if (merged[site] == null) {
        const found = rows.find((r) => r[site] != null);
        if (found) (merged as unknown as Record<string, unknown>)[site as string] = found[site];
      }
    }
    return merged;
  }

  addMeasurement(data: Partial<Omit<BodyMeasurement, 'id' | 'createdAt'>> & { date: string }): void {
    db.runSync(
      `INSERT INTO body_measurements
         (localId, date, neck, shoulders, chest, leftArm, rightArm,
          waist, hips, leftThigh, rightThigh, leftCalf, rightCalf, notes, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        Crypto.randomUUID(),
        data.date,
        data.neck ?? null, data.shoulders ?? null, data.chest ?? null,
        data.leftArm ?? null, data.rightArm ?? null,
        data.waist ?? null, data.hips ?? null,
        data.leftThigh ?? null, data.rightThigh ?? null,
        data.leftCalf ?? null, data.rightCalf ?? null,
        data.notes ?? null,
        new Date().toISOString(),
      ]
    );
  }

  /**
   * Save a single site into the day's snapshot (used by the tape-measure flow): patches
   * today's existing measurement if there is one, else creates it. Keeps one snapshot
   * per day rather than a row per body part.
   */
  upsertMeasurementSite(date: string, site: keyof BodyMeasurement, cm: number): void {
    const existing = db.getFirstSync(
      `SELECT localId FROM body_measurements WHERE date = ? AND deleted = 0 ORDER BY updatedAt DESC LIMIT 1`,
      [date]
    ) as any;
    if (existing) this.updateMeasurement(existing.localId, { [site as string]: cm });
    else this.addMeasurement({ date, [site]: cm } as Partial<Omit<BodyMeasurement, 'id' | 'createdAt'>> & { date: string });
  }

  /** Patch individual sites (or notes/date) on a measurement; pass null to clear a site. */
  updateMeasurement(localId: string, patch: Record<string, number | string | null>): void {
    const allowed = new Set(['neck', 'shoulders', 'chest', 'leftArm', 'rightArm', 'waist', 'hips', 'leftThigh', 'rightThigh', 'leftCalf', 'rightCalf', 'notes', 'date']);
    const keys = Object.keys(patch).filter((k) => allowed.has(k));
    if (!keys.length) return;
    const setSql = keys.map((k) => `${k} = ?`).join(', ');
    const vals = keys.map((k) => patch[k] ?? null);
    db.runSync(
      `UPDATE body_measurements SET ${setSql}, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [...vals, new Date().toISOString(), localId]
    );
  }

  deleteMeasurement(localId: string): void {
    db.runSync(
      `UPDATE body_measurements SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  upsertMeasurementFromServer(m: BodyMeasurement): void {
    const existing = db.getFirstSync(
      `SELECT localId FROM body_measurements WHERE serverId = ?`, [m.id]
    ) as any;
    const localId = existing?.localId ?? Crypto.randomUUID();
    db.runSync(
      `INSERT OR REPLACE INTO body_measurements
         (localId, serverId, date, neck, shoulders, chest, leftArm, rightArm,
          waist, hips, leftThigh, rightThigh, leftCalf, rightCalf, notes, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        localId, m.id, m.date,
        m.neck ?? null, m.shoulders ?? null, m.chest ?? null,
        m.leftArm ?? null, m.rightArm ?? null,
        m.waist ?? null, m.hips ?? null,
        m.leftThigh ?? null, m.rightThigh ?? null,
        m.leftCalf ?? null, m.rightCalf ?? null,
        m.notes ?? null, m.createdAt,
      ]
    );
  }

  // ── Goal Phases ─────────────────────────────────────────────────────────────

  getGoalPhases(): GoalPhase[] {
    return (db.getAllSync(
      `SELECT * FROM goal_phases WHERE deleted = 0 ORDER BY startDate ASC`
    ) as any[]).map(mapGoalPhase);
  }

  getActiveGoalPhase(): GoalPhase | null {
    const today = todayLocal();
    const row = db.getFirstSync(
      `SELECT * FROM goal_phases WHERE deleted = 0 AND startDate <= ? AND endDate >= ? LIMIT 1`,
      [today, today]
    );
    return row ? mapGoalPhase(row as any) : null;
  }

  saveGoalPhase(phase: Omit<GoalPhase, 'id'>): string {
    const localId = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO goal_phases
         (localId, name, goalType, startDate, endDate, targetWeightKg, targetBodyFat,
          weeklyRateKg, calorieTarget, proteinTarget, carbsTarget, fatTarget, cycleId, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        localId, phase.name, phase.goalType, phase.startDate, phase.endDate,
        phase.targetWeightKg ?? null, phase.targetBodyFat ?? null,
        phase.weeklyRateKg ?? null, phase.calorieTarget ?? null,
        phase.proteinTarget ?? null, phase.carbsTarget ?? null, phase.fatTarget ?? null,
        phase.cycleId ?? null,
        new Date().toISOString(),
      ]
    );
    return localId;
  }

  deleteGoalPhase(localId: string): void {
    db.runSync(
      `UPDATE goal_phases SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  upsertGoalPhaseFromServer(phase: GoalPhase): void {
    const existing = db.getFirstSync(
      `SELECT localId FROM goal_phases WHERE serverId = ?`, [phase.id]
    ) as any;
    const localId = existing?.localId ?? Crypto.randomUUID();
    db.runSync(
      `INSERT OR REPLACE INTO goal_phases
         (localId, serverId, name, goalType, startDate, endDate, targetWeightKg, targetBodyFat,
          weeklyRateKg, calorieTarget, proteinTarget, carbsTarget, fatTarget, cycleId, syncStatus, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
      [
        localId, phase.id, phase.name, phase.goalType, phase.startDate, phase.endDate,
        phase.targetWeightKg ?? null, phase.targetBodyFat ?? null,
        phase.weeklyRateKg ?? null, phase.calorieTarget ?? null,
        phase.proteinTarget ?? null, phase.carbsTarget ?? null, phase.fatTarget ?? null,
        phase.cycleId ?? null, new Date().toISOString(),
      ]
    );
  }
}

export const healthRepo = new HealthRepo();
