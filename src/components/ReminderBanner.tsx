import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp, useSharedValue, useAnimatedStyle, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { Ruler, Scale, Dumbbell, Utensils, X, ChevronRight } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { PressableScale } from '@/components/anim/PressableScale';
import { useMotion } from '@/lib/useMotion';
import { DURATION } from '@/theme/motion';
import { REMINDER_META, type ReminderKey } from '@/stores/remindersStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const ICONS: Record<ReminderKey, typeof Ruler> = {
  measurements: Ruler,
  weight: Scale,
  workout: Dumbbell,
  food: Utensils,
};

/**
 * Dismissible Dashboard nudge for a due reminder. Slides + fades in and gives one
 * subtle attention pulse on mount. Tapping the body runs the reminder's action;
 * the X dismisses it for the rest of the day (via `remindersStore.dismissBanner`).
 */
export function ReminderBanner({
  reminderKey, onPress, onDismiss,
}: {
  reminderKey: ReminderKey;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const { animate } = useMotion();
  const meta = REMINDER_META[reminderKey];
  const Icon = ICONS[reminderKey];

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (animate) {
      pulse.value = withDelay(500, withSequence(
        withTiming(1.03, { duration: 160 }),
        withTiming(1, { duration: 240 }),
      ));
    } else pulse.value = 1;
  }, [animate, reminderKey, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View entering={animate ? FadeInUp.duration(DURATION.base) : undefined} style={pulseStyle}>
      <PressableScale onPress={onPress} style={styles.banner}>
        <View style={styles.iconWrap}>
          <Icon color={colors.primary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <FsText variant="bodyMedium">{meta.title}</FsText>
          <FsText variant="caption" style={{ color: colors.primary }}>{meta.cta} →</FsText>
        </View>
        <ChevronRight color={colors.muted} size={18} />
        <Pressable onPress={onDismiss} hitSlop={10} style={styles.dismiss}>
          <X color={colors.muted} size={18} />
        </Pressable>
      </PressableScale>
    </Animated.View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary,
    padding: space[3], marginBottom: space[3],
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  dismiss: { padding: 2 },
}));
