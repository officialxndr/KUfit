import { View, StyleSheet } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { activitySuggestions } from '@/lib/activities';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * "How to hit it" — given a daily calorie gap to close and the user's weight,
 * suggests a few MET-based activity options (minutes to burn it) plus the
 * option to trim it from intake. Uses `lib/activities.ts`.
 */
export function ActivitySuggestions({
  calories,
  weightKg,
  title = 'How to hit it',
}: {
  calories: number;
  weightKg: number;
  title?: string;
}) {
  const target = Math.abs(Math.round(calories));
  if (target <= 0 || weightKg <= 0) return null;
  const options = activitySuggestions(target, weightKg);

  return (
    <Card>
      <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>{title}</FsText>
      <FsText variant="caption" style={{ marginBottom: space[3] }}>
        Burn ~{target} kcal today with any of these:
      </FsText>
      {options.map(({ activity, minutes }) => {
        const Icon = activity.icon;
        return (
          <View key={activity.name} style={styles.row}>
            <View style={styles.iconWrap}>
              <Icon color={colors.primary} size={16} />
            </View>
            <FsText variant="bodyMedium" style={{ flex: 1 }}>{activity.name}</FsText>
            <FsText variant="bodyMedium" style={{ color: colors.muted }}>~{minutes} min</FsText>
          </View>
        );
      })}
      <View style={[styles.row, styles.trimRow]}>
        <View style={styles.iconWrap}>
          <UtensilsCrossed color={colors.primary} size={16} />
        </View>
        <FsText variant="bodyMedium" style={{ flex: 1 }}>Or trim from intake</FsText>
        <FsText variant="bodyMedium" style={{ color: colors.muted }}>~{target} kcal</FsText>
      </View>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  trimRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space[1], paddingTop: space[3] },
  iconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center',
  },
}));
