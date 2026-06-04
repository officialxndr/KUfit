import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const today = () => new Date().toISOString().slice(0, 10);
const numOrNull = (s: string) => (s.trim() ? Number(s) : null);

/**
 * Dedicated DEXA-scan entry. A scan reports the full 3-compartment breakdown
 * (fat + lean soft tissue + bone) plus visceral fat and a bone-density T-score —
 * more than a normal weigh-in. We store it as a weigh-in marked source 'DEXA' so the
 * Body subview can anchor accurate composition to it and carry the ~constant values
 * (bone, T-score) forward between scans. Fat / lean mass are derived, not entered.
 */
export default function LogDexa() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const wLabel = UNIT_LABELS[unit].weight;

  const [date, setDate] = useState<string>(today());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [bone, setBone] = useState('');
  const [visceral, setVisceral] = useState('');
  const [tScore, setTScore] = useState('');

  const save = () => {
    const w = Number(weight);
    if (!w || w <= 0) return Alert.alert('Enter a weight', 'A scan weight is required.');
    if (!date) return Alert.alert('Pick a date', 'Choose the date of your scan.');
    healthRepo.logDexaScan({
      date,
      weightKg: toKg(w, unit),
      bodyFat: numOrNull(bodyFat),
      boneMassKg: bone.trim() ? toKg(Number(bone), unit) : null,
      visceralFatKg: visceral.trim() ? toKg(Number(visceral), unit) : null,
      boneTScore: numOrNull(tScore),
    });
    syncBodyFatGoalWeight(); // a DEXA re-baselines body fat → refresh a body-fat-mode goal weight
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: space[3] }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">Log DEXA scan</FsText>
        <Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[8] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <FsText variant="caption" style={{ marginBottom: space[4] }}>
          Enter the numbers from your scan report. Body fat, bone mass and T-score come straight off the
          report; fat and lean mass are calculated for you so they always add up to your weight.
        </FsText>

        <Label text="Scan date" />
        <View style={{ marginBottom: space[4] }}>
          <DateField value={date} onChange={(v) => setDate(v ?? today())} placeholder="Select scan date" maxYear={new Date().getFullYear()} />
        </View>

        <Label text={`Total weight (${wLabel})`} />
        <Field value={weight} onChangeText={setWeight} placeholder="Total mass" suffix={wLabel} autoFocus />

        <Label text="Body fat %" />
        <Field value={bodyFat} onChangeText={setBodyFat} placeholder="e.g. 22.4" suffix="%" />

        <Label text={`Bone mass (${wLabel})`} />
        <Field value={bone} onChangeText={setBone} placeholder="Bone mineral content" suffix={wLabel} />

        <Label text={`Visceral fat (${wLabel})`} />
        <Field value={visceral} onChangeText={setVisceral} placeholder="Visceral fat" suffix={wLabel} />

        <Label text="Bone density (T-score)" />
        <Field value={tScore} onChangeText={setTScore} placeholder="e.g. 1.2" suffix="SD" keyboardType="numbers-and-punctuation" />

        <FsText variant="caption" style={{ marginTop: space[3], color: colors.muted }}>
          Bone mass and T-score barely change between scans, so we carry them forward. Visceral fat is shown
          from this scan with a direction cue from your waist trend until your next one.
        </FsText>

        <Button title="Save scan" onPress={save} style={{ marginTop: space[6] }} />
      </ScrollView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <FsText variant="caption" style={{ marginBottom: 6 }}>{text}</FsText>;
}

function Field({
  value, onChangeText, placeholder, suffix, autoFocus = false, keyboardType = 'decimal-pad',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  suffix: string;
  autoFocus?: boolean;
  keyboardType?: 'decimal-pad' | 'numbers-and-punctuation';
}) {
  return (
    <View style={[styles.field, { marginBottom: space[4] }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        style={styles.input}
      />
      <FsText variant="bodyMedium" style={{ color: colors.muted }}>{suffix}</FsText>
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
