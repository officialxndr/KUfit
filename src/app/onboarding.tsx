import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Switch, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Dumbbell, ChevronLeft, Sparkles, ShieldCheck, Check, UserCircle, Camera, Heart } from 'lucide-react-native';

import { FsText, Button, Chip } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { HeightField } from '@/components/HeightField';
import { Confetti } from '@/components/anim/Confetti';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTourStore } from '@/stores/tourStore';
import { ACTIVITY_DESCRIPTIONS } from '@/lib/tdee';
import { health, healthPlatformLabel } from '@/lib/health';
import { toKg, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { pickAvatar } from '@/lib/avatar';
import { openSupport } from '@/lib/support';
import { useDonationStore } from '@/stores/donationStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { ActiveCalorieSource, ActivityLevel, GoalType, Sex, UnitSystem } from '@/types';

const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const ACTIVITIES: ActivityLevel[] = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];
const GOALS: GoalType[] = ['LOSE', 'MAINTAIN', 'GAIN'];
const ACTIVE_CAL: { key: ActiveCalorieSource; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'auto', label: 'Automatic' },
  { key: 'watch', label: 'Watch only' },
  { key: 'inapp', label: 'In-app only' },
];
const PRIVACY_POINTS: [string, string][] = [
  ['No account, no servers', "Everything you log stays on your device — we literally can't see your data."],
  ['Never sold or tracked', 'No ads, no analytics, no tracking SDKs. Your health data is yours alone.'],
  ['Free forever', 'No subscriptions, no paywalls, nothing locked away. Optional donations only.'],
  ['Only food lookups go out', 'Searching a food sends just the name/barcode to Open Food Facts — never your personal info.'],
];
const STEPS = 7;

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setProfile = useSettingsStore((s) => s.setProfile);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [unit, setUnit] = useState<UnitSystem>('IMPERIAL');
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('MODERATE');
  const [goalType, setGoalType] = useState<GoalType>('MAINTAIN');
  const [goalWeight, setGoalWeight] = useState('');
  const [confetti, setConfetti] = useState(true);
  const [useNavy, setUseNavy] = useState(true);
  const [activeCal, setActiveCal] = useState<ActiveCalorieSource>('off');
  const [showConfetti, setShowConfetti] = useState(false);

  const next = () => { haptic.tap(); setStep((s) => Math.min(s + 1, STEPS - 1)); };
  const back = () => { haptic.tap(); setStep((s) => Math.max(s - 1, 0)); };

  const connectHealth = async () => {
    if (!health.isAvailable()) {
      Alert.alert(healthPlatformLabel, `${healthPlatformLabel} activates in a full build of the app — you can connect it later from Settings → Health.`);
      return;
    }
    const granted = await health.requestPermissions();
    Alert.alert(healthPlatformLabel, granted
      ? 'Connected — your weight, activity and heart rate can sync.'
      : 'Permission wasn’t granted. You can connect later in Settings → Health.');
  };

  const changeAvatar = async () => {
    const uri = await pickAvatar();
    if (uri) setAvatarUri(uri);
  };

  const finish = () => {
    setProfile({
      name: name.trim() || null,
      avatarUri,
      unitSystem: unit,
      sex,
      heightCm,
      birthDate: birthDate.trim() || null,
      activityLevel: activity,
      goalType,
      goalWeightKg: goalWeight.trim() ? toKg(Number(goalWeight), unit) : null,
      confettiEnabled: confetti,
      navyBodyFatEnabled: useNavy,
      activeCalorieSource: activeCal,
    });
    completeOnboarding();
    haptic.success();
    // Brand-new users land into the guided feature tour (skippable on step 1).
    useTourStore.getState().start();
    router.replace('/(tabs)');
  };

  const finishDonate = () => { useDonationStore.getState().markDonated(); openSupport(); finish(); };
  const finishRemind = () => { useDonationStore.getState().remindLater(); finish(); };
  const finishDismiss = () => { useDonationStore.getState().dismissForever(); finish(); };

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
            <FsText variant="display" style={{ textAlign: 'center' }}>Welcome to Hale</FsText>
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
            <View style={styles.brand}><ShieldCheck color={colors.primary} size={38} /></View>
            <FsText variant="display" style={{ textAlign: 'center' }}>Private by design</FsText>
            <FsText variant="bodyMedium" style={{ textAlign: 'center', color: colors.muted, marginBottom: space[6] }}>
              The promise behind Hale — and it never changes:
            </FsText>
            {PRIVACY_POINTS.map(([t, d]) => (
              <View key={t} style={styles.valueRow}>
                <Check color={colors.success} size={18} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <FsText variant="bodyMedium">{t}</FsText>
                  <FsText variant="caption">{d}</FsText>
                </View>
              </View>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <FsText variant="display">About you</FsText>
            <FsText variant="caption" style={{ marginBottom: space[6] }}>Used to estimate your calorie needs (TDEE).</FsText>
            <Pressable onPress={changeAvatar} style={styles.avatarRow}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder]}><UserCircle color={colors.muted} size={36} /></View>
              )}
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">Profile photo</FsText>
                <FsText variant="caption">Optional — tap to add a picture</FsText>
              </View>
              <Camera color={colors.primary} size={20} />
            </Pressable>
            <Field label="Sex">
              <View style={styles.chipRow}>
                {SEXES.map((s) => <Chip key={s} label={s[0] + s.slice(1).toLowerCase()} selected={sex === s} onPress={() => setSex(s)} />)}
              </View>
            </Field>
            <Field label="Height">
              <HeightField valueCm={heightCm} onChange={setHeightCm} system={unit} />
            </Field>
            <Field label="Birth date">
              <DateField
                value={birthDate || null}
                onChange={(v) => setBirthDate(v ?? '')}
                placeholder="Select your birth date"
                minYear={1900}
                maxYear={new Date().getFullYear()}
                mode="cascade"
              />
            </Field>
          </>
        )}

        {step === 3 && (
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

        {step === 4 && (
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

        {step === 5 && (
          <>
            <FsText variant="display">Preferences</FsText>
            <FsText variant="caption" style={{ marginBottom: space[6] }}>Optional — change any of these later in Settings.</FsText>

            <View style={styles.healthBlock}>
              <FsText variant="bodyMedium">Connect {healthPlatformLabel}</FsText>
              <FsText variant="caption" style={{ color: colors.muted, marginBottom: space[2] }}>
                Optional. Sync your weight, steps and heart rate — read-only, and it never leaves your device.
              </FsText>
              <Button title={`Connect ${healthPlatformLabel}`} variant="ghost" onPress={connectHealth} />
            </View>

            <ToggleRow
              label="Celebration confetti"
              desc="A confetti burst when you hit a PR or your goal weight."
              value={confetti}
              onValueChange={setConfetti}
            />
            <Pressable onPress={() => { haptic.tap(); setConfetti(true); setShowConfetti(true); }} style={styles.previewBtn}>
              <Sparkles color={colors.primary} size={16} />
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>Preview confetti</FsText>
            </Pressable>

            <ToggleRow
              label="U.S. Navy body-fat estimate"
              desc="Estimate body-fat % from tape measurements (neck/waist/hips) + your height."
              value={useNavy}
              onValueChange={setUseNavy}
            />

            <View style={{ marginTop: space[4] }}>
              <FsText variant="caption" style={{ marginBottom: 4 }}>Add active calories to your budget</FsText>
              <FsText variant="caption" style={{ color: colors.muted, marginBottom: space[2] }}>
                Eat back energy burned from workouts or your Apple Watch / Health.
              </FsText>
              <View style={styles.chipRow}>
                {ACTIVE_CAL.map((o) => (
                  <Chip key={o.key} label={o.label} selected={activeCal === o.key} onPress={() => setActiveCal(o.key)} />
                ))}
              </View>
            </View>
          </>
        )}

        {step === 6 && (
          <>
            <View style={styles.brand}><Heart color={colors.primary} size={36} /></View>
            <FsText variant="display" style={{ textAlign: 'center' }}>One last thing</FsText>
            <FsText variant="bodyMedium" style={{ textAlign: 'center', color: colors.muted, marginBottom: space[6] }}>
              Hale is free forever — no ads, no subscriptions, nothing paywalled. If you'd like to help keep it
              that way, an optional donation means a lot. Totally your call.
            </FsText>
            <View style={{ gap: space[2] }}>
              <Button title="Donate" onPress={finishDonate} />
              <Button title="Remind me later" variant="ghost" onPress={finishRemind} />
              <Button title="No thanks" variant="ghost" onPress={finishDismiss} />
            </View>
            <FsText variant="caption" style={{ textAlign: 'center', color: colors.muted, marginTop: space[4] }}>
              You can always donate later from Settings → Support Hale.
            </FsText>
          </>
        )}
      </ScrollView>

      {step < STEPS - 1 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom || space[4] }]}>
          <Button title="Continue" onPress={next} />
          {step === 0 && (
            <Pressable onPress={finish} style={{ alignItems: 'center', paddingTop: space[3] }}>
              <FsText variant="caption">Skip for now</FsText>
            </Pressable>
          )}
        </View>
      )}
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
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

function ToggleRow({ label, desc, value, onValueChange }: {
  label: string; desc: string; value: boolean; onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, marginRight: space[3] }}>
        <FsText variant="bodyMedium">{label}</FsText>
        <FsText variant="caption">{desc}</FsText>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingBottom: space[3] },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  brand: {
    alignSelf: 'center', width: 80, height: 80, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: space[4], marginTop: space[3],
  },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: { padding: space[3], borderRadius: radius.md, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: 'transparent' },
  optionOn: { borderColor: colors.primary },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space[3], marginBottom: space[2] },
  valueRow: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start', marginBottom: space[3] },
  healthBlock: { marginBottom: space[4] },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[4] },
  avatarImg: { width: 56, height: 56, borderRadius: radius.full },
  avatarPlaceholder: { backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
}));
