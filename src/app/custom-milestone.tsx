import { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FsText, Button, Chip } from '@/components/ui';
import { ModalHeader } from '@/components/ModalHeader';
import { DateField } from '@/components/DateField';
import { StepperField } from '@/components/StepperField';
import { useSettingsStore, type CustomMilestone } from '@/stores/settingsStore';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const thisYear = () => new Date().getFullYear();

/**
 * Add / edit one custom milestone on the weight-progress card (Health → Weight). A
 * milestone is either a **target weight** (→ the card projects the date you'll reach it)
 * or a **target date/event** like Thanksgiving (→ the card projects the weight you'll be),
 * with an optional label. Persisted on `profile.customMilestones`.
 */
export default function CustomMilestoneEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const unit = profile.unitSystem;
  const wLabel = UNIT_LABELS[unit].weight;
  const list = profile.customMilestones ?? [];
  const existing = list.find((m) => m.id === id);

  const [label, setLabel] = useState(existing?.label ?? '');
  const [kind, setKind] = useState<'weight' | 'date'>(existing?.kind ?? 'weight');
  const seedKg = existing?.kind === 'weight' ? existing.weightKg : (profile.goalWeightKg ?? 75);
  const [weightDisp, setWeightDisp] = useState(() => toDisplay(seedKg, unit));
  const [date, setDate] = useState<string | null>(existing?.kind === 'date' ? existing.date : null);

  const save = () => {
    if (kind === 'date' && !date) {
      Alert.alert('Pick a date', 'Choose the date or event you want to project your weight to.');
      return;
    }
    const base = { id: existing?.id ?? newId(), label: label.trim() || undefined };
    const milestone: CustomMilestone = kind === 'weight'
      ? { ...base, kind: 'weight', weightKg: toKg(weightDisp, unit) }
      : { ...base, kind: 'date', date: date! };
    const next = existing ? list.map((m) => (m.id === milestone.id ? milestone : m)) : [...list, milestone];
    setProfile({ customMilestones: next });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete milestone?', 'Remove this custom milestone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setProfile({ customMilestones: list.filter((m) => m.id !== existing.id) });
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ModalHeader
        title={existing ? 'Edit milestone' : 'Add milestone'}
        onClose={() => router.back()}
        right={<Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>}
      />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[8] }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <FsText variant="caption">Label (optional)</FsText>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Thanksgiving, my birthday"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={{ gap: 6 }}>
          <FsText variant="caption">Milestone type</FsText>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Chip label="Target weight" selected={kind === 'weight'} onPress={() => setKind('weight')} />
            <Chip label="Target date" selected={kind === 'date'} onPress={() => setKind('date')} />
          </View>
          <FsText variant="caption" style={{ color: colors.muted }}>
            {kind === 'weight'
              ? 'Pick a weight — the card shows the date you’re projected to reach it.'
              : 'Pick a date or event — the card shows the weight you’re projected to be then.'}
          </FsText>
        </View>

        {kind === 'weight' ? (
          <View style={{ gap: 6 }}>
            <FsText variant="caption">Target weight</FsText>
            <StepperField value={weightDisp} onCommit={setWeightDisp} step={1} min={40} max={800} unit={wLabel} />
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <FsText variant="caption">Date</FsText>
            <DateField value={date} onChange={setDate} placeholder="Select date" minYear={thisYear()} maxYear={thisYear() + 5} />
          </View>
        )}

        {existing && <Button title="Delete milestone" variant="ghost" onPress={remove} style={{ marginTop: space[2] }} />}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14 },
}));
