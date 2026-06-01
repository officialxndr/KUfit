import {
  LayoutDashboard, UtensilsCrossed, Utensils, Dumbbell, HeartPulse, Settings,
  Calendar, Flame, Clock, Trophy, Activity, Ruler, Search, ScanLine, Plus, Repeat,
  Target, BarChart2,
} from '@/components/icons'
import type { LucideIcon } from 'lucide-react'

// Single source of truth for the contextual navigation: which sections exist,
// what sub-pages each one shows in the bottom nav, and what the center "+" FAB
// offers per section. Consumed by AppHeader (dropdown), BottomNav (tabs + FAB),
// and QuickActionSheet (FAB actions).

export type SectionKey = 'dashboard' | 'food' | 'workout' | 'health' | 'settings'

export interface SectionDef {
  key: SectionKey
  label: string
  Icon: LucideIcon
  basePath: string // where the header dropdown navigates (a redirect lands on the default sub-page)
}

export interface TabDef {
  to: string
  label: string
  Icon: LucideIcon
}

export interface ActionDef {
  id: string
  label: string
  Icon: LucideIcon
}

export const SECTIONS: SectionDef[] = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, basePath: '/' },
  { key: 'food', label: 'Food', Icon: UtensilsCrossed, basePath: '/food' },
  { key: 'workout', label: 'Workout', Icon: Dumbbell, basePath: '/workout' },
  { key: 'health', label: 'Health', Icon: HeartPulse, basePath: '/health' },
  { key: 'settings', label: 'Settings', Icon: Settings, basePath: '/settings' },
]

// Sub-pages rendered as bottom-nav tabs while inside a section.
export const SECTION_TABS: Record<SectionKey, TabDef[]> = {
  dashboard: [],
  food: [
    { to: '/food/today', label: 'Today', Icon: Calendar },
    { to: '/food/recipes', label: 'Recipes', Icon: Utensils },
    { to: '/food/trends', label: 'Trends', Icon: Flame },
    { to: '/food/goals', label: 'Goals', Icon: Target },
  ],
  workout: [
    { to: '/workout/templates', label: 'Templates', Icon: Clock },
    { to: '/workout/history', label: 'History', Icon: Trophy },
    { to: '/workout/exercises', label: 'Exercises', Icon: Dumbbell },
    { to: '/workout/stats', label: 'Stats', Icon: BarChart2 },
  ],
  health: [
    { to: '/health/weight', label: 'Weight', Icon: Activity },
    { to: '/health/goals', label: 'Goals', Icon: Flame },
    { to: '/health/composition', label: 'Body', Icon: HeartPulse },
    { to: '/health/measurements', label: 'Measure', Icon: Ruler },
  ],
  settings: [],
}

// Quick actions offered by the center "+" FAB, per section.
export const SECTION_ACTIONS: Record<SectionKey, ActionDef[]> = {
  dashboard: [
    { id: 'food.search', label: 'Log food', Icon: UtensilsCrossed },
    { id: 'health.weight', label: 'Log weight', Icon: Activity },
    { id: 'workout.empty', label: 'Start workout', Icon: Dumbbell },
  ],
  food: [
    { id: 'food.search', label: 'Search food', Icon: Search },
    { id: 'food.scan', label: 'Scan barcode', Icon: ScanLine },
    { id: 'food.quickAdd', label: 'Quick add', Icon: Repeat },
    { id: 'food.recipe.new', label: 'New recipe', Icon: Utensils },
  ],
  workout: [
    { id: 'workout.empty', label: 'Empty workout', Icon: Plus },
    { id: 'workout.template', label: 'From template', Icon: Clock },
  ],
  health: [
    { id: 'health.weight', label: 'Log weight', Icon: Activity },
    { id: 'health.measurement', label: 'Log measurement', Icon: Ruler },
  ],
  settings: [],
}

// The launcher links shown in the bottom nav on screens that have no sub-pages
// of their own (Dashboard, Settings).
export const LAUNCHER_TABS: TabDef[] = [
  { to: '/food', label: 'Food', Icon: UtensilsCrossed },
  { to: '/workout', label: 'Workout', Icon: Dumbbell },
  { to: '/health', label: 'Health', Icon: HeartPulse },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export function sectionForPath(pathname: string): SectionKey {
  const seg = pathname.split('/')[1] ?? ''
  if (seg === 'food') return 'food'
  if (seg === 'workout') return 'workout'
  if (seg === 'health') return 'health'
  if (seg === 'settings') return 'settings'
  return 'dashboard'
}
