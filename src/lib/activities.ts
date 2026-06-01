import type { LucideIcon } from 'lucide-react-native';
import { Footprints, Activity as ActivityIcon, Bike, Waves, Cog, Dumbbell, PersonStanding } from 'lucide-react-native';

export interface Activity {
  name: string;
  met: number;
  icon: LucideIcon;
}

export const ACTIVITIES: Activity[] = [
  { name: 'Walking (brisk)', met: 4.3, icon: Footprints },
  { name: 'Walking (casual)', met: 3.0, icon: Footprints },
  { name: 'Jogging (5 mph)', met: 8.0, icon: ActivityIcon },
  { name: 'Cycling (moderate)', met: 8.0, icon: Bike },
  { name: 'Swimming (moderate)', met: 6.0, icon: Waves },
  { name: 'Elliptical (moderate)', met: 5.0, icon: Cog },
  { name: 'Bodyweight circuit', met: 5.0, icon: Dumbbell },
  { name: 'Yoga', met: 3.0, icon: PersonStanding },
];

export function minutesToBurnCalories(activity: Activity, weightKg: number, targetCals: number): number {
  const calsPerMinute = (activity.met * 3.5 * weightKg) / 200;
  return Math.ceil(targetCals / calsPerMinute);
}

export function activitySuggestions(
  targetCals: number,
  weightKg: number
): Array<{ activity: Activity; minutes: number }> {
  return ACTIVITIES.slice(0, 4).map((activity) => ({
    activity,
    minutes: minutesToBurnCalories(activity, weightKg, targetCals),
  }));
}
