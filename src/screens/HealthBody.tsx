import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Scale } from 'lucide-react-native';

import { Card, FsText, Badge } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { WeightEntry } from '@/types';

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

  const refresh = useCallback(() => setLatest(healthRepo.getLatestWeightEntry()), []);
  useFocusEffect(refresh);

  if (!latest) {
    return <Empty message="Log your weight to see body composition." />;
  }
  if (latest.bodyFat == null) {
    return <Empty message="Add a body-fat % when you log your weight (Weight tab) to unlock composition stats." />;
  }

  const weightKg = latest.weightKg;
  const bf = latest.bodyFat;
  const fatKg = (weightKg * bf) / 100;
  const leanKg = weightKg - fatKg;
  const hM = profile.heightCm ? profile.heightCm / 100 : null;
  const bmi = hM ? weightKg / (hM * hM) : null;
  const ffmi = hM ? leanKg / (hM * hM) : null;
  const band = bfBand(bf);
  const leanFlex = Math.round(leanKg * 10);
  const fatFlex = Math.round(fatKg * 10);

  return (
    <>
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.rowBetween}>
          <View>
            <FsText variant="caption">Body Fat</FsText>
            <FsText variant="display" style={{ marginTop: 2 }}>
              {bf.toFixed(1)}<FsText variant="cardTitle" style={{ color: colors.muted }}>%</FsText>
            </FsText>
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
      </Card>

      <View style={styles.grid}>
        <Metric label="Lean Mass" value={formatWeight(leanKg, unit)} tone={colors.success} />
        <Metric label="Fat Mass" value={formatWeight(fatKg, unit)} tone={colors.muted} />
        <Metric label="BMI" value={bmi != null ? bmi.toFixed(1) : '—'} />
        <Metric label="FFMI" value={ffmi != null ? ffmi.toFixed(1) : '—'} tone={colors.primary} />
      </View>

      <Card>
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
    </>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Scale color={colors.muted} size={28} /></View>
      <FsText variant="cardTitle" style={{ color: colors.muted }}>No composition yet</FsText>
      <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>{message}</FsText>
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
}));
