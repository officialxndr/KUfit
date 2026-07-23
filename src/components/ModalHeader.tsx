import type { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { colors, space, themedStyles } from '@/theme/tokens';

/**
 * Standard header for full-screen modal routes (`presentation: 'modal'` in `app/_layout`).
 *
 * These modals draw **behind the status bar** on Android (edge-to-edge), so the header must
 * offset by the top safe-area inset or the title tucks under the clock/battery (as the old
 * hand-rolled `measurements` header did). Use this on EVERY modal screen instead of a bespoke
 * header row — hand-rolled ones drifted (some added `insets.top`, some didn't) so modals didn't
 * match. One component = one source of truth for the top spacing. Layout mirrors the existing
 * modals: ✕ (close) · title · optional right action, with a bottom divider. See CLAUDE.md → "Modal screens".
 */
export function ModalHeader({
  title,
  onClose,
  right,
}: {
  title: string;
  onClose: () => void;
  /** Optional right-side action (e.g. a "Save" pressable). A 24px spacer keeps the title centred when omitted. */
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
      <Pressable onPress={onClose} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      <FsText variant="cardTitle" numberOfLines={1} style={styles.title}>{title}</FsText>
      {right ?? <View style={{ width: 24 }} />}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flexShrink: 1, textAlign: 'center', paddingHorizontal: space[2] },
}));
