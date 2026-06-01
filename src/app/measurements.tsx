import { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { SwipeToDelete } from '@/components/SwipeToDelete';

import { FsText, Card, Button, SectionHeader } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { inchesToCm } from '@/lib/units';
import { colors, radius, space } from '@/theme/tokens';
import type { BodyMeasurement } from '@/types';

const SITES: { key: keyof BodyMeasurement; label: string }[] = [
  { key: 'neck', label: 'Neck' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'leftArm', label: 'Left Arm' },
  { key: 'rightArm', label: 'Right Arm' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'leftThigh', label: 'Left Thigh' },
  { key: 'rightThigh', label: 'Right Thigh' },
  { key: 'leftCalf', label: 'Left Calf' },
  { key: 'rightCalf', label: 'Right Calf' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function MeasurementsScreen() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const isImperial = unit === 'IMPERIAL';
  const smallLabel = isImperial ? 'in' : 'cm';

  const [vals, setVals] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);

  const refresh = useCallback(() => setEntries(healthRepo.getMeasurements()), []);
  useFocusEffect(refresh);

  const toCm = (v: string) => (v.trim() === '' ? undefined : isImperial ? inchesToCm(Number(v)) : Number(v));
  const fromCm = (cm: number | null | undefined) =>
    cm == null ? '—' : `${isImperial ? +(cm / 2.54).toFixed(1) : +cm.toFixed(1)} ${smallLabel}`;

  const save = () => {
    const payload: any = { date: today() };
    let any = false;
    for (const { key } of SITES) {
      const cm = toCm(vals[key as string] ?? '');
      if (cm != null) { payload[key] = cm; any = true; }
    }
    if (!any) {
      Alert.alert('Nothing to save', 'Enter at least one measurement.');
      return;
    }
    healthRepo.addMeasurement(payload);
    setVals({});
    refresh();
  };

  const latest = entries[0];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Measurements</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title={`Log today (${smallLabel})`} />
          <View style={styles.grid}>
            {SITES.map(({ key, label }) => (
              <View key={key as string} style={styles.cell}>
                <FsText variant="caption" style={{ marginBottom: 4 }}>{label}</FsText>
                <TextInput
                  value={vals[key as string] ?? ''}
                  onChangeText={(t) => setVals((v) => ({ ...v, [key as string]: t }))}
                  keyboardType="decimal-pad"
                  placeholder={latest ? fromCm(latest[key] as number).replace(` ${smallLabel}`, '') : '—'}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
            ))}
          </View>
          <View style={{ height: space[2] }} />
          <Button title="Save Measurements" onPress={save} />
        </Card>

        <SectionHeader title="History" />
        {entries.length === 0 ? (
          <Card><FsText variant="caption">No measurements logged yet.</FsText></Card>
        ) : (
          entries.map((m) => {
            const filled = SITES.filter((s) => m[s.key] != null);
            return (
              <SwipeToDelete
                key={m.id}
                onDelete={() => { healthRepo.deleteMeasurement(m.id); refresh(); }}
                confirmTitle="Delete measurement?"
                confirmMessage={`Remove the ${m.date} measurement?`}
              >
                <Card style={{ marginBottom: space[3] }}>
                  <FsText variant="bodyMedium">{m.date}</FsText>
                  <FsText variant="caption" numberOfLines={2} style={{ marginTop: 2 }}>
                    {filled.map((s) => `${s.label} ${fromCm(m[s.key] as number)}`).join('  ·  ') || '—'}
                  </FsText>
                </Card>
              </SwipeToDelete>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cell: { width: '31%' },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 10, color: colors.text, fontSize: 14, textAlign: 'center',
  },
  entry: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
});
