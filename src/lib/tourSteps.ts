import {
  Sparkles, Compass, Plus, LayoutDashboard, UtensilsCrossed, Flame, Dumbbell, Trophy,
  HeartPulse, Scale, BarChart2, Settings,
  type LucideIcon,
} from 'lucide-react-native';
import type { SectionKey } from '@/navigation/config';

/**
 * Ordered steps for the guided feature tour. Each step's `section`/`subTab` is
 * what the `FeatureTour` overlay navigates to (via `navStore.setSection`) so the
 * real screen shows behind the explainer card; `scroll` (a y offset, default 0)
 * lets a step scroll the screen to reveal lower content. Keep copy short.
 */
export interface TourStep {
  section: SectionKey;
  subTab?: string;
  scroll?: number;
  icon: LucideIcon;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    section: 'dashboard', subTab: 'overview', icon: Sparkles,
    title: 'Welcome to Hale',
    body: "A quick tour of what's here. You can skip anytime, and replay it later from Settings → Help.",
  },
  {
    section: 'dashboard', subTab: 'overview', icon: Compass,
    title: 'Getting around',
    body: 'Tap the title at the top to switch sections (Dashboard, Food, Workout, Health, Settings). The bar at the bottom switches the sub-tabs inside a section.',
  },
  {
    section: 'dashboard', subTab: 'overview', icon: Plus,
    title: 'Quick add',
    body: 'The + button in the bottom bar is your fast lane — log food, log your weight, or start a workout from anywhere.',
  },
  {
    section: 'dashboard', subTab: 'overview', scroll: 360, icon: LayoutDashboard,
    title: 'Your day at a glance',
    body: 'The Dashboard shows calories & macros up top, then your week, weight trend, and recent workouts as you scroll.',
  },
  {
    section: 'food', subTab: 'today', icon: UtensilsCrossed,
    title: 'Food',
    body: "The calorie ring and macro bars track today against your targets. Active-calorie burn from workouts gets added in when you've enabled it.",
  },
  {
    section: 'food', subTab: 'today', scroll: 330, icon: Flame,
    title: 'Logging meals',
    body: 'Each meal lists what you logged — tap + to add by search or barcode, snap a nutrition label to auto-fill it, or build a recipe. Swipe a row to remove it.',
  },
  {
    section: 'workout', subTab: 'library', icon: Dumbbell,
    title: 'Workouts',
    body: 'Start from a template or a routine, or go empty. During a session you log sets with rest timers and ghost values from last time.',
  },
  {
    section: 'workout', subTab: 'history', icon: Trophy,
    title: 'History & PRs',
    body: 'Finished workouts land here with a calendar and per-session summaries — and new personal bests are flagged automatically.',
  },
  {
    section: 'health', subTab: 'weight', icon: HeartPulse,
    title: 'Health',
    body: 'Log weigh-ins and watch the trend, pace and goal ETA. Body measurements (including the Renpho tape) live a tap away.',
  },
  {
    section: 'health', subTab: 'body', icon: Scale,
    title: 'Body composition',
    body: 'Body-fat %, lean and fat mass, BMI and FFMI — estimated from your weigh-ins, a DEXA baseline, or the U.S. Navy tape method.',
  },
  {
    section: 'dashboard', subTab: 'reports', scroll: 280, icon: BarChart2,
    title: 'Reports',
    body: 'Your cross-domain digest. Pick any week, month, year or custom range and scroll for nutrition, training and body trends.',
  },
  {
    section: 'settings', icon: Settings,
    title: 'Make it yours',
    body: 'Set goals, reminders, themes and motion in Settings — and replay this tour anytime from the Help card.',
  },
];
