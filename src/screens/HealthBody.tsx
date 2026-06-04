import { useCallback, useState } from 'react';
import { View, StyleSheet, Modal, TextInput, Pressable, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Scale } from 'lucide-react-native';

import { Card, FsText, Badge, Button } from '@/components/ui';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight, toKg, toDisplay, UNIT_LABELS } from '@/lib/units';
import { estimateBodyFat, navyBodyFat } from '@/lib/bodyComposition';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { WeightEntry, BodyMeasurement } from '@/types';

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);

/** "a", "a and b", "a, b and c" — for listing what's missing in a sentence. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function bfBand(bf: number): { label: string; tone: 'success' | 'warning' | 'danger' | 'primary' } {
  if (bf < 14) return { label: 'Athletic range', tone: 'success' };
  if (bf < 22) return { label: 'Fitness range', tone: 'primary' };
  if (bf < 32) return { label: 'Average range', tone: 'warning' };
  return { label: 'High range', tone: 'danger' };
}

export function HealthBody() {
  const profile = useSettingsStore((s) => s.profile);
  const unit = profile.unitSystem;
  const [latest, setLatest] = useState<WeightEntry | null>(null);
  const [baseline, setBaseline] = useState<WeightEntry | null>(null);
  const [measurement, setMeasurement] = useState<BodyMeasurement | null>(null);

  // "Log body-fat %" (DEXA) modal — available from every state so a reading can
  // always be entered or updated, even when there's nothing to display yet.
  const [bfOpen, setBfOpen] = useState(false);
  const [bfVal, setBfVal] = useState('');
  const [wVal, setWVal] = useState('');

  const refresh = useCallback(() => {
    setLatest(healthRepo.getLatestWeightEntry());
    setBaseline(healthRepo.getLatestBodyFatBaseline());
    // Coalesce the latest non-null value per site — waist & neck may live on
    // different dated rows, and the Navy estimate needs them together.
    setMeasurement(healthRepo.getLatestMeasurementBySite());
  }, []);
  useFocusEffect(refresh);

  // U.S. Navy estimate from the latest tape measurement + height/sex, when available.
  const navyBf =
    profile.useNavyBodyFat && measurement && profile.heightCm && (profile.sex === 'MALE' || profile.sex === 'FEMALE')
      ? navyBodyFat({
          sex: profile.sex,
          heightCm: profile.heightCm,
          neckCm: measurement.neck ?? 0,
          waistCm: measurement.waist ?? 0,
          hipCm: measurement.hips,
        })
      : null;

  // Save a value as today's measured reading (becomes the baseline). Carries the latest
  // weight forward if there's no weigh-in today yet.
  const logReading = (value: number) => {
    if (!latest) return;
    healthRepo.upsertWeightEntry(today(), latest.weightKg, Math.round(value * 10) / 10);
    haptic.success();
    refresh();
  };

  const openBf = () => {
    setBfVal(latest?.bodyFat != null ? String(latest.bodyFat) : '');
    setWVal(latest ? String(toDisplay(latest.weightKg, unit)) : '');
    setBfOpen(true);
  };

  const saveBf = () => {
    const bfNum = Number(bfVal);
    if (!bfNum || bfNum <= 0 || bfNum >= 70) {
      Alert.alert('Enter a body-fat %', 'Use a number between 1 and 70.');
      return;
    }
    // Needs a weight to compute lean/fat mass — reuse today's/latest weigh-in, or take one here.
    const weightKg = latest?.weightKg ?? (wVal.trim() ? toKg(Number(wVal), unit) : null);
    if (!weightKg || weightKg <= 0) {
      Alert.alert('Add your weight', 'Enter your current weight so we can compute lean and fat mass.');
      return;
    }
    healthRepo.upsertWeightEntry(today(), weightKg, Math.round(bfNum * 10) / 10);
    haptic.success();
    setBfOpen(false);
    refresh();
  };

  let content: React.ReactNode;

  if (!latest) {
    content = (
      <Empty
        message="Log your weight to see body composition — or enter a body-fat % from a DEXA scan to start."
        action={{ label: 'Log body-fat % (DEXA)', onPress: openBf }}
      />
    );
  } else {
    // Source priority: a measured % on the latest weigh-in, then the lean-mass estimate
    // from a DEXA baseline, then the Navy tape estimate.
    const measured = latest.bodyFat != null;
    let bf: number | null = null;
    let source: 'measured' | 'baseline' | 'navy' = 'measured';
    if (measured) {
      bf = latest.bodyFat as number;
    } else if (baseline?.bodyFat != null) {
      bf = estimateBodyFat(baseline.weightKg, baseline.bodyFat, latest.weightKg);
      source = 'baseline';
    } else if (navyBf != null) {
      bf = navyBf;
      source = 'navy';
    }

    if (bf == null) {
      // Name exactly what the U.S. Navy estimate still needs, so the empty state is
      // actionable instead of vaguely asking for a body-fat %.
      const needSettings: string[] = [];
      if (profile.sex !== 'MALE' && profile.sex !== 'FEMALE') needSettings.push('sex');
      if (!profile.heightCm) needSettings.push('height');
      const needMeasure: string[] = [];
      if (!measurement?.neck) needMeasure.push('neck');
      if (!measurement?.waist) needMeasure.push('waist');
      if (profile.sex === 'FEMALE' && !measurement?.hips) needMeasure.push('hips');

      let message: string;
      if (!needSettings.length && !needMeasure.length) {
        message = 'Your measurements don’t fit the U.S. Navy formula (waist must exceed neck). Re-check your waist/neck' + (profile.sex === 'FEMALE' ? '/hips' : '') + ', or log a body-fat % from a DEXA scan below.';
      } else {
        const parts: string[] = [];
        if (needSettings.length) parts.push(`set your ${joinList(needSettings)} in Settings`);
        if (needMeasure.length) parts.push(`log your ${joinList(needMeasure)} in Measurements`);
        message = `To estimate body fat with the U.S. Navy method, ${parts.join(' and ')}. Or just log a body-fat % from a DEXA scan below.`;
      }
      content = <Empty message={message} action={{ label: 'Log body-fat % (DEXA)', onPress: openBf }} />;
    } else {
      const weightKg = latest.weightKg;
      const fatKg = (weightKg * bf) / 100;
      const estimated = source !== 'measured';
      const leanKg = weightKg - fatKg;
      const hM = profile.heightCm ? profile.heightCm / 100 : null;
      const bmi = hM ? weightKg / (hM * hM) : null;
      const ffmi = hM ? leanKg / (hM * hM) : null;
      const band = bfBand(bf);
      const leanFlex = Math.round(leanKg * 10);
      const fatFlex = Math.round(fatKg * 10);

      content = (
        <>
          <Card style={{ marginBottom: space[3] }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FsText variant="caption">Body Fat</FsText>
                  <View style={[styles.srcPill, estimated && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}>
                    <FsText variant="caption" style={{ fontSize: 10, color: estimated ? colors.muted : colors.primary, fontWeight: '700' }}>
                      {source === 'measured' ? 'MEASURED' : source === 'navy' ? 'U.S. NAVY' : 'ESTIMATED'}
                    </FsText>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 }}>
                  <AnimatedNumber value={bf} format={(n) => n.toFixed(1)} variant="display" />
                  <FsText variant="cardTitle" style={{ color: colors.muted, marginBottom: 4 }}>%</FsText>
                </View>
              </View>
              <Badge label={band.label} tone={band.tone} />
            </View>
            <View style={styles.rangeBar}>
              <View style={{ width: `${Math.min(bf, 40) / 40 * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: radius.full }} />
            </View>
            <View style={styles.rangeLabels}>
              <FsText variant="caption" style={{ fontSize: 10 }}>Essential</FsText>
              <FsText variant="caption" style={{ fontSize: 10 }}>Athletic</FsText>
              <FsText variant="caption" style={{ fontSize: 10 }}>Fitness</FsText>
              <FsText variant="caption" style={{ fontSize: 10 }}>High</FsText>
            </View>
            {source === 'baseline' && baseline?.bodyFat != null ? (
              <FsText variant="caption" style={{ marginTop: space[3], color: colors.muted, lineHeight: 17 }}>
                Estimated from your {shortDate(baseline.date)} reading ({baseline.bodyFat.toFixed(1)}% at {formatWeight(baseline.weightKg, unit)}), assuming lean mass held as you lose weight. After a new DEXA scan, log the measured % to re-baseline.
              </FsText>
            ) : source === 'navy' ? (
              <FsText variant="caption" style={{ marginTop: space[3], color: colors.muted, lineHeight: 17 }}>
                Estimated from your {measurement ? shortDate(measurement.date) : 'latest'} waist/neck{profile.sex === 'FEMALE' ? '/hip' : ''} measurements (U.S. Navy method). It's an estimate — a DEXA scan is more accurate.
              </FsText>
            ) : (
              <FsText variant="caption" style={{ marginTop: space[3], color: colors.muted }}>
                Measured on {shortDate(latest.date)}. Log just your weight on other days and we'll estimate from this baseline.
              </FsText>
            )}
          </Card>

          {source !== 'measured' && navyBf != null && (
            <Button
              title={source === 'navy' ? `Save ${navyBf.toFixed(1)}% as today's reading` : `Use Navy estimate · ${navyBf.toFixed(1)}%`}
              variant="ghost"
              onPress={() => logReading(navyBf)}
              style={{ marginBottom: space[3] }}
            />
          )}

          <View style={styles.grid}>
            <Metric label="Lean Mass" value={formatWeight(leanKg, unit)} tone={colors.success} />
            <Metric label="Fat Mass" value={formatWeight(fatKg, unit)} tone={colors.muted} />
            <Metric label="BMI" value={bmi != null ? bmi.toFixed(1) : '—'} />
            <Metric label="FFMI" value={ffmi != null ? ffmi.toFixed(1) : '—'} tone={colors.primary} />
          </View>

          <Card style={{ marginBottom: space[3] }}>
            <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Composition</FsText>
            <View style={styles.compBar}>
              <View style={{ flex: leanFlex, backgroundColor: colors.primary }} />
              <View style={{ flex: fatFlex, backgroundColor: colors.warning }} />
            </View>
            <View style={{ flexDirection: 'row', gap: space[4], marginTop: space[3] }}>
              <Legend color={colors.primary} label="Lean" value={formatWeight(leanKg, unit)} />
              <Legend color={colors.warning} label="Fat" value={formatWeight(fatKg, unit)} />
            </View>
            {bmi == null && (
              <FsText variant="caption" style={{ marginTop: space[3] }}>
                Add your height in Settings to compute BMI and FFMI.
              </FsText>
            )}
          </Card>

          <Button
            title={measured ? 'Update body-fat % (DEXA)' : 'Log body-fat % (DEXA)'}
            variant="ghost"
            onPress={openBf}
          />
        </>
      );
    }
  }

  return (
    <>
      {content}

      <Modal visible={bfOpen} transparent animationType="fade" onRequestClose={() => setBfOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBfOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[2] }}>Log body-fat %</FsText>
            <FsText variant="caption" style={{ marginBottom: space[3], lineHeight: 17 }}>
              From a DEXA scan, smart scale, or calipers. Saved to today — your weight then tracks lean/fat mass from this baseline.
            </FsText>
            {!latest && (
              <View style={{ marginBottom: space[3] }}>
                <FsText variant="caption" style={{ marginBottom: 6 }}>Weight ({UNIT_LABELS[unit].weight})</FsText>
                <TextInput value={wVal} onChangeText={setWVal} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            )}
            <FsText variant="caption" style={{ marginBottom: 6 }}>Body fat %</FsText>
            <TextInput value={bfVal} onChangeText={setBfVal} keyboardType="decimal-pad" placeholder="e.g. 18.5" placeholderTextColor={colors.muted} style={styles.input} autoFocus />
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[4] }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => setBfOpen(false)} /></View>
              <View style={{ flex: 1 }}><Button title="Save" onPress={saveBf} /></View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Empty({ message, action }: { message: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Scale color={colors.muted} size={28} /></View>
      <FsText variant="cardTitle" style={{ color: colors.muted }}>No composition yet</FsText>
      <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>{message}</FsText>
      {action && (
        <Button title={action.label} variant="ghost" onPress={action.onPress} style={{ marginTop: space[3] }} />
      )}
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card style={styles.metric}>
      <FsText variant="overline">{label}</FsText>
      <FsText variant="stat" style={tone ? { marginTop: 4, color: tone } : { marginTop: 4 }}>{value}</FsText>
    </Card>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <FsText variant="caption">{label} <FsText variant="caption" style={{ color: colors.text, fontWeight: '600' }}>{value}</FsText></FsText>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  srcPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(99,102,241,0.15)' },
  rangeBar: { height: 12, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden', marginTop: space[3] },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  metric: { width: '48%', flexGrow: 1 },
  compBar: { flexDirection: 'row', height: 20, borderRadius: radius.full, overflow: 'hidden', gap: 2 },
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space[2],
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[6] },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 16 },
}));
