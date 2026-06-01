import { View, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Hammer } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { colors, space, radius } from '@/theme/tokens';

/** On-brand placeholder for sub-tabs whose feature isn't built yet. */
export function ComingSoon({
  title,
  description,
  icon: Icon = Hammer,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon color={colors.muted} size={28} />
      </View>
      <FsText variant="cardTitle" style={{ color: colors.muted }}>{title}</FsText>
      {description ? (
        <FsText variant="caption" style={styles.desc}>{description}</FsText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space[8] * 2,
    gap: space[2],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  desc: { textAlign: 'center', maxWidth: 260 },
});
