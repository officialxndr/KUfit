/**
 * FitSelf design tokens — ported from the FitSelf Design System
 * (colors_and_type.css). Dark-first; one accent; flat aesthetic.
 *
 * **Theming:** `colors` / `tintBg` / `shadow` are *mutable* and get rebuilt in
 * place by `applyTheme()` (a chosen surface **preset** + an **accent**). Styles
 * must be wrapped in `themedStyles(() => StyleSheet.create({…}))` so they
 * transparently recompute when the theme changes (the returned object is a Proxy
 * that re-runs the factory after a theme bump — existing `styles.x` access is
 * unchanged). Inline `colors.x` reads stay correct because the shell remounts on
 * a theme change (see `themeStore`). The chosen theme is persisted to SQLite and
 * re-applied synchronously at module load, so the very first paint is themed.
 */
import { openDatabaseSync } from 'expo-sqlite';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceHigh: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryHover: string;
  success: string;
  warning: string;
  danger: string;
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  ringTrack: string;
  white: string;
}

/** Surface palettes (everything except the accent, which is layered on top). */
type Surface = Omit<ThemeColors, 'primary' | 'primaryHover' | 'macroProtein'>;

export interface SurfacePreset { key: string; label: string; dark: boolean; surface: Surface; }

const STATUS = { success: '#22c55e', warning: '#f59e0b', danger: '#ef4444', macroCarbs: '#f59e0b', macroFat: '#ec4899', white: '#ffffff' };

export const SURFACE_PRESETS: Record<string, SurfacePreset> = {
  charcoal: {
    key: 'charcoal', label: 'Charcoal', dark: true,
    surface: { bg: '#0a0a0a', surface: '#141414', surfaceHigh: '#1e1e1e', border: '#2a2a2a', text: '#f9f9f9', muted: '#6b7280', ringTrack: '#2a2a2a', ...STATUS },
  },
  slate: {
    key: 'slate', label: 'Slate', dark: true,
    surface: { bg: '#0b0f14', surface: '#121821', surfaceHigh: '#1b2430', border: '#283340', text: '#f1f5f9', muted: '#7b8794', ringTrack: '#283340', ...STATUS },
  },
  mocha: {
    key: 'mocha', label: 'Mocha', dark: true,
    surface: { bg: '#0f0b0a', surface: '#1a1413', surfaceHigh: '#251c1a', border: '#34282533', text: '#f7f1ee', muted: '#9a8178', ringTrack: '#342825', ...STATUS },
  },
  light: {
    key: 'light', label: 'Light', dark: false,
    surface: { bg: '#f4f4f6', surface: '#ffffff', surfaceHigh: '#eaeaee', border: '#d9d9de', text: '#101012', muted: '#6b7280', ringTrack: '#e4e4e8', ...STATUS },
  },
};

export interface AccentPreset { key: string; label: string; hex: string; hover: string; }
export const ACCENT_PRESETS: AccentPreset[] = [
  { key: 'indigo', label: 'Indigo', hex: '#6366f1', hover: '#818cf8' },
  { key: 'violet', label: 'Violet', hex: '#8b5cf6', hover: '#a78bfa' },
  { key: 'sky', label: 'Sky', hex: '#0ea5e9', hover: '#38bdf8' },
  { key: 'emerald', label: 'Emerald', hex: '#10b981', hover: '#34d399' },
  { key: 'amber', label: 'Amber', hex: '#f59e0b', hover: '#fbbf24' },
  { key: 'rose', label: 'Rose', hex: '#f43f5e', hover: '#fb7185' },
];

const DEFAULT_PRESET = 'charcoal';
const DEFAULT_ACCENT = 'indigo';

// ── hex helpers ───────────────────────────────────────────────────────────────
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))); }
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex: string, a: number) { const [r, g, b] = parseHex(hex); return `rgba(${r},${g},${b},${a})`; }
function lighten(hex: string, amt: number) {
  const [r, g, b] = parseHex(hex);
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r + (255 - r) * amt)}${toHex(g + (255 - g) * amt)}${toHex(b + (255 - b) * amt)}`;
}

/** Resolve an accent (a preset key OR a custom `#rrggbb`) to its primary/hover. */
function resolveAccent(accent: string): { primary: string; primaryHover: string } {
  const preset = ACCENT_PRESETS.find((a) => a.key === accent);
  if (preset) return { primary: preset.hex, primaryHover: preset.hover };
  const hex = /^#?[0-9a-fA-F]{6}$/.test(accent) ? (accent.startsWith('#') ? accent : `#${accent}`) : ACCENT_PRESETS[0].hex;
  return { primary: hex, primaryHover: lighten(hex, 0.25) };
}

function buildColors(presetKey: string, accent: string): ThemeColors {
  const p = (SURFACE_PRESETS[presetKey] ?? SURFACE_PRESETS[DEFAULT_PRESET]).surface;
  const { primary, primaryHover } = resolveAccent(accent);
  return { ...p, primary, primaryHover, macroProtein: primary };
}

// ── persistence (synchronous, so the first paint is already themed) ───────────
function readSavedTheme(): { preset: string; accent: string } {
  try {
    const db = openDatabaseSync('fitself.db');
    const row = db.getFirstSync("SELECT value FROM app_meta WHERE key = 'theme'") as { value?: string } | null;
    if (row?.value) { const v = JSON.parse(row.value); if (v?.preset && v?.accent) return v; }
  } catch { /* table not created yet (first launch) → defaults */ }
  return { preset: DEFAULT_PRESET, accent: DEFAULT_ACCENT };
}
export function saveThemeToDisk(preset: string, accent: string) {
  try {
    const db = openDatabaseSync('fitself.db');
    db.runSync("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('theme', ?)", [JSON.stringify({ preset, accent })]);
  } catch { /* ignore */ }
}

const saved = readSavedTheme();

/** ACTIVE theme — mutated in place by `applyTheme`. Never reassign the binding. */
export const colors: ThemeColors = buildColors(saved.preset, saved.accent);

/** Tinted status-badge backgrounds (10% wash). Rebuilt with the theme. */
export const tintBg = {
  success: rgba(colors.success, 0.1),
  warning: rgba(colors.warning, 0.1),
  danger: rgba(colors.danger, 0.1),
  primary: rgba(colors.primary, 0.1),
};

export const radius = {
  sm: 8, // chips, small buttons
  md: 12, // primary buttons, inputs
  lg: 16, // cards, sheets
  xl: 24, // bottom sheets / modal top corners
  full: 9999, // pills, FAB, badges
} as const;

/** 4px spacing scale (Tailwind-derived). */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

export const shadow = {
  pop: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  fab: {
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};

export const PAGE_PADDING = space[4];

// ── runtime theming ───────────────────────────────────────────────────────────
let themeVersion = 0;
export const getActiveTheme = () => ({ preset: saved.preset, accent: saved.accent });

/** Rebuild `colors`/`tintBg`/`shadow` in place and bump the style version. */
export function applyTheme(presetKey: string, accent: string) {
  Object.assign(colors, buildColors(presetKey, accent));
  Object.assign(tintBg, {
    success: rgba(colors.success, 0.1),
    warning: rgba(colors.warning, 0.1),
    danger: rgba(colors.danger, 0.1),
    primary: rgba(colors.primary, 0.1),
  });
  shadow.fab.shadowColor = colors.primary;
  saved.preset = presetKey;
  saved.accent = accent;
  themeVersion++;
}

/**
 * Wrap a `StyleSheet.create(...)` factory so the resulting styles recompute
 * after a theme change. Returns a Proxy with the same shape — `styles.x` works
 * unchanged. The factory re-runs lazily the first time a style is read after a
 * `themeVersion` bump.
 */
export function themedStyles<T extends Record<string, unknown>>(factory: () => T): T {
  let cached: T | null = null;
  let builtAt = -1;
  return new Proxy({} as T, {
    get(_t, prop: string) {
      if (cached === null || builtAt !== themeVersion) { cached = factory(); builtAt = themeVersion; }
      return (cached as Record<string, unknown>)[prop];
    },
  });
}
