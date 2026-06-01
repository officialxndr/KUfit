import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, FsText, SectionHeader, Chip, Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { ACTIVITY_DESCRIPTIONS } from '@/lib/tdee';
import { downloadAllMedia } from '@/lib/exerciseMedia';
import { toDisplay, toKg, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space } from '@/theme/tokens';
import { type } from '@/theme/text';
import type { ActivityLevel, GoalType, Sex, UnitSystem } from '@/types';

const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const ACTIVITIES: ActivityLevel[] = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];
const GOALS: GoalType[] = ['LOSE', 'MAINTAIN', 'GAIN'];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  suffix?: string;
}) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <FsText variant="caption" style={{ marginBottom: 6 }}>{label}</FsText>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          style={styles.input}
        />
        {suffix ? <FsText variant="caption">{suffix}</FsText> : null}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const router = useRouter();
  const unit = profile.unitSystem;

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  const downloadDemos = async () => {
    setDownloading(true);
    setDownloadProgress('Starting…');
    const res = await downloadAllMedia((done, total) => {
      if (done % 25 === 0 || done === total) setDownloadProgress(`${done} / ${total}`);
    });
    setDownloading(false);
    setDownloadProgress('');
    Alert.alert('Offline demos', `Cached media for ${res.total} exercises.`);
  };

  // Local text mirrors for numeric fields
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? '');
  const [goalWeight, setGoalWeight] = useState(
    profile.goalWeightKg != null ? String(toDisplay(profile.goalWeightKg, unit)) : ''
  );
  const [calorieGoal, setCalorieGoal] = useState(profile.calorieGoal?.toString() ?? '');
  const [protein, setProtein] = useState(profile.proteinTarget?.toString() ?? '');
  const [carbs, setCarbs] = useState(profile.carbsTarget?.toString() ?? '');
  const [fat, setFat] = useState(profile.fatTarget?.toString() ?? '');

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const switchUnit = (next: UnitSystem) => {
    setProfile({ unitSystem: next });
    if (profile.goalWeightKg != null) setGoalWeight(String(toDisplay(profile.goalWeightKg, next)));
  };

  return (
    <Screen>
      <FsText variant="h1" style={{ paddingTop: space[2], marginBottom: space[4] }}>Settings</FsText>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Units" />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Chip label="Metric (kg, cm)" selected={unit === 'METRIC'} onPress={() => switchUnit('METRIC')} />
          <Chip label="Imperial (lbs)" selected={unit === 'IMPERIAL'} onPress={() => switchUnit('IMPERIAL')} />
        </View>
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Profile" />
        <Field label="Name" value={profile.name ?? ''} onChangeText={(t) => setProfile({ name: t || null })} placeholder="Your name" />
        <Field
          label="Height"
          value={heightCm}
          onChangeText={(t) => { setHeightCm(t); setProfile({ heightCm: num(t) }); }}
          keyboardType="numeric"
          suffix="cm"
          placeholder="178"
        />
        <Field
          label="Birth date (YYYY-MM-DD)"
          value={profile.birthDate ?? ''}
          onChangeText={(t) => setProfile({ birthDate: t || null })}
          placeholder="1995-04-12"
        />
        <FsText variant="caption" style={{ marginBottom: 6 }}>Sex</FsText>
        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[2] }}>
          {SEXES.map((s) => (
            <Chip key={s} label={s[0] + s.slice(1).toLowerCase()} selected={profile.sex === s} onPress={() => setProfile({ sex: s })} />
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Activity Level" />
        <View style={{ gap: space[2] }}>
          {ACTIVITIES.map((a) => (
            <Pressable
              key={a}
              onPress={() => setProfile({ activityLevel: a })}
              style={[styles.optionRow, profile.activityLevel === a && styles.optionRowActive]}
            >
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">{a[0] + a.slice(1).toLowerCase().replace('_', ' ')}</FsText>
                <FsText variant="caption">{ACTIVITY_DESCRIPTIONS[a]}</FsText>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Goal" />
        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[3] }}>
          {GOALS.map((g) => (
            <Chip key={g} label={g[0] + g.slice(1).toLowerCase()} selected={profile.goalType === g} onPress={() => setProfile({ goalType: g })} />
          ))}
        </View>
        <Field
          label="Goal weight"
          value={goalWeight}
          onChangeText={(t) => { setGoalWeight(t); setProfile({ goalWeightKg: t.trim() === '' ? null : toKg(Number(t), unit) }); }}
          keyboardType="decimal-pad"
          suffix={UNIT_LABELS[unit].weight}
          placeholder="75"
        />
        <Field
          label="Goal date (YYYY-MM-DD)"
          value={profile.goalDate ?? ''}
          onChangeText={(t) => setProfile({ goalDate: t || null })}
          placeholder="2026-09-01"
        />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Tools" />
        <Button title="Open TDEE Calculator" variant="ghost" onPress={() => router.push('/tdee')} />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Offline" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Download all exercise demo GIFs to this device so the library works without internet.
        </FsText>
        <Button
          title={downloading ? `Downloading… ${downloadProgress}` : 'Download exercise demos'}
          onPress={downloadDemos}
          loading={downloading}
          disabled={downloading}
        />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Targets (optional)" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Leave calories blank to auto-calculate from your TDEE and goal.
        </FsText>
        <Field label="Calorie override" value={calorieGoal} onChangeText={(t) => { setCalorieGoal(t); setProfile({ calorieGoal: num(t) }); }} keyboardType="numeric" suffix="kcal" placeholder="auto" />
        <Field label="Protein target" value={protein} onChangeText={(t) => { setProtein(t); setProfile({ proteinTarget: num(t) }); }} keyboardType="numeric" suffix="g" />
        <Field label="Carbs target" value={carbs} onChangeText={(t) => { setCarbs(t); setProfile({ carbsTarget: num(t) }); }} keyboardType="numeric" suffix="g" />
        <Field label="Fat target" value={fat} onChangeText={(t) => { setFat(t); setProfile({ fatTarget: num(t) }); }} keyboardType="numeric" suffix="g" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowActive: { borderColor: colors.primary },
});
