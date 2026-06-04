import { useState } from 'react';
import { View, Pressable, Modal, StyleSheet, Dimensions, GestureResponderEvent } from 'react-native';
import { MoreVertical, type LucideIcon } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

export interface KebabMenuItem {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

const MENU_WIDTH = 210;
const ROW_H = 46;

/**
 * A 3-dots (kebab) button that opens a small dropdown of labelled actions,
 * anchored near the tap. Self-contained: renders its own trigger + modal.
 */
export function KebabMenu({ items, color = colors.muted, size = 20 }: { items: KebabMenuItem[]; color?: string; size?: number }) {
  // Visibility and position are separate state: position is set on open and kept through
  // the fade-out close, so the menu never flashes back to the top-left corner.
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const menuH = items.length * ROW_H + 8;

  const open = (e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    const { width: screenW, height: screenH } = Dimensions.get('window');
    setPos({
      left: Math.min(Math.max(pageX - MENU_WIDTH + 8, space[3]), screenW - MENU_WIDTH - space[3]),
      top: Math.min(pageY + 6, screenH - menuH - space[3]),
    });
    setVisible(true);
  };
  const close = () => setVisible(false);

  return (
    <>
      <Pressable onPress={open} hitSlop={8} style={styles.trigger}>
        <MoreVertical color={color} size={size} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={[styles.menu, { left: pos.left, top: pos.top, width: MENU_WIDTH }]}>
            {items.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={() => { close(); item.onPress(); }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowDivider,
                  pressed && { backgroundColor: colors.surfaceHigh },
                ]}
              >
                <item.icon color={item.danger ? colors.danger : colors.text} size={18} />
                <FsText variant="bodyMedium" style={{ color: item.danger ? colors.danger : colors.text }}>
                  {item.label}
                </FsText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  trigger: { padding: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  menu: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3], height: ROW_H },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
