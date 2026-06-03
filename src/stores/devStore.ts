import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hidden developer mode. Off by default and never shown in the UI until unlocked
 * by tapping the version footer in Settings 7×. Gates the Developer card
 * (sample-data seeder / clear). Persisted so it stays unlocked between launches;
 * turn it back off from the Developer card.
 */
interface DevState {
  devMode: boolean;
  setDevMode: (on: boolean) => void;
}

export const useDevStore = create<DevState>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (on) => set({ devMode: on }),
    }),
    { name: 'fitself-dev', storage: createJSONStorage(() => AsyncStorage) }
  )
);
