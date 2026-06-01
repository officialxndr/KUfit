import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ruler, X, Pencil, Check } from 'lucide-react-native';

import { Card, FsText, Button, SectionHeader } from '@/components/ui';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { UNIT_LABELS, inchesToCm } from '@/lib/units';
import { colors, radius, space } from '@/theme/tokens';
import type { BodyMeasurement } from '@/types';

const SITES: { key: keyof BodyMeasurement; label: string }[] = [
  { key: 'neck', label: 'Neck' }, { key: 'shoulders', label: 'Shoulders' }, { key: 'chest', label: 'Chest' },
  { key: 'leftArm', label: 'Left Arm' }, { key: 'rightArm', label: 'Right Arm' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'leftThigh', label: 'Left Thigh' }, { key: 'rightThigh', label: 'Right Thigh' },
  { key: 'leftCalf', label: 'Left Calf' }, { key: 'rightCalf', label: 'Right Calf' },
];

export function HealthMeasure() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [detail, setDetail] = useState<BodyMeasurement | null>(null);

  const refresh = useCallback(() => {
    setEntries(healthRepo.getMeasurements()); // already date DESC
  }, []);
  useFocusEffect(refresh);

  const lengthLabel = UNIT_LABELS[unit].smallLength;
  const toLen = (cm: number) => (unit === 'IMPERIAL' ? cm / 2.54 : cm);
  const fromLen = (v: number) => (unit === 'IMPERIAL' ? inchesToCm(v) : v);
  const fmt = (cm: number) => `${toLen(cm).toFixed(1)} ${lengthLabel}`;
  const filledCount = (m: BodyMeasurement) => SITES.filter((s) => m[s.key] != null).length;

  const latest = entries[0];
  const prev = entries[1];
  const rows = latest
    ? SITES.map((site) => {
        const cur = latest[site.key] as number | null | undefined;
        if (cur == null) return null;
        const last = prev?.[site.key] as number | null | undefined;
        const delta = last != null ? toLen(cur) - toLen(last) : null;
        return { label: site.label, cur, last, delta };
      }).filter(Boolean)
    : [];

  const remove = (m: BodyMeasurement) => { healthRepo.deleteMeasurement(m.id); refresh(); };

  return (
    <>
      <View style={styles.head}>
        <View>
          <FsText variant="cardTitle">Body Measurements</FsText>
          <FsText variant="caption">{latest ? `Last logged ${latest.date}` : 'Nothing logged yet'}</FsText>
        </View>
        <Button title="+ Log" onPress={() => router.push('/measurements')} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Ruler color={colors.muted} size={28} /></View>
          <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
            Log waist, chest, arms and more to track changes over time.
          </FsText>
        </View>
      ) : (
        <Card style={{ padding: 0, marginBottom: space[3] }}>
          <View style={styles.rowHead}>
            <FsText variant="overline" style={{ flex: 1 }}>Latest · Site</FsText>
            <FsText variant="overline" style={styles.colNum}>Current</FsText>
            <FsText variant="overline" style={styles.colNum}>Last</FsText>
            <FsText variant="overline" style={styles.colDelta}>Δ</FsText>
          </View>
          {rows.map((r, i) => (
            <View key={r!.label} style={[styles.row, i > 0 && styles.divider]}>
              <FsText variant="body" style={{ flex: 1 }}>{r!.label}</FsText>
              <FsText variant="bodyMedium" style={styles.colNum}>{fmt(r!.cur)}</FsText>
              <FsText variant="caption" style={styles.colNum}>{r!.last != null ? fmt(r!.last) : '—'}</FsText>
              <FsText
                variant="caption"
                style={[styles.colDelta, { color: r!.delta == null || Math.abs(r!.delta) < 0.05 ? colors.muted : r!.delta < 0 ? colors.success : colors.danger }]}
              >
                {r!.delta == null ? '—' : `${r!.delta > 0 ? '+' : ''}${r!.delta.toFixed(1)}`}
              </FsText>
            </View>
          ))}
        </Card>
      )}

      {/* History — tap to inspect/edit, swipe to delete a snapshot */}
      {entries.length > 0 && (
        <>
          <SectionHeader title="History" />
          {entries.map((m) => (
            <SwipeToDelete key={m.id} onDelete={() => remove(m)} confirmTitle="Delete snapshot?" confirmMessage={`Remove the ${m.date} measurement snapshot?`}>
              <Pressable onPress={() => setDetail(m)}>
                <Card style={{ marginBottom: space[2], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <FsText variant="bodyMedium">{m.date}</FsText>
                  <FsText variant="caption">{filledCount(m)} site{filledCount(m) === 1 ? '' : 's'} ›</FsText>
                </Card>
              </Pressable>
            </SwipeToDelete>
          ))}
        </>
      )}

      {detail && (
        <MeasurementDetail
          entry={detail}
          entries={entries}
          unit={unit}
          fmt={fmt}
          toLen={toLen}
          fromLen={fromLen}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); refresh(); }}
        />
      )}
    </>
  );
}

function MeasurementDetail({ entry, entries, fmt, toLen, fromLen, onClose, onSaved }: {
  entry: BodyMeasurement;
  entries: BodyMeasurement[];
  unit: string;
  fmt: (cm: number) => string;
  toLen: (cm: number) => number;
  fromLen: (v: number) => number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const idx = entries.findIndex((e) => e.id === entry.id);
  const older = entries[idx + 1]; // previous in time (entries are DESC)
  const first = entries[entries.length - 1];
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const s of SITES) { const v = entry[s.key] as number | null; o[s.key] = v != null ? toLen(v).toFixed(1) : ''; }
    return o;
  });

  const save = () => {
    const patch: Record<string, number | null> = {};
    for (const s of SITES) {
      const raw = vals[s.key].trim();
      patch[s.key] = raw === '' ? null : fromLen(Number(raw) || 0);
    }
    healthRepo.updateMeasurement(entry.id, patch);
    onSaved();
  };

  const milestones = useMemo(() => {
    if (!first || first.id === entry.id) return [];
    return SITES.map((s) => {
      const cur = entry[s.key] as number | null;
      const start = first[s.key] as number | null;
      if (cur == null || start == null) return null;
      const d = toLen(cur) - toLen(start);
      if (Math.abs(d) < 0.05) return null;
      return { label: s.label, d };
    }).filter(Boolean).sort((a, b) => Math.abs(b!.d) - Math.abs(a!.d)).slice(0, 3);
  }, [entry, first]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <FsText variant="cardTitle">{entry.date}</FsText>
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <Pressable onPress={() => (editing ? save() : setEditing(true))} hitSlop={8}>
                {editing ? <Check color={colors.success} size={22} /> : <Pencil color={colors.muted} size={20} />}
              </Pressable>
              <Pressable onPress={onClose} hitSlop={8}><X color={colors.text} size={22} /></Pressable>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {SITES.map((s) => {
              const cur = entry[s.key] as number | null;
              const olderV = older?.[s.key] as number | null | undefined;
              const delta = cur != null && olderV != null ? toLen(cur) - toLen(olderV) : null;
              return (
                <View key={s.key} style={[styles.row, styles.divider]}>
                  <FsText variant="body" style={{ flex: 1 }}>{s.label}</FsText>
                  {editing ? (
                    <TextInput
                      value={vals[s.key]}
                      onChangeText={(t) => setVals((v) => ({ ...v, [s.key]: t }))}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.muted}
                      style={styles.editInput}
                    />
                  ) : (
                    <>
                      <FsText variant="bodyMedium" style={styles.colNum}>{cur != null ? fmt(cur) : '—'}</FsText>
                      <FsText variant="caption" style={[styles.colDelta, { color: delta == null || Math.abs(delta) < 0.05 ? colors.muted : delta < 0 ? colors.success : colors.danger }]}>
                        {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                      </FsText>
                    </>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {!editing && milestones.length > 0 && (
            <View style={styles.milestones}>
              <FsText variant="overline" style={{ marginBottom: space[2] }}>Since first log ({first.date})</FsText>
              {milestones.map((m) => (
                <FsText key={m!.label} variant="caption" style={{ color: m!.d < 0 ? colors.success : colors.danger }}>
                  {m!.label}: {m!.d > 0 ? '+' : ''}{m!.d.toFixed(1)}
                </FsText>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  rowHead: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[2],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  colNum: { width: 78, textAlign: 'right' },
  colDelta: { width: 48, textAlign: 'right' },
  editInput: { width: 90, textAlign: 'right', color: colors.text, backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space[2],
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space[4], paddingBottom: space[8] },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  milestones: { marginTop: space[3], gap: 3, padding: space[3], backgroundColor: colors.surfaceHigh, borderRadius: radius.md },
});
