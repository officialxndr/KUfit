import { View, Pressable, StyleSheet } from 'react-native';
import { X as XIcon } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import type { UseScale } from '@/lib/scales/useScale';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * Compact live-weigh strip: connection status + live grams + Tare/Simulate + close.
 * Shared by the food quantity sheet and custom-food (the standalone Settings screen
 * has its own larger readout). The parent owns the `useScale` instance and the simulate
 * toggle so the live grams can drive whatever field it wants.
 */
export function ScaleWeighBar({ scale, onSimulate, onClose }: { scale: UseScale; onSimulate: () => void; onClose: () => void }) {
  const connColor = scale.status === 'connected' ? colors.success : scale.status === 'error' ? colors.danger : colors.warning;
  const connLabel = scale.status === 'connected' ? (scale.deviceName ?? 'Connected') : scale.status === 'error' ? 'Not connected' : 'Searching…';
  return (
    <View style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: connColor }]} />
      <View style={{ flex: 1 }}>
        <FsText variant="caption" style={{ color: connColor }}>{connLabel}</FsText>
        {scale.status === 'connected' ? (
          <FsText variant="bodyMedium" style={{ fontVariant: ['tabular-nums'] }}>
            {scale.reading ? `${scale.reading.grams} g` : '– – g'}{scale.reading && !scale.reading.stable ? ' …' : ''}
          </FsText>
        ) : (
          <FsText variant="caption" style={{ color: colors.muted }}>{scale.error ?? 'Turn the scale on'}</FsText>
        )}
      </View>
      {scale.status === 'connected' ? (
        <Pressable style={styles.btn} onPress={scale.tare}><FsText variant="caption" style={{ color: colors.text }}>Tare</FsText></Pressable>
      ) : (
        <Pressable style={styles.btn} onPress={onSimulate}><FsText variant="caption" style={{ color: colors.text }}>Simulate</FsText></Pressable>
      )}
      <Pressable style={styles.btn} onPress={onClose} hitSlop={6}><XIcon color={colors.muted} size={16} /></Pressable>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: space[2], paddingHorizontal: space[3],
  },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
}));
