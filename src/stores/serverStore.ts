import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Optional self-hosted server. Null by default — the app is fully local-first.
 * When the user points this at their own Hale Hub add-on (for backup + Home
 * Assistant / MCP access), snapshot sync (`lib/sync.ts`) activates.
 */
interface ServerState {
  serverUrl: string | null; // e.g. 'http://homeassistant.local:8126'
  accessToken: string | null; // bearer token — the Hale Hub add-on's api_token (or a server JWT)
  lastSyncedAt: string | null; // ISO of the last successful upload (for display)
  setServer: (url: string, token: string) => void;
  setServerToken: (token: string) => void;
  setSynced: (at: string) => void;
  clearServer: () => void;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set) => ({
      serverUrl: null,
      accessToken: null,
      lastSyncedAt: null,
      setServer: (serverUrl, accessToken) => set({ serverUrl, accessToken }),
      setServerToken: (accessToken) => set({ accessToken }),
      setSynced: (lastSyncedAt) => set({ lastSyncedAt }),
      clearServer: () => set({ serverUrl: null, accessToken: null, lastSyncedAt: null }),
    }),
    {
      name: 'fitself-server',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
