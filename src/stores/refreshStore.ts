import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Global "pull-to-refresh" signal. The shell's `RefreshControl` calls `bump()`;
 * screens opt in with `usePullRefresh(refresh)` to re-run their focus refresh
 * without remounting (so transient UI state — selected date, open sections — is
 * preserved). Data reads are synchronous SQLite, so this is mostly a freshness
 * gesture, but it keeps the app feeling live.
 */
interface RefreshState {
  tick: number;
  bump: () => void;
}

export const useRefreshStore = create<RefreshState>((set) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));

/** Re-run `refresh` whenever the shell's pull-to-refresh fires. */
export function usePullRefresh(refresh: () => void) {
  const tick = useRefreshStore((s) => s.tick);
  useEffect(() => {
    if (tick > 0) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}
