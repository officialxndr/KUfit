import { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { useMotion } from '@/lib/useMotion';
import { SPRING } from '@/theme/motion';
import { colors, space, radius, shadow, themedStyles } from '@/theme/tokens';
import type { NavItem } from './config';

const FAB_SIZE = 56;
const PILL_W = 26;

/**
 * Contextual bottom bar: the section's tabs split around a center "+" FAB.
 * `activeKey` gets a sliding indicator + an icon pop; the FAB morphs "+"→"×"
 * while the quick-actions sheet is open.
 */
export function BottomNav({
  tabs,
  activeKey,
  onTab,
  showFab,
  onFab,
  fabOpen = false,
}: {
  tabs: NavItem[];
  activeKey: string;
  onTab: (key: string) => void;
  showFab: boolean;
  onFab: () => void;
  fabOpen?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { animate } = useMotion();
  const mid = Math.ceil(tabs.length / 2);
  const left = showFab ? tabs.slice(0, mid) : tabs;
  const right = showFab ? tabs.slice(mid) : [];

  // Slide a small indicator line to sit under the active tab. Tab x/width are
  // measured via onLayout (they account for the center FAB slot automatically).
  const layouts = useRef<Record<string, { x: number; w: number }>>({});
  const indX = useSharedValue(0);
  const indW = useSharedValue(0);
  const place = (key: string) => {
    const l = layouts.current[key];
    if (!l) return;
    const targetX = l.x + l.w / 2 - PILL_W / 2;
    if (animate) {
      indX.value = withSpring(targetX, SPRING.snappy);
      indW.value = withSpring(PILL_W, SPRING.snappy);
    } else {
      indX.value = targetX;
      indW.value = PILL_W;
    }
  };
  useEffect(() => { place(activeKey); /* eslint-disable-next-line */ }, [activeKey, animate]);
  const onTabLayout = (key: string, e: LayoutChangeEvent) => {
    layouts.current[key] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width };
    if (key === activeKey) place(key);
  };
  const indStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indX.value }], width: indW.value }));

  // FAB plus → × rotation while the sheet is open.
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = animate ? withSpring(fabOpen ? 1 : 0, SPRING.snappy) : (fabOpen ? 1 : 0);
  }, [fabOpen, animate, rot]);
  const fabIconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 45}deg` }] }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
      <Animated.View pointerEvents="none" style={[styles.indicator, indStyle]} />
      {left.map((t) => (
        <NavTab key={t.key} item={t} active={t.key === activeKey} onPress={() => { haptic.tap(); onTab(t.key); }} onLayout={(e) => onTabLayout(t.key, e)} />
      ))}
      {showFab && <View style={styles.fabSlot} />}
      {right.map((t) => (
        <NavTab key={t.key} item={t} active={t.key === activeKey} onPress={() => { haptic.tap(); onTab(t.key); }} onLayout={(e) => onTabLayout(t.key, e)} />
      ))}

      {showFab && (
        <View style={styles.fabWrap} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
            onPress={() => { haptic.medium(); onFab(); }}
            accessibilityLabel="Quick actions"
          >
            <Animated.View style={fabIconStyle}>
              <Plus color={colors.white} size={28} strokeWidth={2.5} />
            </Animated.View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function NavTab({
  item, active, onPress, onLayout,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { animate } = useMotion();
  const Icon = item.icon;
  const tint = active ? colors.primary : colors.muted;
  const scale = useSharedValue(1);
  useEffect(() => {
    const to = active ? 1.12 : 1;
    scale.value = animate ? withSpring(to, SPRING.snappy) : to;
  }, [active, animate, scale]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={6} onLayout={onLayout}>
      <Animated.View style={iconStyle}>
        <Icon color={tint} size={22} strokeWidth={active ? 2.4 : 2} />
      </Animated.View>
      <FsText variant="nav" style={{ color: tint, marginTop: 3 }}>{item.label}</FsText>
    </Pressable>
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
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
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
