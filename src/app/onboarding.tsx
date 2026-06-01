import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Dumbbell, ChevronLeft } from 'lucide-react-native';

import { FsText, Button, Chip } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { ACTIVITY_DESCRIPTIONS } from '@/lib/tdee';
import { toKg, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import type { ActivityLevel, GoalType, Sex, UnitSystem } from '@/types';

const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const ACTIVITIES: ActivityLevel[] = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];
const GOALS: GoalType[] = ['LOSE', 'MAINTAIN', 'GAIN'];
const STEPS = 4;

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setProfile = useSettingsStore((s) => s.setProfile);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<UnitSystem>('IMPERIAL');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('MODERATE');
  const [goalType, setGoalType] = useState<GoalType>('MAINTAIN');
  const [goalWeight, setGoalWeight] = useState('');

  const next = () => { haptic.tap(); setStep((s) => Math.min(s + 1, STEPS - 1)); };
  const back = () => { haptic.tap(); setStep((s) => Math.max(s - 1, 0)); };

  const finish = () => {
    setProfile({
      name: name.trim() || null,
      unitSystem: unit,
      sex,
      heightCm: height.trim() ? Number(height) : null,
      birthDate: birthDate.trim() || null,
      activityLevel: activity,
      goalType,
      goalWeightKg: goalWeight.trim() ? toKg(Number(goalWeight), unit) : null,
    });
    completeOnboarding();
    haptic.success();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        {step > 0 ? (
          <Pressable onPress={back} hitSlop={10}><ChevronLeft color={colors.text} size={24} /></Pressable>
        ) : <View style={{ width: 24 }} />}
        <View style={styles.dots}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <View style={styles.brand}><Dumbbell color={colors.primary} size={40} /></View>
            <FsText variant="display" style={{ textAlign: 'center' }}>Welcome to FitSelf</FsText>
            <FsText variant="bodyMedium" style={{ textAlign: 'center', color: colors.muted, marginBottom: space[6] }}>
              Your private, local-first fitness log. Let's set up your profile.
            </FsText>
            <Field label="What should we call you?">
              <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
            <Field label="Units">
              <View style={styles.chipRow}>
                <Chip label="Imperial (lb)" selected={unit === 'IMPERIAL'} onPress={() => setUnit('IMPERIAL')} />
                <Chip label="Metric (kg)" selected={unit === 'METRIC'} onPress={() => setUnit('METRIC')} />
              </View>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <FsText variant="display">About you</FsText>
            <FsText variant="caption" style={{ marginBottom: space[6] }}>Used to estimate your calorie needs (TDEE).</FsText>
            <Field label="Sex">
              <View style={styles.chipRow}>
                {SEXES.map((s) => <Chip key={s} label={s[0] + s.slice(1).toLowerCase()} selected={sex === s} onPress={() => setSex(s)} />)}
              </View>
            </Field>
            <Field label={`Height (${unit === 'METRIC' ? 'cm' : 'cm'})`}>
              <TextInput value={height} onChangeText={setHeight} placeholder="178" placeholderTextColor={colors.muted} keyboardType="numeric" style={styles.input} />
            </Field>
            <Field label="Birth date (YYYY-MM-DD)">
              <TextInput value={birthDate} onChangeText={setBirthDate} placeholder="1995-04-12" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <FsText variant="display">Activity level</FsText>
            <FsText variant="caption" style={{ marginBottom: space[4] }}>How active are you day to day?</FsText>
            <View style={{ gap: space[2] }}>
              {ACTIVITIES.map((a) => (
                <Pressable key={a} onPress={() => setActivity(a)} style={[styles.option, activity === a && styles.optionOn]}>
                  <FsText variant="bodyMedium">{a[0] + a.slice(1).toLowerCase().replace('_', ' ')}</FsText>
                  <FsText variant="caption">{ACTIVITY_DESCRIPTIONS[a]}</FsText>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <FsText variant="display">Your goal</FsText>
            <FsText variant="caption" style={{ marginBottom: space[6] }}>This drives your calorie & macro targets.</FsText>
            <Field label="I want to">
              <View style={styles.chipRow}>
                {GOALS.map((g) => <Chip key={g} label={g[0] + g.slice(1).toLowerCase()} selected={goalType === g} onPress={() => setGoalType(g)} />)}
              </View>
            </Field>
            {goalType !== 'MAINTAIN' && (
              <Field label={`Goal weight (${UNIT_LABELS[unit].weight})`}>
                <TextInput value={goalWeight} onChangeText={setGoalWeight} placeholder="optional" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={styles.input} />
              </Field>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom || space[4] }]}>
        {step < STEPS - 1 ? (
          <Button title="Continue" onPress={next} />
        ) : (
          <Button title="Get started" onPress={finish} />
        )}
        {step === 0 && (
          <Pressable onPress={finish} style={{ alignItems: 'center', paddingTop: space[3] }}>
            <FsText variant="caption">Skip for now</FsText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space[4] }}>
      <FsText variant="caption" style={{ marginBottom: 6 }}>{label}</FsText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingBottom: space[3] },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  brand: {
    alignSelf: 'center', width: 80, height: 80, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: space[4], marginTop: space[6],
  },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: { padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: 'transparent' },
  optionOn: { borderColor: colors.primary },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.border },
});
