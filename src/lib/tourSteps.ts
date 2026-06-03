import {
  Sparkles, Compass, Plus, UtensilsCrossed, Dumbbell, HeartPulse, BarChart2, Settings,
  type LucideIcon,
} from 'lucide-react-native';
import type { SectionKey } from '@/navigation/config';

/**
 * Ordered steps for the guided feature tour. Each step's `section`/`subTab` is
 * what the `FeatureTour` overlay navigates to (via `navStore.setSection`) so the
 * real screen shows behind the explainer card. Keep copy short — this is a
 * ~60-second intro, not docs.
 */
export interface TourStep {
  section: SectionKey;
  subTab?: string;
  icon: LucideIcon;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    section: 'dashboard', subTab: 'overview', icon: Sparkles,
    title: 'Welcome to FitSelf',
    body: "A quick 60-second tour of what's here. You can skip anytime, and replay it later from Settings.",
  },
  {
    section: 'dashboard', subTab: 'overview', icon: Compass,
    title: 'Getting around',
    body: 'Tap the title at the top to switch between Dashboard, Food, Workout, Health and Settings. The bar at the bottom switches the sub-tabs within a section.',
  },
  {
    section: 'dashboard', subTab: 'overview', icon: Plus,
    title: 'Quick add',
    body: 'The + button is your fast lane — log food, log your weight, or start a workout from wherever you are.',
  },
  {
    section: 'food', subTab: 'today', icon: UtensilsCrossed,
    title: 'Food',
    body: 'Log meals by search or barcode, or snap a nutrition label to auto-fill it. Build recipes and track calories, macros and more against your targets.',
  },
  {
    section: 'workout', subTab: 'library', icon: Dumbbell,
    title: 'Workouts',
    body: 'Start from a template or routine, or go empty. Log sets with rest timers and ghost values; finishing gives you a summary and tracks PRs.',
  },
  {
    section: 'health', subTab: 'weight', icon: HeartPulse,
    title: 'Health',
    body: 'Log your weight and body measurements (including the Renpho tape), and see body-fat, lean mass, BMI and weight trends over time.',
  },
  {
    section: 'dashboard', subTab: 'reports', icon: BarChart2,
    title: 'Reports',
    body: 'Your at-a-glance digest across everything. Pick any week, month, year or custom range to see how you are trending.',
  },
  {
    section: 'settings', icon: Settings,
    title: 'Make it yours',
    body: 'Set your goals, reminders, themes and motion in Settings — and replay this tour anytime from the Help card there.',
  },
];
