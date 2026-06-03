import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { Card, FsText, SectionHeader } from '@/components/ui';
import { DateRangeBar } from '@/components/DateRangeBar';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useDateRange } from '@/lib/useDateRange';
import { usePullRefresh } from '@/stores/refreshStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight, toDisplay, UNIT_LABELS } from '@/lib/units';
import { bodyFatForEntry, navyBodyFat } from '@/lib/bodyComposition';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { BodyMeasurement, WeightEntry } from '@/types';

const SITES: { key: keyof BodyMeasurement; label: string }[] = [
  { key: 'neck', label: 'Neck' }, { key: 'shoulders', label: 'Shoulders' }, { key: 'chest', label: 'Chest' },
  { key: 'leftArm', label: 'Left Arm' }, { key: 'rightArm', label: 'Right Arm' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'leftThigh', label: 'Left Thigh' }, { key: 'rightThigh', label: 'Right Thigh' },
  { key: 'leftCalf', label: 'Left Calf' }, { key: 'rightCalf', label: 'Right Calf' },
];

/** Health → Trends sub-tab: weight + body-fat + measurement change over a window. */
export function HealthTrends() {
  const profile = useSettingsStore((s) => s.profile);
  const unit = profile.unitSystem;
  const range = useDateRange('month');
  const { fromIso, endIso, days } = range;
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  // The most recent *measured* body-fat reading (may pre-date the window) anchors the
  // lean-mass estimate for weigh-ins that have only a weight.
  const [baseline, setBaseline] = useState<WeightEntry | null>(null);

  const refresh = useCallback(() => {
    setWeights(healthRepo.getWeightEntries(fromIso, endIso));
    setMeasurements(healthRepo.getMeasurements().filter((m) => m.date >= fromIso && m.date <= endIso));
    setBaseline(healthRepo.getLatestBodyFatBaseline());
  }, [fromIso, endIso]);
  useFocusEffect(refresh);
  usePullRefresh(refresh);

  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = first && last ? last.weightKg - first.weightKg : null;
  const weeklyRate = change != null && days > 0 ? change / (days / 7) : null;

  // ── Body fat over time ──
  // Per-entry bf via measured→baseline-estimate (same priority as the Body subview),
  // giving a continuous series anchored to the measured baseline. If no entry yields a
  // value, fall back to a Navy tape series from the window's measurements.
  const canNavy = profile.useNavyBodyFat && !!profile.heightCm && (profile.sex === 'MALE' || profile.sex === 'FEMALE');
  const leanSeries = weights
    .map((w) => {
      const r = bodyFatForEntry(w, baseline);
      return r ? { date: w.date, bf: r.bf, measured: r.measured } : null;
    })
    .filter((p): p is { date: string; bf: number; measured: boolean } => p != null);
  const navySeries = canNavy
    ? [...measurements] // newest-first → oldest-first for a left-to-right trend
        .reverse()
        .map((m) => {
          const bf = navyBodyFat({ sex: profile.sex as 'MALE' | 'FEMALE', heightCm: profile.heightCm!, neckCm: m.neck ?? 0, waistCm: m.waist ?? 0, hipCm: m.hips });
          return bf != null ? { date: m.date, bf, measured: false } : null;
        })
        .filter((p): p is { date: string; bf: number; measured: boolean } => p != null)
    : [];
  const bfSeries = leanSeries.length ? leanSeries : navySeries;
  const bfMethod: string | null = !bfSeries.length
    ? null
    : leanSeries.length
      ? (leanSeries.every((p) => p.measured) ? 'Measured' : 'Estimated')
      : 'U.S. Navy';
  const bfFirst = bfSeries[0]?.bf ?? null;
  const bfLast = bfSeries[bfSeries.length - 1]?.bf ?? null;
  const bfChange = bfFirst != null && bfLast != null ? bfLast - bfFirst : null;
  const bfColor = bfChange == null ? colors.muted : bfChange < 0 ? colors.success : bfChange > 0 ? colors.danger : colors.muted;

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
      <DateRangeBar range={range} />

      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.rowBetween}>
          <FsText variant="cardTitle">Weight</FsText>
          <ChangeIcon color={changeColor} size={16} />
        </View>
        <View style={styles.statGrid}>
          <Stat label="Start" value={first ? formatWeight(first.weightKg, unit) : '—'} />
          <Stat label="Current" value={last ? formatWeight(last.weightKg, unit) : '—'} />
          <Stat label={`Change · ${days}d`} value={change != null ? `${change > 0 ? '+' : ''}${toDisplay(change, unit)} ${UNIT_LABELS[unit].weight}` : '—'} tone={changeColor} />
          <Stat label="Weekly rate" value={weeklyRate != null ? `${weeklyRate > 0 ? '+' : ''}${toDisplay(weeklyRate, unit)} ${UNIT_LABELS[unit].weight}` : '—'} tone={changeColor} />
        </View>
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.rowBetween}>
          <FsText variant="cardTitle">Body fat</FsText>
          {bfMethod ? (
            <FsText variant="caption" style={{ fontSize: 11, fontWeight: '700', color: bfMethod === 'Measured' ? colors.primary : colors.muted }}>
              {bfMethod.toUpperCase()}
            </FsText>
          ) : null}
        </View>
        {bfSeries.length === 0 ? (
          <FsText variant="caption">
            Log a body-fat % with a weigh-in (e.g. from a DEXA scan), or your neck and waist
            measurements, to track body fat over this window.
          </FsText>
        ) : (
          <>
            <View style={styles.statGrid}>
              <Stat label="Start" value={bfFirst != null ? `${bfFirst.toFixed(1)}%` : '—'} />
              <Stat label="Current" value={bfLast != null ? `${bfLast.toFixed(1)}%` : '—'} />
              <Stat label={`Change · ${days}d`} value={bfChange != null ? `${bfChange > 0 ? '+' : ''}${bfChange.toFixed(1)}%` : '—'} tone={bfColor} />
              <Stat label="Readings" value={`${bfSeries.length}`} />
            </View>
            <Sparkline values={bfSeries.map((p) => p.bf)} color={bfColor === colors.muted ? colors.primary : bfColor} />
            {bfMethod === 'Estimated' ? (
              <FsText variant="caption" style={{ marginTop: space[3], color: colors.muted, lineHeight: 17 }}>
                Estimated from your weight against your last measured reading, holding lean mass constant.
                Log a fresh body-fat % to re-anchor it.
              </FsText>
            ) : null}
          </>
        )}
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

/** Minimal bar sparkline — normalizes values into the track with a floor so a flat
 *  series still reads as a line of stubs rather than nothing. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (
    <View style={styles.spark}>
      {values.map((v, i) => (
        <View key={i} style={[styles.sparkBar, { height: `${(0.15 + 0.85 * ((v - min) / span)) * 100}%`, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: space[3], gap: 2 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 44, marginTop: space[1] },
  sparkBar: { flex: 1, minHeight: 2, borderRadius: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
}));
