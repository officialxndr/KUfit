import { useServerStore } from '@/stores/serverStore';
import { exportData, importData } from '@/lib/backup';

/**
 * Optional server backup/sync. The app is local-first; this only does anything
 * when the user points it at their own Hale Hub add-on (serverStore.serverUrl).
 *
 * The model is **snapshot sync** (reusing the tested backup.ts):
 *   - `syncNow()` is **upload-only** — it `exportData()`s the local DB (a pure read)
 *     and POSTs it to the hub. It NEVER writes the phone DB, so it can't wipe progress.
 *   - `restoreFromServer()` is the only write-back path (explicit, confirmation-gated
 *     in Settings); it pulls the hub's snapshot and `importData()`s it.
 * See the `hale-mcp-addon` repo for the hub side.
 */

export interface SyncResult {
  ok: boolean;
  message: string;
}

const normalize = (url: string) => url.trim().replace(/\/+$/, '');

const authHeaders = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};

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

/**
 * Push the full on-device snapshot to the hub. UPLOAD ONLY — reads the local DB via
 * `exportData()` and POSTs it; nothing here writes the phone's database.
 */
export async function syncNow(): Promise<SyncResult> {
  const { serverUrl, accessToken, setSynced } = useServerStore.getState();
  if (!serverUrl) return { ok: false, message: 'No server configured.' };
  try {
    const json = exportData(); // pure read of the local DB
    const res = await fetch(`${normalize(serverUrl)}/sync/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: json,
    });
    if (!res.ok) {
      return {
        ok: false,
        message: res.status === 401 ? 'Unauthorized — check the access token.' : `Server responded ${res.status}.`,
      };
    }
    setSynced(new Date().toISOString());
    return { ok: true, message: 'Synced to server.' };
  } catch (e: any) {
    return { ok: false, message: e?.message ? `Sync failed: ${e.message}` : 'Sync failed.' };
  }
}

/**
 * Pull the hub's latest snapshot and apply it to this device. This is the ONLY path
 * that writes the local DB, so it's reserved for an explicit, confirmed Settings action.
 * `merge` adds missing records (safe); `replace` overwrites everything (destructive).
 */
export async function restoreFromServer(mode: 'replace' | 'merge'): Promise<SyncResult> {
  const { serverUrl, accessToken } = useServerStore.getState();
  if (!serverUrl) return { ok: false, message: 'No server configured.' };
  try {
    const res = await fetch(`${normalize(serverUrl)}/sync/snapshot`, { headers: authHeaders(accessToken) });
    if (res.status === 404) return { ok: false, message: 'The server has no snapshot yet — sync from this phone first.' };
    if (!res.ok) {
      return {
        ok: false,
        message: res.status === 401 ? 'Unauthorized — check the access token.' : `Server responded ${res.status}.`,
      };
    }
    const json = await res.json();
    importData(json, mode);
    return { ok: true, message: mode === 'replace' ? 'Restored from server.' : 'Merged from server.' };
  } catch (e: any) {
    return { ok: false, message: e?.message ? `Restore failed: ${e.message}` : 'Restore failed.' };
  }
}
