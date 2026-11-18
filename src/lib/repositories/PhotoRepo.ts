import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';
import { isPose, type Pose, type ProgressPhoto } from '@/lib/photoTimeline';

function mapPhoto(row: any): ProgressPhoto {
  return {
    id: row.localId,
    date: row.date,
    pose: isPose(row.pose) ? row.pose : 'front',
    fileName: row.fileName,
    createdAt: row.createdAt ?? row.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Progress photos — one per (date, pose). The repo stores only the file's basename; resolve it
 * with `resolveProgressPhotoUri` at display time. Methods that drop a row return the replaced /
 * removed file name so the caller can delete the file (`deleteProgressPhoto`).
 */
export class PhotoRepo {
  /** All photos, newest day first. */
  list(): ProgressPhoto[] {
    return (db.getAllSync(
      `SELECT * FROM progress_photos WHERE deleted = 0 ORDER BY date DESC, createdAt DESC`
    ) as any[]).map(mapPhoto);
  }

  forDate(date: string): ProgressPhoto[] {
    return (db.getAllSync(
      `SELECT * FROM progress_photos WHERE date = ? AND deleted = 0`, [date]
    ) as any[]).map(mapPhoto);
  }

  get(id: string): ProgressPhoto | null {
    const row = db.getFirstSync(`SELECT * FROM progress_photos WHERE localId = ? AND deleted = 0`, [id]);
    return row ? mapPhoto(row) : null;
  }

  /** Date of the most recent photo (any pose) — drives the photo reminder. */
  latestDate(): string | null {
    const row = db.getFirstSync(`SELECT MAX(date) AS d FROM progress_photos WHERE deleted = 0`) as { d: string | null } | null;
    return row?.d ?? null;
  }

  /**
   * Save a photo for (date, pose), replacing that slot if it's already taken (a retake).
   * Returns the new photo's id + the replaced file name (or null) for the caller to delete.
   */
  upsert(date: string, pose: Pose, fileName: string): { id: string; replacedFile: string | null } {
    const now = new Date().toISOString();
    const existing = db.getFirstSync(
      `SELECT localId, fileName FROM progress_photos WHERE date = ? AND pose = ? AND deleted = 0`, [date, pose]
    ) as { localId: string; fileName: string } | null;
    if (existing) {
      db.runSync(
        `UPDATE progress_photos SET fileName = ?, createdAt = ?, updatedAt = ?, syncStatus = 'pending' WHERE localId = ?`,
        [fileName, now, now, existing.localId]
      );
      return { id: existing.localId, replacedFile: existing.fileName === fileName ? null : existing.fileName };
    }
    const id = Crypto.randomUUID();
    db.runSync(
      `INSERT INTO progress_photos (localId, date, pose, fileName, createdAt, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, date, pose, fileName, now, now]
    );
    return { id, replacedFile: null };
  }

  /** Soft-delete a photo; returns its file name so the caller can remove the file. */
  remove(id: string): string | null {
    const row = db.getFirstSync(`SELECT fileName FROM progress_photos WHERE localId = ?`, [id]) as { fileName: string } | null;
    db.runSync(
      `UPDATE progress_photos SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), id]
    );
    return row?.fileName ?? null;
  }

  /** Hard-wipe (full data wipe / demo clear). */
  clearAll(): void {
    db.runSync(`DELETE FROM progress_photos`);
  }
}

export const photoRepo = new PhotoRepo();
