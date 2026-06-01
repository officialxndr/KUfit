import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, formatWeight, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';

const today = () => new Date().toISOString().slice(0, 10);

export default function LogWeight() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');

  const latest = healthRepo.getLatestWeightEntry();

  const save = () => {
    const val = Number(weight);
    if (!val || val <= 0) return Alert.alert('Enter a weight', 'Please enter a valid weight.');
    healthRepo.upsertWeightEntry(today(), toKg(val, unit), bodyFat.trim() ? Number(bodyFat) : undefined);
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">Log weight</FsText>
        <Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>
      </View>

      <View style={{ padding: space[4] }}>
        <FsText variant="caption" style={{ marginBottom: space[2] }}>
          Today{latest ? ` · last: ${formatWeight(latest.weightKg, unit)}` : ''}
        </FsText>
        <View style={styles.field}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="Weight"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            autoFocus
            style={styles.input}
          />
          <FsText variant="bodyMedium" style={{ color: colors.muted }}>{UNIT_LABELS[unit].weight}</FsText>
        </View>
        <View style={[styles.field, { marginTop: space[3] }]}>
          <TextInput
            value={bodyFat}
            onChangeText={setBodyFat}
            placeholder="Body fat (optional)"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <FsText variant="bodyMedium" style={{ color: colors.muted }}>%</FsText>
        </View>
        <Button title="Save" onPress={save} style={{ marginTop: space[6] }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingBottom: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 18 },
});
