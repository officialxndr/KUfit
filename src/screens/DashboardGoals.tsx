import { GoalsEditor } from '@/components/GoalsEditor';

/**
 * Master list of every goal the app tracks, grouped under the section that owns
 * it: Nutrition (Food), Health (weight), Training (Workout). The body is the
 * shared `GoalsEditor`, also surfaced via the header gear on Food/Health.
 */
export function DashboardGoals() {
  return <GoalsEditor />;
}
