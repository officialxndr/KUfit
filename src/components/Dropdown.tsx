import { useState } from 'react';
import { View, Pressable, Modal, StyleSheet, Dimensions, ScrollView, type GestureResponderEvent } from 'react-native';
import { ChevronDown, Check, type LucideIcon } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

export interface DropdownItem { key: string; label: string }

const ROW_H = 44;

/**
 * A compact pill that opens an anchored dropdown list (a check marks the current value).
 * `active` controls the accent: primary when something non-default is selected, muted
 * otherwise — so a row of these stays quiet until the user changes one.
 *
 * Visibility and position are separate state: the menu position is set on open and kept
 * through the fade-out close, so the list never flashes back to the top-left corner.
 */
export function Dropdown({
  label,
  icon: Icon,
  items,
  selectedKey,
  onSelect,
  active = true,
  width = 200,
}: {
  label: string;
  icon?: LucideIcon;
  items: DropdownItem[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  active?: boolean;
  width?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const tint = active ? colors.primary : colors.muted;
  const menuH = Math.min(items.length, 6) * ROW_H + 8;

  const open = (e: GestureResponderEvent) => {
    haptic.tap();
    const { pageX, pageY } = e.nativeEvent;
    const { width: screenW, height: screenH } = Dimensions.get('window');
    setPos({
      left: Math.min(Math.max(pageX, space[3]), screenW - width - space[3]),
      top: Math.min(pageY + 8, screenH - menuH - space[3]),
    });
    setVisible(true);
  };
  const close = () => setVisible(false);
  const choose = (k: string) => { onSelect(k); close(); haptic.tap(); };

  return (
    <>
      <Pressable style={[styles.trigger, active && styles.triggerActive]} onPress={open} hitSlop={6}>
        {Icon ? <Icon color={tint} size={13} /> : null}
        <FsText variant="caption" numberOfLines={1} style={{ color: tint, fontWeight: '600', flexShrink: 1 }}>{label}</FsText>
        <ChevronDown color={tint} size={13} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={[styles.menu, { left: pos.left, top: pos.top, width, maxHeight: menuH }]}>
            <ScrollView bounces={false}>
              {items.map((it, i) => {
                const sel = it.key === selectedKey;
                return (
                  <Pressable
                    key={it.key}
                    onPress={() => choose(it.key)}
                    style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.surfaceHigh }]}
                  >
                    <FsText variant="bodyMedium" style={{ flex: 1, color: sel ? colors.primary : colors.text }}>{it.label}</FsText>
                    {sel ? <Check color={colors.primary} size={16} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  triggerActive: { backgroundColor: 'rgba(99,102,241,0.10)' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menu: {
    position: 'absolute',
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], height: ROW_H },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
