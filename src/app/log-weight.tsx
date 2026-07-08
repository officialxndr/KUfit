import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, toDisplay, formatWeight, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const round1 = (n: number) => String(Math.round(n * 10) / 10);

export default function LogWeight() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);

  // `?date=YYYY-MM-DD` opens an existing weigh-in for editing; no param = log today.
  const params = useLocalSearchParams<{ date?: string }>();
  const editDate = typeof params.date === 'string' ? params.date : null;
  const entry = useMemo(() => (editDate ? healthRepo.getWeightEntryByDate(editDate) : null), [editDate]);
  const editing = !!entry;

  const prefillWeight = entry ? round1(toDisplay(entry.weightKg, unit)) : '';
  const [weight, setWeight] = useState(prefillWeight);
  const [bodyFat, setBodyFat] = useState(() => (entry?.bodyFat != null ? String(entry.bodyFat) : ''));

  const latest = healthRepo.getLatestWeightEntry();

  const save = () => {
    const val = Number(weight);
    if (!val || val <= 0) return Alert.alert('Enter a weight', 'Please enter a valid weight.');
    const bf = bodyFat.trim() ? Number(bodyFat) : null;
    if (bf != null && (!Number.isFinite(bf) || bf <= 0 || bf >= 100)) {
      return Alert.alert('Body fat', 'Enter a body-fat % between 0 and 100, or leave it blank to clear it.');
    }
    if (editing && entry) {
      // Preserve DEXA data; clearing the field removes just the body fat. Keep the stored kg at
      // full precision when the weight field wasn't touched (e.g. editing only the body fat).
      const kg = weight === prefillWeight ? entry.weightKg : toKg(val, unit);
      healthRepo.updateWeightEntryValues(entry.id, kg, bf);
    } else {
      healthRepo.upsertWeightEntry(today(), toKg(val, unit), bf ?? undefined);
    }
    syncBodyFatGoalWeight(); // weight/body-fat changed → refresh a body-fat-mode goal weight
    haptic.success();
    router.back();
  };

  const remove = () => {
    if (!entry) return;
    Alert.alert('Delete weigh-in?', `Remove the ${shortDate(entry.date)} entry entirely?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          healthRepo.deleteWeightEntry(entry.id);
          syncBodyFatGoalWeight();
          haptic.success();
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: space[3] }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">{editing ? 'Edit weigh-in' : 'Log weight'}</FsText>
        <Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>
      </View>

      <View style={{ padding: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
          <FsText variant="caption">
            {editing ? shortDate(entry!.date) : `Today${latest ? ` · last: ${formatWeight(latest.weightKg, unit)}` : ''}`}
          </FsText>
          {editing && entry?.source ? (
            <FsText variant="caption" style={{ color: colors.muted }}>· {entry.source === 'HEALTH' ? 'from Health' : entry.source.toLowerCase()}</FsText>
          ) : null}
        </View>
        <View style={styles.field}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="Weight"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            autoFocus={!editing}
            style={styles.input}
          />
          <FsText variant="bodyMedium" style={{ color: colors.muted }}>{UNIT_LABELS[unit].weight}</FsText>
        </View>
        <View style={[styles.field, { marginTop: space[3] }]}>
          <TextInput
            value={bodyFat}
            onChangeText={setBodyFat}
            placeholder={editing ? 'Body fat (blank clears it)' : 'Body fat (optional)'}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <FsText variant="bodyMedium" style={{ color: colors.muted }}>%</FsText>
        </View>
        <Button title="Save" onPress={save} style={{ marginTop: space[6] }} />
        {editing && (
          <Pressable onPress={remove} hitSlop={8} style={{ alignSelf: 'center', marginTop: space[4], padding: space[2] }}>
            <FsText variant="bodyMedium" style={{ color: colors.danger }}>Delete weigh-in</FsText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
}));
