import {
  Sparkles, Compass, Plus, LayoutDashboard, UtensilsCrossed, Flame, Dumbbell, Trophy,
  HeartPulse, Scale, BarChart2, Settings, Target, ScanLine, Search, Ruler, Bell, ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import type { SectionKey } from '@/navigation/config';

/**
 * The guided feature tour, grouped into **pages** (one per app area). Each step's
 * `section`/`subTab` is what the `FeatureTour` overlay navigates to (via
 * `navStore.setSection`) so the real screen shows behind the explainer card; `scroll`
 * (a y offset, default 0) reveals lower content. Keep copy short.
 *
 * Steps flagged `advanced` only appear in the **Advanced** tour (and that page's own
 * replay). The **Basic** tour is every non-advanced step — the essentials. On replay a
 * user can pick a single page, which plays that page's full set. Resolve a run with
 * `tourStepsFor(tier, pageKey?)`.
 */
export interface TourStep {
  section: SectionKey;
  subTab?: string;
  scroll?: number;
  icon: LucideIcon;
  title: string;
  body: string;
  /** Shown only in the Advanced tour (and in this page's own replay). */
  advanced?: boolean;
}

export interface TourPage {
  key: string;
  label: string;
  icon: LucideIcon;
  steps: TourStep[];
}

/** A step flattened out of its page, tagged with the page label for the progress UI. */
export type ResolvedTourStep = TourStep & { page: string };

export type TourTier = 'basic' | 'advanced';

export const TOUR_PAGES: TourPage[] = [
  {
    key: 'welcome', label: 'Getting started', icon: Sparkles,
    steps: [
      {
        section: 'dashboard', subTab: 'overview', icon: Sparkles,
        title: 'Welcome to Hale',
        body: "A quick tour of what's here. Skip anytime, and replay any part later from Settings → Help.",
      },
      {
        section: 'dashboard', subTab: 'overview', icon: Compass,
        title: 'Getting around',
        body: 'Tap the title up top to switch sections (Dashboard, Food, Workout, Health, Settings). The bottom bar switches the sub-tabs within a section.',
      },
      {
        section: 'dashboard', subTab: 'overview', icon: Plus,
        title: 'Quick add',
        body: 'The + in the bottom bar is your fast lane — log food, log your weight, or start a workout from anywhere.',
      },
    ],
  },
  {
    key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
    steps: [
      {
        section: 'dashboard', subTab: 'overview', scroll: 360, icon: LayoutDashboard,
        title: 'Your day at a glance',
        body: 'Calories & macros up top, then your week, weight trend and recent workouts as you scroll.',
      },
      {
        section: 'dashboard', subTab: 'overview', icon: Target, advanced: true,
        title: 'Goals in one place',
        body: 'The gear (top-right) opens your goals — calories, macros, a weight or body-fat target, and your TDEE/maintenance — all together.',
      },
      {
        section: 'dashboard', subTab: 'reports', scroll: 280, icon: BarChart2, advanced: true,
        title: 'Reports',
        body: 'A cross-domain digest. Pick any week, month, year or custom range and scroll for nutrition, training and body trends.',
      },
    ],
  },
  {
    key: 'food', label: 'Food', icon: UtensilsCrossed,
    steps: [
      {
        section: 'food', subTab: 'today', icon: UtensilsCrossed,
        title: 'Food',
        body: "The calorie ring and macro bars track today against your targets. Workout burn is added back in once you've enabled it.",
      },
      {
        section: 'food', subTab: 'today', scroll: 330, icon: Flame,
        title: 'Logging meals',
        body: 'Tap + on a meal to add by search or barcode. Swipe a row to remove it.',
      },
      {
        section: 'food', subTab: 'today', icon: ScanLine, advanced: true,
        title: 'Scan a label',
        body: "Adding a custom food? Snap its nutrition label and Hale reads the numbers off it for you.",
      },
      {
        section: 'food', subTab: 'recipes', icon: UtensilsCrossed, advanced: true,
        title: 'Recipes',
        body: 'Build a recipe once, then log the whole thing — or a single serving — in a tap.',
      },
      {
        section: 'food', subTab: 'search', icon: Search, advanced: true,
        title: 'Search & favorites',
        body: 'Search the Open Food Facts database, scan barcodes, and star foods you eat often for one-tap logging.',
      },
      {
        section: 'food', subTab: 'trends', scroll: 120, icon: BarChart2, advanced: true,
        title: 'Nutrition trends',
        body: 'Calories and macros over any window — and add custom nutrient goals like fiber or sodium.',
      },
    ],
  },
  {
    key: 'workout', label: 'Workout', icon: Dumbbell,
    steps: [
      {
        section: 'workout', subTab: 'library', icon: Dumbbell,
        title: 'Workouts',
        body: 'Start from a template or routine, or go empty. During a session you log sets with rest timers and ghost values from last time.',
      },
      {
        section: 'workout', subTab: 'history', icon: Trophy,
        title: 'History & PRs',
        body: 'Finished workouts land here with a calendar and per-session summaries — and new personal bests are flagged automatically.',
      },
      {
        section: 'workout', subTab: 'exercises', icon: Dumbbell, advanced: true,
        title: 'Exercise library',
        body: '~440 exercises with animated demos. Long-press one in a picker to peek its details before adding it.',
      },
      {
        section: 'workout', subTab: 'stats', scroll: 120, icon: BarChart2, advanced: true,
        title: 'Training stats',
        body: 'Volume, frequency, muscle balance and PR history over any date range.',
      },
    ],
  },
  {
    key: 'health', label: 'Health', icon: HeartPulse,
    steps: [
      {
        section: 'health', subTab: 'weight', icon: HeartPulse,
        title: 'Health',
        body: 'Log weigh-ins and watch the trend, pace and goal ETA. Body measurements (including the Renpho tape) are a tap away.',
      },
      {
        section: 'health', subTab: 'body', icon: Scale,
        title: 'Body composition',
        body: 'Body-fat %, lean & fat mass, BMI and FFMI — estimated from your weigh-ins, a DEXA baseline, or the U.S. Navy tape method.',
      },
      {
        section: 'health', subTab: 'measure', icon: Ruler, advanced: true,
        title: 'Measurements & tape',
        body: 'Track waist, arms and more with a body-diagram guide — or connect a Renpho Bluetooth tape to log them automatically.',
      },
      {
        section: 'health', subTab: 'body', icon: Target, advanced: true,
        title: 'DEXA & body-fat goals',
        body: 'Log a DEXA scan for a true 3-compartment breakdown, and set a target body-fat % — Hale shows the weight that gets you there.',
      },
      {
        section: 'health', subTab: 'trends', scroll: 120, icon: BarChart2, advanced: true,
        title: 'Health trends',
        body: 'Body-fat and per-site measurement trends over any window.',
      },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: Settings,
    steps: [
      {
        section: 'settings', icon: Settings,
        title: 'Make it yours',
        body: 'Set goals, profile, themes and motion in Settings — and replay this tour anytime from the Help card.',
      },
      {
        section: 'settings', icon: Bell, advanced: true,
        title: 'Reminders',
        body: 'Schedule weigh-in, meal or workout reminders → local notifications plus dashboard banners.',
      },
      {
        section: 'settings', icon: ShieldCheck, advanced: true,
        title: 'Private & yours',
        body: 'Everything stays on your device. Export a backup or wipe your data anytime — no account, no cloud required.',
      },
    ],
  },
];

/**
 * Flatten the pages into the ordered step list for a run. `tier` decides whether
 * advanced steps are included; an optional `pageKey` narrows to one page (its full set,
 * used by the per-page replay). Each step is tagged with its page label for the overlay.
 */
export function tourStepsFor(tier: TourTier, pageKey?: string): ResolvedTourStep[] {
  return TOUR_PAGES
    .filter((p) => !pageKey || p.key === pageKey)
    .flatMap((p) => p.steps.map((s) => ({ ...s, page: p.label })))
    .filter((s) => tier === 'advanced' || !s.advanced);
}

/** Step counts for the menu labels. */
export const BASIC_STEP_COUNT = tourStepsFor('basic').length;
export const ADVANCED_STEP_COUNT = tourStepsFor('advanced').length;
