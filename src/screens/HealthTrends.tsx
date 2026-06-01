import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { Card, FsText, SectionHeader } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight, toDisplay, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { BodyMeasurement, WeightEntry } from '@/types';

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const PERIODS: { key: string; label: string; days: number }[] = [
  { key: '7', label: '7 Day', days: 7 },
  { key: '30', label: '30 Day', days: 30 },
  { key: '90', label: '90 Day', days: 90 },
];

const SITES: { key: keyof BodyMeasurement; label: string }[] = [
  { key: 'neck', label: 'Neck' }, { key: 'shoulders', label: 'Shoulders' }, { key: 'chest', label: 'Chest' },
  { key: 'leftArm', label: 'Left Arm' }, { key: 'rightArm', label: 'Right Arm' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'leftThigh', label: 'Left Thigh' }, { key: 'rightThigh', label: 'Right Thigh' },
  { key: 'leftCalf', label: 'Left Calf' }, { key: 'rightCalf', label: 'Right Calf' },
];

/** Health → Trends sub-tab: weight + body-fat + measurement change over a window. */
export function HealthTrends() {
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const [period, setPeriod] = useState('30');
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);

  const days = PERIODS.find((p) => p.key === period)!.days;

  const refresh = useCallback(() => {
    const from = isoDate(new Date(Date.now() - days * DAY_MS));
    const to = isoDate(new Date());
    setWeights(healthRepo.getWeightEntries(from, to));
    setMeasurements(healthRepo.getMeasurements().filter((m) => m.date >= from));
  }, [days]);
  useFocusEffect(refresh);

  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = first && last ? last.weightKg - first.weightKg : null;
  const bodyFat = [...weights].reverse().find((w) => w.bodyFat != null)?.bodyFat ?? null;

  const lengthLabel = UNIT_LABELS[unit].smallLength;
  const toLen = (cm: number) => (unit === 'IMPERIAL' ? cm / 2.54 : cm);
  // Measurements are newest-first; oldest in window vs latest per site.
  const mLast = measurements[0];
  const mFirst = measurements[measurements.length - 1];
  const siteDeltas = mLast && mFirst && mLast !== mFirst
    ? SITES.map((s) => {
        const cur = mLast[s.key] as number | null | undefined;
        const old = mFirst[s.key] as number | null | undefined;
        if (cur == null || old == null) return null;
        return { label: s.label, delta: toLen(cur) - toLen(old) };
      }).filter(Boolean)
    : [];

  const ChangeIcon = (change ?? 0) < 0 ? TrendingDown : TrendingUp;
  const changeColor = change == null ? colors.muted : change < 0 ? colors.success : change > 0 ? colors.danger : colors.muted;

  return (
    <>
      <View style={styles.toggle}>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Pressable key={p.key} style={[styles.toggleBtn, active && styles.toggleActive]} onPress={() => setPeriod(p.key)}>
              <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>{p.label}</FsText>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.rowBetween}>
          <FsText variant="cardTitle">Weight</FsText>
          <ChangeIcon color={changeColor} size={16} />
        </View>
        <View style={styles.statGrid}>
          <Stat label="Start" value={first ? formatWeight(first.weightKg, unit) : '—'} />
          <Stat label="Current" value={last ? formatWeight(last.weightKg, unit) : '—'} />
          <Stat label={`Change · ${days}d`} value={change != null ? `${change > 0 ? '+' : ''}${toDisplay(change, unit)} ${UNIT_LABELS[unit].weight}` : '—'} tone={changeColor} />
          <Stat label="Body fat" value={bodyFat != null ? `${bodyFat}%` : '—'} />
        </View>
      </Card>

      <SectionHeader title="Measurement change" />
      {siteDeltas.length === 0 ? (
        <Card><FsText variant="caption">Log measurements on two dates in this window to see changes.</FsText></Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {siteDeltas.map((r, i) => (
            <View key={r!.label} style={[styles.row, i > 0 && styles.divider]}>
              <FsText variant="body" style={{ flex: 1 }}>{r!.label}</FsText>
              <FsText variant="bodyMedium" style={{ color: Math.abs(r!.delta) < 0.05 ? colors.muted : r!.delta < 0 ? colors.success : colors.danger }}>
                {r!.delta > 0 ? '+' : ''}{r!.delta.toFixed(1)} {lengthLabel}
              </FsText>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.statCell}>
      <FsText variant="caption">{label}</FsText>
      <FsText variant="cardTitle" style={tone ? { color: tone } : undefined}>{value}</FsText>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  toggle: { flexDirection: 'row', gap: space[1], backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: space[3] },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.primary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: space[3], gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
