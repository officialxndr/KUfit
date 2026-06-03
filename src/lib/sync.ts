import { useServerStore } from '@/stores/serverStore';

/**
 * Optional server backup/sync. The app is local-first; this only does anything
 * when the user points it at their own Hale server (serverStore.serverUrl).
 *
 * Status: connection testing is implemented. The full bidirectional push/pull
 * engine is intentionally a stub here — it must match the `apps/api` route
 * contract and be validated against a running server (tracked in ROADMAP).
 * The SQLite schema already carries localId/serverId/syncStatus to support it.
 */

export interface SyncResult {
  ok: boolean;
  message: string;
}

const normalize = (url: string) => url.trim().replace(/\/+$/, '');

/** Ping the server's health endpoint to validate URL + reachability. */
export async function testServerConnection(url: string): Promise<SyncResult> {
  if (!url.trim()) return { ok: false, message: 'Enter a server URL first.' };
  try {
    const res = await fetch(`${normalize(url)}/health`, { method: 'GET' });
    if (res.ok) return { ok: true, message: 'Connected to server.' };
    return { ok: false, message: `Server responded ${res.status}.` };
  } catch (e: any) {
    return { ok: false, message: e?.message ? `Could not reach server: ${e.message}` : 'Could not reach server.' };
  }
}

/** Placeholder for the full sync engine — see module docs. */
export async function syncNow(): Promise<SyncResult> {
  const { serverUrl } = useServerStore.getState();
  if (!serverUrl) return { ok: false, message: 'No server configured.' };
  return { ok: false, message: 'Sync engine is not implemented yet (connection only).' };
}
