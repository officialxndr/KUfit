import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';

import { FsText, Button, SectionHeader } from '@/components/ui';
import { BodyDiagram } from '@/components/BodyDiagram';
import { useRenphoTape, type TapeStatus } from '@/lib/renphoTape';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { BodyMeasurement } from '@/types';

type SiteKey = keyof BodyMeasurement;
const SITES: { key: SiteKey; label: string; hint: string }[] = [
  { key: 'neck', label: 'Neck', hint: 'Just below the larynx, tape sloping slightly down to the front.' },
  { key: 'shoulders', label: 'Shoulders', hint: 'Around the widest point of your shoulders, arms relaxed.' },
  { key: 'chest', label: 'Chest', hint: 'Across the nipples, around the fullest part of the chest.' },
  { key: 'leftArm', label: 'Left Arm', hint: 'Around the largest part of the relaxed (or flexed) upper arm.' },
  { key: 'rightArm', label: 'Right Arm', hint: 'Around the largest part of the relaxed (or flexed) upper arm.' },
  { key: 'waist', label: 'Waist', hint: 'Around the navel, relaxed — don’t suck in.' },
  { key: 'hips', label: 'Hips', hint: 'Around the widest point of your hips/glutes.' },
  { key: 'leftThigh', label: 'Left Thigh', hint: 'Around the largest part of the upper thigh.' },
  { key: 'rightThigh', label: 'Right Thigh', hint: 'Around the largest part of the upper thigh.' },
  { key: 'leftCalf', label: 'Left Calf', hint: 'Around the largest part of the calf.' },
  { key: 'rightCalf', label: 'Right Calf', hint: 'Around the largest part of the calf.' },
];
const SITE = (k: SiteKey) => SITES.find((s) => s.key === k)!;
const today = () => new Date().toISOString().slice(0, 10);

const CONN: Record<TapeStatus, { color: string; label: string }> = {
  idle: { color: colors.muted, label: 'Disconnected' },
  scanning: { color: colors.warning, label: 'Searching…' },
  connecting: { color: colors.warning, label: 'Connecting…' },
  connected: { color: colors.success, label: 'Connected' },
  error: { color: colors.danger, label: 'Disconnected' },
};

export function TapeMeasureView({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const isImperial = unit === 'IMPERIAL';
  const lbl = isImperial ? 'in' : 'cm';
  const toDisp = (cm: number) => (isImperial ? cm / 2.54 : cm);

  const { status, reading, error, start, stop } = useRenphoTape();
  const [site, setSite] = useState<SiteKey>('waist');
  const [captured, setCaptured] = useState<Record<string, number>>({});

  const refreshCaptured = useCallback(() => {
    const todays = healthRepo.getMeasurements().find((m) => m.date === today());
    const map: Record<string, number> = {};
    if (todays) for (const s of SITES) { const v = todays[s.key] as number | null; if (v != null) map[s.key] = v; }
    setCaptured(map);
  }, []);

  // Connect on mount, disconnect on unmount.
  useEffect(() => {
    refreshCaptured();
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveCm = reading?.cm ?? null;
  const liveDisp = liveCm != null ? toDisp(liveCm) : null;

  const saveCurrent = () => {
    if (liveCm == null) return;
    healthRepo.upsertMeasurementSite(today(), site, liveCm);
    haptic.success();
    refreshCaptured();
    onChanged();
    // Advance to the next not-yet-measured site to keep a smooth flow.
    const next = SITES.find((s) => s.key !== site && captured[s.key] == null);
    if (next) setSite(next.key);
  };

  const conn = CONN[status];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ChevronLeft color={colors.text} size={24} />
          <FsText variant="bodyMedium">Back</FsText>
        </Pressable>
        <FsText variant="cardTitle">Renpho Tape</FsText>
        <View style={styles.conn}>
          <View style={[styles.dot, { backgroundColor: conn.color }]} />
          <FsText variant="caption" style={{ color: conn.color }}>{conn.label}</FsText>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }}>
        {/* Big live reading */}
        <View style={styles.readingWrap}>
          <FsText variant="overline" style={{ color: colors.primary }}>{SITE(site).label}</FsText>
          <FsText style={[styles.bigReading, reading?.confirmed ? { color: colors.success } : {}]}>
            {liveDisp != null ? liveDisp.toFixed(2) : '– –'}
            <FsText style={styles.unit}> {lbl}</FsText>
          </FsText>
          {/* While Bluetooth is on we just keep scanning — prompt the user to ready the tape. */}
          {status !== 'connected' && status !== 'error' && (
            <FsText variant="caption" style={{ color: colors.muted, marginTop: space[1], textAlign: 'center', maxWidth: 300 }}>
              Turn your tape on and pull it out a little — it’ll connect automatically.
            </FsText>
          )}
          {/* The only hard error: phone Bluetooth is off. */}
          {status === 'error' && (
            <>
              {!!error && <FsText variant="caption" style={{ color: colors.danger, marginTop: 4, textAlign: 'center' }}>{error}</FsText>}
              <Button title="Try again" variant="ghost" onPress={start} style={{ marginTop: space[1] }} />
            </>
          )}
        </View>

        {/* Where-to-measure guide */}
        <View style={{ alignItems: 'center', marginVertical: space[3] }}>
          <BodyDiagram site={site} height={220} />
          <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 280, marginTop: space[2] }}>
            {SITE(site).hint}
          </FsText>
        </View>

        {/* Site selector */}
        <View style={styles.chips}>
          {SITES.map((s) => {
            const sel = s.key === site;
            const done = captured[s.key] != null;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSite(s.key)}
                style={[styles.chip, done && styles.chipDone, sel && styles.chipOn]}
              >
                {done && <Check color={sel ? colors.white : colors.success} size={12} strokeWidth={3} />}
                <FsText variant="caption" style={{ color: sel ? colors.white : done ? colors.success : colors.muted, fontWeight: '600' }}>
                  {s.label}
                </FsText>
              </Pressable>
            );
          })}
        </View>

        <Button title={`Save ${SITE(site).label}`} onPress={saveCurrent} disabled={liveCm == null} style={{ marginTop: space[3] }} />

        {/* Session progress */}
        <View style={{ marginTop: space[4] }}>
          <SectionHeader title="This session" />
          {SITES.map((s) => {
            const v = captured[s.key];
            return (
              <View key={s.key} style={styles.measRow}>
                <View style={[styles.dotSm, { backgroundColor: v != null ? colors.success : colors.border }]} />
                <FsText variant="body" style={{ flex: 1, color: v != null ? colors.text : colors.muted }}>{s.label}</FsText>
                <FsText variant="bodyMedium" style={{ color: v != null ? colors.text : colors.muted }}>
                  {v != null ? `${toDisp(v).toFixed(2)} ${lbl}` : '—'}
                </FsText>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  conn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  readingWrap: { alignItems: 'center', paddingVertical: space[3], gap: 2 },
  bigReading: { fontSize: 64, lineHeight: 72, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 22, fontWeight: '600', color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDone: { borderColor: colors.success },
  measRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: colors.border },
  dotSm: { width: 8, height: 8, borderRadius: 4 },
}));
