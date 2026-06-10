/**
 * Navigation shell config — ported from the FitSelf Design System mock
 * (`FitSelf Design System/ui_kits/app/index.html`).
 *
 * The shell is a two-level nav: a top section switcher (AppHeader) plus a
 * contextual bottom bar (BottomNav). On Dashboard/Settings the bottom bar shows
 * the section LAUNCHER; on Food/Workout/Health it shows that section's sub-tabs.
 * The center "+" FAB opens section-specific quick actions (FAB_ACTIONS).
 */
import {
  LayoutDashboard,
  UtensilsCrossed,
  Dumbbell,
  HeartPulse,
  Settings,
  Calendar,
  Flame,
  Target,
  LayoutGrid,
  Trophy,
  BarChart2,
  Activity,
  Ruler,
  Search,
  ScanLine,
  Repeat,
  Plus,
  Utensils,
  Scale,
  TrendingUp,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';

export type SectionKey = 'dashboard' | 'food' | 'workout' | 'health' | 'settings';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

export interface Section {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
}

/** Top-level sections, shown in the AppHeader dropdown. */
export const SECTIONS: Section[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'food', label: 'Food', icon: UtensilsCrossed },
  { key: 'workout', label: 'Workout', icon: Dumbbell },
  { key: 'health', label: 'Health', icon: HeartPulse },
  { key: 'settings', label: 'Settings', icon: Settings },
];

/**
 * Contextual bottom-nav tabs per section. Sections absent here (dashboard,
 * settings) fall back to the LAUNCHER. The first tab is the section default.
 */
export const SECTION_TABS: Partial<Record<SectionKey, NavItem[]>> = {
  dashboard: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'reports', label: 'Reports', icon: BarChart2 },
  ],
  food: [
    { key: 'today', label: 'Today', icon: Calendar },
    { key: 'recipes', label: 'Recipes', icon: Utensils },
    { key: 'search', label: 'Search', icon: Search },
    { key: 'trends', label: 'Stats', icon: BarChart2 },
  ],
  workout: [
    { key: 'library', label: 'Library', icon: LayoutGrid },
    { key: 'history', label: 'History', icon: Trophy },
    { key: 'exercises', label: 'Exercises', icon: Dumbbell },
    { key: 'stats', label: 'Stats', icon: BarChart2 },
  ],
  health: [
    { key: 'weight', label: 'Weight', icon: Activity },
    { key: 'body', label: 'Body', icon: Scale },
    { key: 'measure', label: 'Measure', icon: Ruler },
    { key: 'trends', label: 'Stats', icon: BarChart2 },
  ],
};

/** On dashboard/settings, the bottom bar is a launcher into the other sections. */
export const LAUNCHER: NavItem[] = [
  { key: 'food', label: 'Food', icon: UtensilsCrossed },
  { key: 'workout', label: 'Workout', icon: Dumbbell },
  { key: 'health', label: 'Health', icon: HeartPulse },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export interface FabAction {
  key: string;
  label: string;
  icon: LucideIcon;
}

/** Quick actions for the center FAB, per section. Settings has no FAB. */
export const FAB_ACTIONS: Partial<Record<SectionKey, FabAction[]>> = {
  dashboard: [
    { key: 'log-food', label: 'Log food', icon: UtensilsCrossed },
    { key: 'log-weight', label: 'Log weight', icon: Activity },
    { key: 'start-workout', label: 'Start workout', icon: Dumbbell },
  ],
  food: [
    { key: 'search-food', label: 'Search food', icon: Search },
    { key: 'scan-barcode', label: 'Scan barcode', icon: ScanLine },
    { key: 'estimate-meal', label: 'Estimate a meal (AI)', icon: Sparkles },
    { key: 'quick-add', label: 'Quick add calories', icon: Flame },
  ],
  workout: [
    { key: 'start-routine', label: 'Start routine', icon: Repeat },
    { key: 'start-empty', label: 'Empty workout', icon: Plus },
    { key: 'start-template', label: 'From template', icon: LayoutGrid },
  ],
  health: [
    { key: 'log-weight', label: 'Log weight', icon: Activity },
    { key: 'log-measurement', label: 'Log measurement', icon: Ruler },
  ],
};

/** The bottom-nav tabs to show for a section (its sub-tabs, or the launcher). */
export function navTabsFor(section: SectionKey): NavItem[] {
  return SECTION_TABS[section] ?? LAUNCHER;
}

/** Whether a key names a top-level section (launcher taps switch sections). */
export function isSectionKey(key: string): key is SectionKey {
  return SECTIONS.some((s) => s.key === key);
}
