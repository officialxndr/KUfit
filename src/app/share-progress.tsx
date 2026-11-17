import { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Switch, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FsText, Button, Chip } from '@/components/ui';
import { ModalHeader } from '@/components/ModalHeader';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { computeWeightTrend } from '@/lib/weightTrend';
import { smoothPath } from '@/lib/svgPath';
import { formatWeight, formatVolume } from '@/lib/units';
import { parseLocalDay, todayLocal } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * "Share my progress" — renders a 4:5 image card (trend-weight change + sparkline, workouts and
 * volume for the period) and hands it to the share sheet. It's word-of-mouth that keeps the
 * privacy promise: the image is built on-device, nothing is uploaded, and the absolute weights
 * are **hidden by default** (only the change is shown) — the user opts in to show them.
 */

const APP_NAME = 'Hale';
const DAY_MS = 86_400_000;
const PERIODS = [
  { key: '30', label: '1M', days: 30, long: 'Last month' },
  { key: '90', label: '3M', days: 90, long: 'Last 3 months' },
  { key: '180', label: '6M', days: 180, long: 'Last 6 months' },
  { key: '365', label: '1Y', days: 365, long: 'Last year' },
] as const;

const PAD = 20;
const CARD_W = 320;
const CARD_H = 400;
const SPARK_W = CARD_W - PAD * 2;
const SPARK_H = 90;

export default function ShareProgress() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const cardRef = useRef<View>(null);

  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]['key']>('90');
  const [showWeights, setShowWeights] = useState(false);
  const [busy, setBusy] = useState(false);
  const period = PERIODS.find((p) => p.key === periodKey)!;

  // Read once per period change — this is a short-lived modal, so no focus/refresh wiring needed.
  const data = useMemo(() => {
    const cutoff = parseLocalDay(todayLocal()).getTime() - period.days * DAY_MS;
    const trend = computeWeightTrend(healthRepo.getWeightEntries('2000-01-01', todayLocal()));
    const windowed = trend.filter((p) => parseLocalDay(p.date).getTime() >= cutoff);
    const sessions = workoutRepo.getSessions(5000).filter((s) => new Date(s.startedAt).getTime() >= cutoff);
    const volumeKg = sessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
    const first = windowed[0]?.trendKg ?? null;
    const last = windowed[windowed.length - 1]?.trendKg ?? null;
    return {
      windowed,
      change: first != null && last != null && windowed.length >= 2 ? last - first : null,
      startKg: first,
      endKg: last,
      workouts: sessions.length,
      volumeKg,
    };
  }, [period.days]);

  const spark = useMemo(() => {
    const pts = data.windowed;
    if (pts.length < 2) return '';
    const vals = pts.map((p) => p.trendKg);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const t0 = parseLocalDay(pts[0].date).getTime();
    const t1 = parseLocalDay(pts[pts.length - 1].date).getTime();
    const tSpan = t1 - t0 || 1;
    return smoothPath(
      pts.map((p) => ({
        x: ((parseLocalDay(p.date).getTime() - t0) / tSpan) * SPARK_W,
        y: 6 + (1 - (p.trendKg - min) / span) * (SPARK_H - 12),
      }))
    );
  }, [data.windowed]);

  const hasAnything = data.change != null || data.workouts > 0;
  const changeColor = data.change == null ? colors.muted : data.change < 0 ? colors.success : data.change > 0 ? colors.danger : colors.text;
  const changeLabel =
    data.change == null
      ? '—'
      : `${data.change < 0 ? '−' : data.change > 0 ? '+' : ''}${formatWeight(Math.abs(data.change), unit)}`;

  const share = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      // Both are native modules — loaded lazily so a build without them fails gracefully.
      const { captureRef } = await import('react-native-view-shot');
      const Sharing = await import('expo-sharing');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        haptic.tap();
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share progress' });
      }
    } catch (e) {
      Alert.alert('Share', `Couldn’t create the image: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ModalHeader title="Share progress" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[6], alignItems: 'center' }}>
        {/* ── The card that becomes the image ── */}
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <View style={styles.cardTop}>
            <FsText variant="cardTitle" style={{ color: colors.primary, letterSpacing: 2 }}>{APP_NAME.toUpperCase()}</FsText>
            <FsText variant="caption">{period.long}</FsText>
          </View>

          <View style={{ marginTop: PAD }}>
            <FsText variant="caption">Trend weight change</FsText>
            <FsText variant="display" style={{ color: changeColor, marginTop: 2 }}>{changeLabel}</FsText>
            {showWeights && data.startKg != null && data.endKg != null && (
              <FsText variant="caption" style={{ marginTop: 2 }}>
                {formatWeight(data.startKg, unit)} → {formatWeight(data.endKg, unit)}
              </FsText>
            )}
          </View>

          <View style={{ height: SPARK_H, marginTop: space[4] }}>
            {spark ? (
              <Svg width={SPARK_W} height={SPARK_H}>
                <Path d={spark} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
              </Svg>
            ) : (
              <FsText variant="caption" style={{ marginTop: space[6], textAlign: 'center' }}>Log a few weigh-ins to see your trend.</FsText>
            )}
          </View>

          <View style={styles.statsRow}>
            <View>
              <FsText variant="caption">Workouts</FsText>
              <FsText variant="stat" style={{ marginTop: 2 }}>{data.workouts}</FsText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <FsText variant="caption">Volume lifted</FsText>
              <FsText variant="stat" style={{ marginTop: 2 }}>{data.volumeKg > 0 ? formatVolume(data.volumeKg, unit) : '—'}</FsText>
            </View>
          </View>

          <FsText variant="caption" style={styles.footer}>Tracked privately with {APP_NAME} · no account, no ads</FsText>
        </View>

        {/* ── Controls (not part of the image) ── */}
        <View style={styles.periods}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} selected={p.key === periodKey} onPress={() => setPeriodKey(p.key)} />
          ))}
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium">Show my weights</FsText>
            <FsText variant="caption">Off = only the change is shown.</FsText>
          </View>
          <Switch value={showWeights} onValueChange={setShowWeights} />
        </View>

        <Button
          title={busy ? 'Preparing…' : 'Share image'}
          onPress={share}
          disabled={busy || !hasAnything}
          style={{ alignSelf: 'stretch', marginTop: space[4] }}
        />
        <FsText variant="caption" style={{ marginTop: space[3], textAlign: 'center' }}>
          The image is made on your phone — nothing is uploaded.
        </FsText>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    card: {
      width: CARD_W,
      height: CARD_H,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: PAD,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[4] },
    footer: { position: 'absolute', left: PAD, right: PAD, bottom: space[4], textAlign: 'center' },
    periods: { flexDirection: 'row', gap: space[2], marginTop: PAD },
    toggleRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: space[4], gap: space[3] },
  })
);
