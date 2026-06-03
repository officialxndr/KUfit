import * as Crypto from 'expo-crypto';
import { db } from '@/lib/db';

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  title: string;
  body: string | null;
  steps: string | null;
  diagnostics: string | null;
  status: 'draft' | 'sent';
  createdAt: string;
}

function map(row: any): FeedbackEntry {
  return {
    id: row.localId,
    type: row.type as FeedbackType,
    title: row.title,
    body: row.body ?? null,
    steps: row.steps ?? null,
    diagnostics: row.diagnostics ?? null,
    status: (row.status ?? 'draft') as 'draft' | 'sent',
    createdAt: row.createdAt,
  };
}

/**
 * Local store of bug reports / feature requests. Submissions are saved here (so the
 * user keeps a history and can re-send) and delivered by email — there's no server.
 * The `serverId`/`syncStatus` columns leave the door open for a future community
 * board that syncs and lets people upvote ideas.
 */
export class FeedbackRepo {
  create(input: {
    type: FeedbackType; title: string;
    body?: string | null; steps?: string | null; diagnostics?: string | null;
    status?: 'draft' | 'sent';
  }): string {
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    db.runSync(
      `INSERT INTO feedback (localId, syncStatus, type, title, body, steps, diagnostics, status, createdAt, updatedAt)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.type, input.title.trim(), input.body ?? null, input.steps ?? null, input.diagnostics ?? null, input.status ?? 'draft', now, now]
    );
    return id;
  }

  markSent(id: string): void {
    db.runSync(`UPDATE feedback SET status = 'sent', syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), id]);
  }

  list(): FeedbackEntry[] {
    return (db.getAllSync(`SELECT * FROM feedback WHERE deleted = 0 ORDER BY createdAt DESC`) as any[]).map(map);
  }

  remove(id: string): void {
    db.runSync(`UPDATE feedback SET deleted = 1, syncStatus = 'pending', updatedAt = ? WHERE localId = ?`,
      [new Date().toISOString(), id]);
  }
}

export const feedbackRepo = new FeedbackRepo();
