import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';

import { FsText, Button, Badge } from '@/components/ui';
import { ModalHeader } from '@/components/ModalHeader';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { UNIT_LABELS, inchesToCm } from '@/lib/units';
import {
  idealProportions,
  proportionProgress,
  frameFromWrist,
  PROPORTION_PARTS,
  PROPORTION_INVERSE,
  type Frame,
} from '@/lib/proportions';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { BodyMeasurement } from '@/types';

const round1 = (n: number) => Math.round(n * 10) / 10;
const FRAME_LABEL: Record<Frame, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

/**
 * Configure ideal proportions from a wrist (+ optional ankle) circumference — the wrist is a
 * near-pure-bone frame proxy that barely changes, so it's config (`profile.wristCm/ankleCm`),
 * not a tracked measurement. Previews McCallum/golden-ratio/Reeves targets vs current, and
 * applies them into `measurementGoals` in one tap (see `lib/proportions.ts`).
 */
export default function Proportions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const unit = profile.unitSystem;
  const lengthLabel = UNIT_LABELS[unit].smallLength;

  const toLen = (cm: number) => (unit === 'IMPERIAL' ? cm / 2.54 : cm);
  const fromLen = (v: number) => (unit === 'IMPERIAL' ? inchesToCm(v) : v);
  const fmt = (cm: number) => `${round1(toLen(cm))} ${lengthLabel}`;

  const [wrist, setWrist] = useState(profile.wristCm != null ? String(round1(toLen(profile.wristCm))) : '');
  const [ankle, setAnkle] = useState(profile.ankleCm != null ? String(round1(toLen(profile.ankleCm))) : '');

  const wristCm = wrist.trim() && Number.isFinite(Number(wrist)) ? fromLen(Number(wrist)) : null;
  const ankleCm = ankle.trim() && Number.isFinite(Number(ankle)) ? fromLen(Number(ankle)) : null;

  const latest = useMemo<BodyMeasurement | null>(() => healthRepo.getLatestMeasurementBySite(), []);
  const targets = idealProportions(wristCm, ankleCm);
  const frame = frameFromWrist(wristCm);

  // Persist the wrist/ankle config (so per-site "ideal from wrist" hints work app-wide).
  const persist = () => setProfile({ wristCm, ankleCm });

  const close = () => { persist(); router.back(); };

  const applyAll = () => {
    if (!targets) return Alert.alert('Enter your wrist', 'Add your wrist measurement to compute targets.');
    persist();
    const goals: Record<string, number> = { ...(profile.measurementGoals ?? {}) };
    for (const [key, cm] of Object.entries(targets)) goals[key] = round1(cm);
    setProfile({ measurementGoals: goals });
    haptic.success();
    Alert.alert('Goals updated', 'Your ideal targets are now set as the goal for every body part. Tweak any of them per-site in Measurements.');
  };

  return (
    <View style={styles.screen}>
      <ModalHeader title="Ideal proportions" onClose={close} />

      <ScrollView
        contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[8] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <FsText variant="caption" style={{ marginBottom: space[4], lineHeight: 18 }}>
          Your wrist is almost pure bone, so it's a stable proxy for your frame. We anchor classic
          bodybuilding targets to it (McCallum + golden ratio; an optional ankle refines legs). These are
          aesthetic guidelines from tradition — not rules — and shift with your build and where you carry fat.
        </FsText>

        <Label text={`Wrist (${lengthLabel})`} />
        <Field value={wrist} onChangeText={setWrist} onEndEditing={persist} placeholder="Measure just above the wrist bone" suffix={lengthLabel} autoFocus />

        <Label text={`Ankle (${lengthLabel}) — optional`} />
        <Field value={ankle} onChangeText={setAnkle} onEndEditing={persist} placeholder="Refines calves & thighs" suffix={lengthLabel} />
        <FsText variant="caption" style={{ color: colors.muted, marginTop: -space[2], marginBottom: space[4] }}>
          With an ankle, calves & thighs use Steve Reeves' ankle anchor instead of the chest ratio.
        </FsText>

        {frame && (
          <View style={styles.frameRow}>
            <FsText variant="bodyMedium">Frame</FsText>
            <Badge label={FRAME_LABEL[frame]} tone="primary" />
          </View>
        )}

        {!targets ? (
          <FsText variant="caption" style={{ color: colors.muted, marginTop: space[3] }}>
            Enter your wrist measurement above to see your targets.
          </FsText>
        ) : (
          <>
            <Button title="Set all as my goals" onPress={applyAll} style={{ marginTop: space[2], marginBottom: space[4] }} />

            <View style={styles.tableHead}>
              <FsText variant="overline" style={{ flex: 1 }}>Part</FsText>
              <FsText variant="overline" style={styles.colTarget}>Target</FsText>
              <FsText variant="overline" style={styles.colStatus}>You</FsText>
            </View>
            {PROPORTION_PARTS.map((part) => {
              const targetCm = targets[part.key];
              const curCm = (latest?.[part.key] as number | null | undefined) ?? null;
              const inverse = PROPORTION_INVERSE.has(part.key);
              const p = proportionProgress(curCm, targetCm, inverse);
              let status = '—';
              let tone = colors.muted;
              if (p.state === 'reached') { status = 'reached'; tone = colors.success; }
              else if (p.state === 'on_target') { status = 'on target'; tone = colors.success; }
              else if (p.state === 'building') { status = `${round1(toLen(p.remaining))} to go`; tone = colors.text; }
              else if (p.state === 'over') { status = `+${round1(toLen(p.over))} over`; tone = colors.danger; }
              return (
                <View key={part.key} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <FsText variant="body">{part.label}</FsText>
                    {(part.note || inverse) && (
                      <FsText variant="caption" style={{ color: colors.muted, fontSize: 11 }}>
                        {inverse ? 'keep at or below' : part.note}
                      </FsText>
                    )}
                  </View>
                  <FsText variant="bodyMedium" style={styles.colTarget}>{fmt(targetCm)}</FsText>
                  <FsText variant="caption" style={[styles.colStatus, { color: tone }]}>
                    {curCm != null ? status : '—'}
                  </FsText>
                </View>
              );
            })}

            <View style={styles.noteBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space[1] }}>
                <Sparkles color={colors.primary} size={14} />
                <FsText variant="caption" style={{ color: colors.text, fontWeight: '600' }}>Symmetry triad</FsText>
              </View>
              <FsText variant="caption" style={{ color: colors.muted, lineHeight: 17 }}>
                Reeves' balance check: your neck, flexed arms and flexed calves should end up roughly equal.
                And the waist is the one number you keep small — through overall fat loss, not spot training.
              </FsText>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <FsText variant="caption" style={{ marginBottom: 6 }}>{text}</FsText>;
}

function Field({
  value, onChangeText, onEndEditing, placeholder, suffix, autoFocus = false,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onEndEditing?: () => void;
  placeholder: string;
  suffix: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={[styles.field, { marginBottom: space[4] }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
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
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 18 },
  frameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space[3], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  tableHead: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: space[2],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  colTarget: { width: 84, textAlign: 'right' },
  colStatus: { width: 92, textAlign: 'right' },
  noteBox: { marginTop: space[4], padding: space[3], backgroundColor: colors.surfaceHigh, borderRadius: radius.md },
}));
