import { View, StyleSheet } from 'react-native';
import { Timer, Dumbbell, Layers, Flame, Hash, Trophy } from 'lucide-react-native';

import { FsText, Card, Badge } from '@/components/ui';
import { HeartRatePanel } from '@/components/HeartRatePanel';
import { useSettingsStore } from '@/stores/settingsStore';
import { ageFromBirthDate } from '@/lib/targets';
import { formatVolume } from '@/lib/units';
import { colors, space, themedStyles } from '@/theme/tokens';
import type { WorkoutSession } from '@/types';

/**
 * The shared "what happened in this workout" body — stat grid, PR callout, and
 * heart-rate panel. Rendered by both the post-finish summary screen
 * (`app/workout-summary.tsx`) and the History detail sheet (`WorkoutSummarySheet`)
 * so anything added here shows up in both places automatically.
 */
export function WorkoutSummaryBody({ session }: { session: WorkoutSession }) {
  const profile = useSettingsStore((s) => s.profile);
  const unit = profile.unitSystem;

  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const prs = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPersonalBest).length, 0);
  const durationMin = session.finishedAt
    ? Math.max(1, Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
    : null;

  return (
    <>
      <View style={styles.grid}>
        <Stat icon={Timer} label="Duration" value={durationMin != null ? `${durationMin} min` : '—'} />
        <Stat icon={Flame} label="Calories" value={session.caloriesBurned != null ? `${Math.round(session.caloriesBurned)} kcal` : '—'} />
        <Stat icon={Dumbbell} label="Volume" value={formatVolume(session.totalVolume ?? 0, unit)} />
        <Stat icon={Layers} label="Sets" value={String(sets)} />
        <Stat icon={Hash} label="Exercises" value={String(session.exercises.length)} />
      </View>

      {prs > 0 && (
        <Card style={styles.prCard}>
          <Trophy color={colors.warning} size={20} />
          <FsText variant="cardTitle" style={{ flex: 1 }}>
            {prs} new personal best{prs > 1 ? 's' : ''}!
          </FsText>
          <Badge label="PR" tone="warning" />
        </Card>
      )}

      {session.avgHeartRate != null && (
        <HeartRatePanel
          avg={session.avgHeartRate}
          min={session.minHeartRate ?? null}
          max={session.maxHeartRate ?? null}
          samples={session.heartRateSamples ?? null}
          age={ageFromBirthDate(profile.birthDate)}
          style={{ marginTop: space[3] }}
        />
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Icon color={colors.primary} size={18} />
      <FsText variant="stat" style={{ marginTop: space[2] }}>{value}</FsText>
      <FsText variant="caption">{label}</FsText>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  statCard: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 2 },
  prCard: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3] },
}));
