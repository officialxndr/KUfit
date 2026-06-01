import { View, Pressable, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FsText } from '@/components/ui';
import { colors, space, radius } from '@/theme/tokens';
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
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />
          <FsText variant="h2" style={styles.title}>
            Quick Actions
          </FsText>
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={a.key}
                style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.border }]}
                onPress={() => onAction(a.key)}
              >
                <View style={styles.iconWrap}>
                  <Icon color={colors.primary} size={20} />
                </View>
                <FsText variant="bodyMedium">{a.label}</FsText>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    gap: space[2],
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: space[3],
  },
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
});
