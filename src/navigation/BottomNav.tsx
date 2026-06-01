import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, space, radius, shadow, themedStyles } from '@/theme/tokens';
import type { NavItem } from './config';

const FAB_SIZE = 56;

/**
 * Contextual bottom bar: the section's tabs split around a center "+" FAB.
 * `activeKey` is highlighted; tapping a tab calls onTab, the FAB calls onFab.
 */
export function BottomNav({
  tabs,
  activeKey,
  onTab,
  showFab,
  onFab,
}: {
  tabs: NavItem[];
  activeKey: string;
  onTab: (key: string) => void;
  showFab: boolean;
  onFab: () => void;
}) {
  const insets = useSafeAreaInsets();
  const mid = Math.ceil(tabs.length / 2);
  const left = showFab ? tabs.slice(0, mid) : tabs;
  const right = showFab ? tabs.slice(mid) : [];

  const renderTab = (t: NavItem) => {
    const Icon = t.icon;
    const active = t.key === activeKey;
    const tint = active ? colors.primary : colors.muted;
    return (
      <Pressable key={t.key} style={styles.tab} onPress={() => { haptic.tap(); onTab(t.key); }} hitSlop={6}>
        <Icon color={tint} size={22} strokeWidth={active ? 2.4 : 2} />
        <FsText variant="nav" style={{ color: tint, marginTop: 3 }}>
          {t.label}
        </FsText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
      {left.map(renderTab)}
      {showFab && <View style={styles.fabSlot} />}
      {right.map(renderTab)}

      {showFab && (
        <View style={styles.fabWrap} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
            onPress={() => { haptic.medium(); onFab(); }}
            accessibilityLabel="Quick actions"
          >
            <Plus color={colors.white} size={28} strokeWidth={2.5} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space[2],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSlot: { width: FAB_SIZE + space[2] },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -FAB_SIZE / 2,
    alignItems: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.fab,
  },
}));
