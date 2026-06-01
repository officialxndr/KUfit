import { useState } from 'react';
import { View, Pressable, StyleSheet, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, UserCircle, type LucideIcon } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, space, radius, shadow } from '@/theme/tokens';
import { SECTIONS, type SectionKey } from './config';

/**
 * Top bar: current section title with a dropdown switcher (left) and a profile
 * shortcut (right). The dropdown lists every section; tapping one switches.
 * An optional `rightAction` (e.g. a goals gear) sits left of the avatar.
 */
export function AppHeader({
  section,
  onSwitch,
  onOpenProfile,
  rightAction,
}: {
  section: SectionKey;
  onSwitch: (section: SectionKey) => void;
  onOpenProfile: () => void;
  rightAction?: { icon: LucideIcon; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const avatarUri = useSettingsStore((s) => s.profile.avatarUri);
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  const CurrentIcon = current.icon;

  return (
    <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
      <View style={styles.row}>
        <Pressable style={styles.titleBtn} onPress={() => setOpen((o) => !o)} hitSlop={8}>
          <CurrentIcon color={colors.primary} size={20} />
          <FsText variant="h1">{current.label}</FsText>
          <ChevronDown color={colors.muted} size={16} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          {rightAction && (
            <Pressable onPress={rightAction.onPress} hitSlop={8}>
              <rightAction.icon color={colors.muted} size={22} />
            </Pressable>
          )}
          <Pressable onPress={onOpenProfile} hitSlop={8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <UserCircle color={colors.muted} size={28} />
            )}
          </Pressable>
        </View>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 56 }]}>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.key === section;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                  onPress={() => {
                    setOpen(false);
                    onSwitch(s.key);
                  }}
                >
                  <Icon color={active ? colors.primary : colors.text} size={20} />
                  <FsText
                    variant="bodyMedium"
                    style={{ color: active ? colors.primary : colors.text }}
                  >
                    {s.label}
                  </FsText>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    left: space[4],
    minWidth: 208,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    paddingVertical: space[1],
    ...shadow.pop,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  menuItemActive: { backgroundColor: colors.surfaceHigh },
  avatar: { width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
});
