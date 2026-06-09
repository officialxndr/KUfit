import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Card, Button, SectionHeader } from '@/components/ui';
import { useScale } from '@/lib/scales/useScale';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * Settings → Bluetooth scale: connect + live readout + tare, plus a raw-packet inspector
 * to confirm a scale's BLE frame layout on first connect (the protocol-confirmation tool).
 */
export default function ScaleScreen() {
  const router = useRouter();
  const [sim, setSim] = useState(false);
  const scale = useScale({ simulate: sim });

  useEffect(() => {
    scale.start();
    return () => scale.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);

  const connColor = scale.status === 'connected' ? colors.success : scale.status === 'error' ? colors.danger : colors.warning;
  const connLabel = scale.status === 'connected' ? 'Connected' : scale.status === 'error' ? 'Not connected' : 'Searching…';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Bluetooth scale</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}>
        {/* Live readout */}
        <Card style={{ alignItems: 'center', paddingVertical: space[6], marginBottom: space[3] }}>
          <View style={styles.conn}>
            <View style={[styles.dot, { backgroundColor: connColor }]} />
            <FsText variant="caption" style={{ color: connColor }}>{connLabel}{scale.deviceName ? ` · ${scale.deviceName}` : ''}</FsText>
          </View>
          <FsText style={[styles.big, scale.reading?.stable ? { color: colors.success } : {}]}>
            {scale.reading ? scale.reading.grams.toFixed(1) : '– –'}
            <FsText style={styles.unit}> g</FsText>
          </FsText>
          {scale.reading && !scale.reading.stable && <FsText variant="caption" style={{ color: colors.muted }}>measuring…</FsText>}
          {scale.reading?.displayUnit && scale.reading.displayUnit !== 'g' && (
            <FsText variant="caption" style={{ color: colors.muted }}>scale display: {scale.reading.displayUnit}</FsText>
          )}
          {scale.status === 'error' && !!scale.error && (
            <FsText variant="caption" style={{ color: colors.danger, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>{scale.error}</FsText>
          )}
        </Card>

        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[3] }}>
          <View style={{ flex: 1 }}><Button title="Tare" variant="ghost" onPress={scale.tare} disabled={scale.status !== 'connected'} /></View>
          <View style={{ flex: 1 }}><Button title={sim ? 'Stop simulator' : 'Simulator'} variant="ghost" onPress={() => setSim((s) => !s)} /></View>
        </View>
        <FsText variant="caption" style={{ marginBottom: space[4] }}>
          Tare zeroes the reading{scale.tareSupported ? '' : ' in-app'} — you can also press the scale’s own TARE button.
          Real hardware needs a dev build; use the simulator to preview.
        </FsText>

        {/* Raw inspector — confirm the frame layout on first connect */}
        <Card>
          <SectionHeader title="Protocol inspector" />
          <FsText variant="caption" style={{ marginBottom: space[2] }}>
            Last raw notification from the scale. On first connect with a new scale, change its
            display unit / add weight and watch which bytes move to confirm the parser.
          </FsText>
          <View style={styles.hexBox}>
            <FsText variant="caption" style={styles.hex}>{scale.lastRawHex ?? '— no frames yet —'}</FsText>
          </View>
          {scale.reading && (
            <FsText variant="caption" style={{ marginTop: space[2], color: colors.muted }}>
              parsed → {scale.reading.grams} g · {scale.reading.stable ? 'stable' : 'live'}
              {scale.reading.raw != null ? ` · raw ${scale.reading.raw}` : ''}
            </FsText>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  conn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  big: { fontSize: 64, lineHeight: 72, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 22, fontWeight: '600', color: colors.muted },
  hexBox: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: space[3] },
  hex: { fontVariant: ['tabular-nums'], color: colors.text },
}));
