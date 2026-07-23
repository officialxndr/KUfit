import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';

/**
 * Optional daily water-intake tracking. One row per quick-add increment (mirrors `food_logs`),
 * summed per calendar day. Amounts are stored in **ml** (metric); the UI converts to fl oz at the
 * display edge (`lib/units.ts`). Gated by `profile.trackWater` — nothing reads this when off.
 * Standard syncable/soft-deletable conventions: `localId`, `syncStatus='pending'`, `deleted`.
 */
class WaterRepo {
  /** Add a water entry (ml) for a calendar day (`YYYY-MM-DD`). */
  addWater(date: string, amountMl: number): void {
    if (!(amountMl > 0)) return;
    db.runSync(
      `INSERT INTO water_logs (localId, date, amountMl, syncStatus, updatedAt)
       VALUES (?, ?, ?, 'pending', ?)`,
      [Crypto.randomUUID(), date, amountMl, new Date().toISOString()]
    );
  }

  /** Total ml logged for a day. */
  getWaterTotal(date: string): number {
    const row = db.getFirstSync(
      `SELECT COALESCE(SUM(amountMl), 0) AS ml FROM water_logs WHERE date = ? AND deleted = 0`,
      [date]
    ) as { ml: number } | null;
    return row?.ml ?? 0;
  }

  /** Entries for a day, newest first — for an undo/history list. */
  getDayLogs(date: string): { id: string; amountMl: number }[] {
    const rows = db.getAllSync(
      `SELECT localId, amountMl FROM water_logs WHERE date = ? AND deleted = 0 ORDER BY updatedAt DESC, rowid DESC`,
      [date]
    ) as { localId: string; amountMl: number }[];
    return rows.map((r) => ({ id: r.localId, amountMl: r.amountMl }));
  }

  /** Soft-delete a water entry. */
  deleteWater(localId: string): void {
    db.runSync(
      `UPDATE water_logs SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), localId]
    );
  }

  /** Undo: remove the most recent entry for a day. Returns true if one was removed. */
  deleteLastWater(date: string): boolean {
    const row = db.getFirstSync(
      `SELECT localId FROM water_logs WHERE date = ? AND deleted = 0 ORDER BY updatedAt DESC, rowid DESC LIMIT 1`,
      [date]
    ) as { localId: string } | null;
    if (!row) return false;
    this.deleteWater(row.localId);
    return true;
  }

  /** Per-day totals over a date range (for trends/streaks). */
  getDailyWater(from: string, to: string): { date: string; ml: number }[] {
    return db.getAllSync(
      `SELECT date, COALESCE(SUM(amountMl), 0) AS ml FROM water_logs
       WHERE date >= ? AND date <= ? AND deleted = 0 GROUP BY date ORDER BY date`,
      [from, to]
    ) as { date: string; ml: number }[];
  }

  /** Hard-wipe (demo/data-reset only). */
  clearAllWater(): void {
    db.runSync(`DELETE FROM water_logs`);
  }
}

export const waterRepo = new WaterRepo();
