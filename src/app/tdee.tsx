import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Card, Chip, Button, SectionHeader } from '@/components/ui';
import { calcTDEE, ACTIVITY_DESCRIPTIONS, type TDEEInputs } from '@/lib/tdee';
import { useSettingsStore } from '@/stores/settingsStore';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { ActivityLevel, Sex } from '@/types';

const ACTIVITIES: ActivityLevel[] = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];
const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];

function ageFromBirth(birthDate: string | null): string {
  if (!birthDate) return '';
  const years = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000);
  return years > 0 && years < 130 ? String(Math.floor(years)) : '';
}

export default function TDEECalculator() {
  const router = useRouter();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const unit = profile.unitSystem;
  const latest = healthRepo.getLatestWeightEntry();

  const [weight, setWeight] = useState(
    latest ? String(toDisplay(latest.weightKg, unit)) : ''
  );
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? '');
  const [age, setAge] = useState(ageFromBirth(profile.birthDate));
  const [sex, setSex] = useState<Sex>(profile.sex ?? 'MALE');
  const [activity, setActivity] = useState<ActivityLevel>(profile.activityLevel);

  const result = useMemo(() => {
    const w = Number(weight), h = Number(height), a = Number(age);
    if (!w || !h || !a) return null;
    const inputs: TDEEInputs = { weightKg: toKg(w, unit), heightCm: h, ageYears: a, sex, activityLevel: activity };
    return calcTDEE(inputs);
  }, [weight, height, age, sex, activity, unit]);

  const rows = result
    ? [
        { label: 'Moderate loss (~1 lb/wk)', value: result.targets.moderateLoss },
        { label: 'Mild loss (~0.5 lb/wk)', value: result.targets.mildLoss },
        { label: 'Maintain', value: result.targets.maintain },
        { label: 'Mild gain (~0.5 lb/wk)', value: result.targets.mildGain },
        { label: 'Moderate gain (~1 lb/wk)', value: result.targets.moderateGain },
      ]
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">TDEE Calculator</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        <Card style={{ marginBottom: space[3] }}>
          <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[3] }}>
            <NumCol label={`Weight (${UNIT_LABELS[unit].weight})`} value={weight} onChange={setWeight} />
            <NumCol label="Height (cm)" value={height} onChange={setHeight} />
            <NumCol label="Age" value={age} onChange={setAge} />
          </View>
          <FsText variant="caption" style={{ marginBottom: 6 }}>Sex</FsText>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {SEXES.map((s) => (
              <Chip key={s} label={s[0] + s.slice(1).toLowerCase()} selected={sex === s} onPress={() => setSex(s)} />
            ))}
          </View>
        </Card>

        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="Activity" />
          <View style={{ gap: space[2] }}>
            {ACTIVITIES.map((a) => (
              <Pressable
                key={a}
                onPress={() => setActivity(a)}
                style={[styles.opt, activity === a && { borderColor: colors.primary }]}
              >
                <FsText variant="bodyMedium">{a[0] + a.slice(1).toLowerCase().replace('_', ' ')}</FsText>
                <FsText variant="caption">{ACTIVITY_DESCRIPTIONS[a]}</FsText>
              </Pressable>
            ))}
          </View>
        </Card>

        {result && (
          <Card>
            <SectionHeader title="Your estimates" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space[3] }}>
              <View><FsText variant="caption">BMR</FsText><FsText variant="stat">{result.bmr}</FsText></View>
              <View><FsText variant="caption">Maintenance TDEE</FsText><FsText variant="stat">{result.tdee}</FsText></View>
            </View>
            {rows.map((r) => (
              <View key={r.label} style={styles.targetRow}>
                <FsText variant="body">{r.label}</FsText>
                <FsText variant="bodyMedium">{r.value} kcal</FsText>
              </View>
            ))}
            <FsText variant="caption" style={{ marginTop: space[3] }}>
              These are estimates — your real number is dialed in over 2–3 weeks by comparing
              predicted vs. actual weight change.
            </FsText>
            <View style={{ height: space[3] }} />
            <Button
              title="Use Maintenance as my calorie goal"
              onPress={() => {
                setProfile({ calorieGoal: result.tdee });
                router.back();
              }}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NumCol({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <FsText variant="caption" style={{ marginBottom: 4 }}>{label}</FsText>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.input} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontSize: 15, textAlign: 'center',
  },
  opt: {
    padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceHigh,
    borderWidth: 1, borderColor: 'transparent',
  },
  targetRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
}));
