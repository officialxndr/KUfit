/**
 * FitSelf design tokens — ported from the FitSelf Design System
 * (colors_and_type.css). Dark-first; one indigo accent; flat aesthetic.
 */

export const colors = {
  // Surfaces (dark) — near-black stack stepping up in luminance
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1e1e1e',
  border: '#2a2a2a',

  // Text
  text: '#f9f9f9',
  muted: '#6b7280',

  // Brand — single indigo accent
  primary: '#6366f1',
  primaryHover: '#818cf8',

  // Semantic status
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',

  // Macro accents (rings/bars)
  macroProtein: '#6366f1',
  macroCarbs: '#f59e0b',
  macroFat: '#ec4899',

  // Calorie ring track
  ringTrack: '#2a2a2a',

  white: '#ffffff',
} as const;

/** Tinted status-badge backgrounds (10% accent wash). */
export const tintBg = {
  success: 'rgba(34,197,94,0.10)',
  warning: 'rgba(245,158,11,0.10)',
  danger: 'rgba(239,68,68,0.10)',
  primary: 'rgba(99,102,241,0.10)',
} as const;

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
} as const;

export const PAGE_PADDING = space[4];
