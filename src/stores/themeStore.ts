import { create } from 'zustand';

import { applyTheme, saveThemeToDisk, getActiveTheme } from '@/theme/tokens';
import { syncWidget } from '@/lib/widget';

/**
 * Selected app theme (a surface **preset** + an **accent**). `version` bumps on
 * every change; the shell keys a remount off it so the whole UI re-renders with
 * the freshly-rebuilt `colors`/`themedStyles`. The choice is persisted to SQLite
 * and re-applied at module load (see `theme/tokens.ts`), so this store just
 * mirrors it for the UI and drives live changes.
 */
interface ThemeState {
  preset: string;
  accent: string;
  version: number;
  setPreset: (preset: string) => void;
  setAccent: (accent: string) => void;
}

const initial = getActiveTheme();

export const useThemeStore = create<ThemeState>((set, get) => ({
  preset: initial.preset,
  accent: initial.accent,
  version: 0,
  setPreset: (preset) => {
    const { accent } = get();
    applyTheme(preset, accent);
    saveThemeToDisk(preset, accent);
    set((s) => ({ preset, version: s.version + 1 }));
    syncWidget(); // recolor the iOS widget to match the new theme
  },
  setAccent: (accent) => {
    const { preset } = get();
    applyTheme(preset, accent);
    saveThemeToDisk(preset, accent);
    set((s) => ({ accent, version: s.version + 1 }));
    syncWidget(); // recolor the iOS widget to match the new accent
    // The app icon is NOT auto-changed (iOS shows an alert on every switch) — the user opts in
    // via "Match app icon to accent" in Settings → Appearance (see lib/appIcon.ts).
  },
}));
