import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FsText } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { useMotion } from '@/lib/useMotion';
import { DURATION } from '@/theme/motion';
import { colors, space, radius, themedStyles } from '@/theme/tokens';
import type { FabAction } from './config';

/**
 * Bottom sheet of section-specific quick actions, opened by the center FAB.
 */
export function QuickActionsSheet({
  visible,
  actions,
  onAction,
  onClose,
}: {
  visible: boolean;
  actions: FabAction[];
  onAction: (key: string) => void;
  onClose: () => void;
}) {
  const { animate } = useMotion();
  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}>
      <FsText variant="h2" style={styles.title}>
        Quick Actions
      </FsText>
      {actions.map((a, i) => {
        const Icon = a.icon;
        return (
          <Animated.View
            key={a.key}
            entering={animate ? FadeInDown.duration(DURATION.base).delay(i * 40) : undefined}
          >
            <Pressable
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.border }]}
              onPress={() => onAction(a.key)}
            >
              <View style={styles.iconWrap}>
                <Icon color={colors.primary} size={20} />
              </View>
              <FsText variant="bodyMedium">{a.label}</FsText>
            </Pressable>
          </Animated.View>
        );
      })}
    </BottomSheet>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  sheet: { gap: space[2] },
  title: { textAlign: 'center', marginBottom: space[2] },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
