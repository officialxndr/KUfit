import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Optional self-hosted server. Null by default — the app is fully local-first.
 * When the user points this at their own FitSelf server (for backup + Home
 * Assistant automations), the sync engine activates.
 */
interface ServerState {
  serverUrl: string | null; // e.g. 'http://192.168.1.10:3001'
  accessToken: string | null; // JWT from server login
  setServer: (url: string, token: string) => void;
  setServerToken: (token: string) => void;
  clearServer: () => void;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set) => ({
      serverUrl: null,
      accessToken: null,
      setServer: (serverUrl, accessToken) => set({ serverUrl, accessToken }),
      setServerToken: (accessToken) => set({ accessToken }),
      clearServer: () => set({ serverUrl: null, accessToken: null }),
    }),
    {
      name: 'fitself-server',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
