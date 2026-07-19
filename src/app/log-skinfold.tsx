import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button, Chip } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';
import { useSettingsStore } from '@/stores/settingsStore';
import { ageFromBirthDate } from '@/lib/targets';
import { toKg, toDisplay, UNIT_LABELS } from '@/lib/units';
import {
  SKINFOLD_SITES,
  SKINFOLD_SITE_INFO,
  skinfoldBodyFat,
  type SkinfoldMethod,
  type SkinfoldSex,
  type SkinfoldFolds,
} from '@/lib/skinfold';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import { todayLocal } from '@/lib/date';

const today = todayLocal;
const round1 = (n: number) => Math.round(n * 10) / 10;

type StoredSkinfold = { method: SkinfoldMethod; sex: SkinfoldSex; folds: SkinfoldFolds };

/**
 * Skinfold-caliper body-fat entry. The user picks a method (Jackson–Pollock 3- or 7-site)
 * + sex, pinches the required sites (mm), and we compute body-fat % (density → Siri). It's
 * saved as a weigh-in marked source 'CALIPER', with the raw folds kept in `skinfoldJson` so
 * the reading can be reopened and edited. Flows through the Body card + goal weight like any
 * measured body-fat value (`computeBodyFatView`), so no resolver change is needed.
 */
export default function LogSkinfold() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useSettingsStore((s) => s.profile);
  const unit = profile.unitSystem;
  const wLabel = UNIT_LABELS[unit].weight;

  // `?date=YYYY-MM-DD` reopens an existing caliper reading for editing.
  const params = useLocalSearchParams<{ date?: string }>();
  const editDate = typeof params.date === 'string' ? params.date : null;
  const entry = useMemo(() => (editDate ? healthRepo.getWeightEntryByDate(editDate) : null), [editDate]);
  const prefill = useMemo<StoredSkinfold | null>(() => {
    if (!entry?.skinfoldJson) return null;
    try { return JSON.parse(entry.skinfoldJson) as StoredSkinfold; } catch { return null; }
  }, [entry]);
  const editing = !!prefill;

  const profileSex: SkinfoldSex | null =
    profile.sex === 'MALE' || profile.sex === 'FEMALE' ? profile.sex : null;
  const latest = useMemo(() => healthRepo.getLatestWeightEntry(), []);

  const [date, setDate] = useState<string>(editDate ?? today());
  const [method, setMethod] = useState<SkinfoldMethod>(prefill?.method ?? 'JP3');
  const [sex, setSex] = useState<SkinfoldSex | null>(prefill?.sex ?? profileSex);
  const [weight, setWeight] = useState<string>(() => {
    const kg = entry?.weightKg ?? latest?.weightKg ?? null;
    return kg != null ? String(round1(toDisplay(kg, unit))) : '';
  });
  const [folds, setFolds] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    if (prefill?.folds) for (const [k, v] of Object.entries(prefill.folds)) o[k] = String(v);
    return o;
  });

  // Age drives the JP regression. Prefer the profile's birth date; fall back to a manual field.
  const profileAge = ageFromBirthDate(profile.birthDate);
  const [ageInput, setAgeInput] = useState('');
  const age = profileAge ?? (ageInput.trim() ? Number(ageInput) : null);

  const sites = sex ? SKINFOLD_SITES[method][sex] : [];
  const setFold = (site: string, v: string) => setFolds((f) => ({ ...f, [site]: v }));

  const foldsNum = useMemo<SkinfoldFolds>(() => {
    const o: SkinfoldFolds = {};
    for (const site of sites) {
      const v = Number(folds[site]);
      if (folds[site]?.trim() && Number.isFinite(v) && v > 0) o[site] = v;
    }
    return o;
  }, [folds, sites]);

  const foldSumMm = sites.reduce((s, site) => s + (foldsNum[site] ?? 0), 0);
  const bf = sex ? skinfoldBodyFat(method, sex, foldsNum, age) : null;

  const save = () => {
    if (!sex) return Alert.alert('Pick a sex', 'Skinfold formulas are sex-specific — choose Male or Female.');
    if (age == null || !(age > 0)) return Alert.alert('Age needed', 'Set your birth date in Settings, or enter your age below.');
    const w = Number(weight);
    if (!w || w <= 0) return Alert.alert('Enter a weight', 'A weight is required to log the reading.');
    if (!date) return Alert.alert('Pick a date', 'Choose the date of your measurement.');
    const value = skinfoldBodyFat(method, sex, foldsNum, age);
    if (value == null) {
      return Alert.alert('Enter every fold', `Enter a value in mm for each of the ${sites.length} sites.`);
    }
    healthRepo.logSkinfold({
      date,
      weightKg: toKg(w, unit),
      bodyFat: round1(value),
      skinfoldJson: JSON.stringify({ method, sex, folds: foldsNum } satisfies StoredSkinfold),
    });
    syncBodyFatGoalWeight(); // a caliper reading is a fresh body-fat baseline → refresh a body-fat-mode goal
    haptic.success();
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space[3] }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">{editing ? 'Edit skinfold' : 'Log skinfold'}</FsText>
        <Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[8] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <FsText variant="caption" style={{ marginBottom: space[4] }}>
          Pinch each site with your calipers and enter the reading in millimetres. We compute body fat with
          the Jackson–Pollock formula (density → Siri) — an estimate of ±~3–4%, so keep your technique
          consistent between readings.
        </FsText>

        <Label text="Method" />
        <View style={styles.chipRow}>
          <Chip label="3-site" selected={method === 'JP3'} onPress={() => setMethod('JP3')} />
          <Chip label="7-site" selected={method === 'JP7'} onPress={() => setMethod('JP7')} />
        </View>

        <Label text="Sex (formula basis)" />
        <View style={styles.chipRow}>
          <Chip label="Male" selected={sex === 'MALE'} onPress={() => setSex('MALE')} />
          <Chip label="Female" selected={sex === 'FEMALE'} onPress={() => setSex('FEMALE')} />
        </View>
        {!profileSex && (
          <FsText variant="caption" style={{ color: colors.muted, marginBottom: space[3] }}>
            The 3-site sites differ by sex, so pick the formula that matches you.
          </FsText>
        )}

        <Label text="Date" />
        <View style={{ marginBottom: space[4] }}>
          <DateField value={date} onChange={(v) => setDate(v ?? today())} placeholder="Select date" maxYear={new Date().getFullYear()} />
        </View>

        <Label text={`Weight (${wLabel})`} />
        <Field value={weight} onChangeText={setWeight} placeholder="Current weight" suffix={wLabel} />

        {profileAge != null ? (
          <FsText variant="caption" style={{ color: colors.muted, marginBottom: space[4] }}>
            Using age {profileAge} from your birth date.
          </FsText>
        ) : (
          <>
            <Label text="Age (years)" />
            <Field value={ageInput} onChangeText={setAgeInput} placeholder="e.g. 30" suffix="yr" keyboardType="decimal-pad" />
          </>
        )}

        {sites.length === 0 ? (
          <FsText variant="caption" style={{ color: colors.muted, marginTop: space[2] }}>
            Pick a sex above to choose the fold sites.
          </FsText>
        ) : (
          sites.map((site) => (
            <View key={site}>
              <Label text={`${SKINFOLD_SITE_INFO[site].label} (mm)`} />
              <Field value={folds[site] ?? ''} onChangeText={(v) => setFold(site, v)} placeholder="e.g. 12" suffix="mm" />
              <FsText variant="caption" style={{ color: colors.muted, marginTop: -space[2], marginBottom: space[4] }}>
                {SKINFOLD_SITE_INFO[site].hint}
              </FsText>
            </View>
          ))
        )}

        <View style={styles.result}>
          <FsText variant="caption" style={{ color: colors.muted }}>Estimated body fat</FsText>
          <FsText variant="stat" style={{ color: bf != null ? colors.primary : colors.muted }}>
            {bf != null ? `${round1(bf)}%` : '—'}
          </FsText>
          <FsText variant="caption" style={{ color: colors.muted }}>
            {method === 'JP3' ? 'Jackson–Pollock 3-site' : 'Jackson–Pollock 7-site'} · Siri
            {foldSumMm > 0 ? ` · Σ ${round1(foldSumMm)} mm` : ''}
          </FsText>
        </View>

        <Button title={editing ? 'Save reading' : 'Log body fat'} onPress={save} style={{ marginTop: space[6] }} />
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
  chipRow: { flexDirection: 'row', gap: space[2], marginBottom: space[4] },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 18 },
  result: {
    marginTop: space[4], padding: space[4], gap: space[1],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.lg, alignItems: 'center',
  },
}));
