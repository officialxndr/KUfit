import { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ruler, X, Pencil, Check, ChevronRight, Sparkles } from 'lucide-react-native';

import { Card, FsText, Button, SectionHeader } from '@/components/ui';
import { StepperField } from '@/components/StepperField';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { BottomSheet } from '@/components/BottomSheet';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { UNIT_LABELS, inchesToCm } from '@/lib/units';
import { colors, radius, space } from '@/theme/tokens';
import type { BodyMeasurement } from '@/types';

type SiteKey = keyof BodyMeasurement;
const SITES: { key: SiteKey; label: string }[] = [
  { key: 'neck', label: 'Neck' }, { key: 'shoulders', label: 'Shoulders' }, { key: 'chest', label: 'Chest' },
  { key: 'leftArm', label: 'Left Arm' }, { key: 'rightArm', label: 'Right Arm' }, { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' }, { key: 'leftThigh', label: 'Left Thigh' }, { key: 'rightThigh', label: 'Right Thigh' },
  { key: 'leftCalf', label: 'Left Calf' }, { key: 'rightCalf', label: 'Right Calf' },
];
const SITE_LABEL = (k: SiteKey) => SITES.find((s) => s.key === k)?.label ?? String(k);

// Approximate "ideal" aesthetic proportions (Grecian / Steve-Reeves style), as
// relative units. ratio(anchor→site) = IDEAL[site] / IDEAL[anchor]. These are
// rough guidelines, not medical/objective targets.
const IDEAL: Record<string, number> = {
  neck: 1.0, shoulders: 2.24, chest: 1.99, leftArm: 1.0, rightArm: 1.0,
  waist: 1.39, hips: 1.5, leftThigh: 1.2, rightThigh: 1.2, leftCalf: 1.0, rightCalf: 1.0,
};

export function HealthMeasure() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const measurementGoals = useSettingsStore((s) => s.profile.measurementGoals) ?? {};
  const setProfile = useSettingsStore((s) => s.setProfile);
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
        return { key: site.key, label: site.label, cur, last, delta };
      }).filter(Boolean)
    : [];

  const remove = (m: BodyMeasurement) => { healthRepo.deleteMeasurement(m.id); refresh(); };
  const [siteKey, setSiteKey] = useState<SiteKey | null>(null);

  // Retain the last opened value so the sheet can animate its slide-out after the
  // selection is cleared (the sheet stays mounted until the exit finishes).
  const lastDetail = useRef<BodyMeasurement | null>(null);
  if (detail) lastDetail.current = detail;
  const lastSite = useRef<SiteKey | null>(null);
  if (siteKey) lastSite.current = siteKey;
  const activeSite = (siteKey ?? lastSite.current) as SiteKey | null;

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
            <Pressable key={r!.label} style={[styles.row, i > 0 && styles.divider]} onPress={() => setSiteKey(r!.key)}>
              <FsText variant="body" style={{ flex: 1 }}>{r!.label}</FsText>
              <FsText variant="bodyMedium" style={styles.colNum}>{fmt(r!.cur)}</FsText>
              <FsText variant="caption" style={styles.colNum}>{r!.last != null ? fmt(r!.last) : '—'}</FsText>
              <FsText
                variant="caption"
                style={[styles.colDeltaTap, { color: r!.delta == null || Math.abs(r!.delta) < 0.05 ? colors.muted : r!.delta < 0 ? colors.success : colors.danger }]}
              >
                {r!.delta == null ? '—' : `${r!.delta > 0 ? '+' : ''}${r!.delta.toFixed(1)}`}
              </FsText>
              <ChevronRight color={colors.muted} size={14} />
            </Pressable>
          ))}
        </Card>
      )}
      <FsText variant="caption" style={{ marginTop: -space[1], marginBottom: space[3] }}>Tap a site for trends, goals & ideal proportions.</FsText>

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

      {lastDetail.current && (
        <MeasurementDetail
          visible={!!detail}
          entry={lastDetail.current}
          entries={entries}
          unit={unit}
          fmt={fmt}
          toLen={toLen}
          fromLen={fromLen}
          onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); refresh(); }}
        />
      )}

      {activeSite && (
        <SiteDetail
          visible={!!siteKey}
          siteKey={activeSite}
          entries={entries}
          unit={unit}
          toLen={toLen}
          fromLen={fromLen}
          lengthLabel={lengthLabel}
          goalCm={measurementGoals[activeSite] ?? null}
          onSetGoal={(cm) => setProfile({ measurementGoals: { ...measurementGoals, [activeSite]: cm } })}
          onClearGoal={() => { const { [activeSite]: _, ...rest } = measurementGoals; setProfile({ measurementGoals: rest }); }}
          onClose={() => setSiteKey(null)}
        />
      )}
    </>
  );
}

/** Per-site insight popup: trends over time, next landmark, a goal, and ideal-ratio suggestions. */
function SiteDetail({ visible, siteKey, entries, unit, toLen, fromLen, lengthLabel, goalCm, onSetGoal, onClearGoal, onClose }: {
  visible: boolean;
  siteKey: SiteKey;
  entries: BodyMeasurement[];
  unit: string;
  toLen: (cm: number) => number;
  fromLen: (v: number) => number;
  lengthLabel: string;
  goalCm: number | null;
  onSetGoal: (cm: number) => void;
  onClearGoal: () => void;
  onClose: () => void;
}) {
  const [anchor, setAnchor] = useState<SiteKey | null>(null);
  const latest = entries[0];
  const curCm = (latest?.[siteKey] as number | null) ?? null;
  const curDisp = curCm != null ? toLen(curCm) : null;

  // Value at (or just before) N months ago → delta vs now.
  const valueMonthsAgo = (months: number): number | null => {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
    const iso = cutoff.toISOString().slice(0, 10);
    const e = entries.find((m) => m.date <= iso && m[siteKey] != null); // entries are DESC
    return e ? (e[siteKey] as number) : null;
  };
  const trend = (months: number) => {
    const past = valueMonthsAgo(months);
    if (curCm == null || past == null) return null;
    return toLen(curCm) - toLen(past);
  };

  // Next round-number landmark above the current value (0.5 in / 1 cm steps).
  const step = unit === 'IMPERIAL' ? 0.5 : 1;
  const nextLandmark = curDisp != null ? (Math.floor(curDisp / step) + 1) * step : null;

  // Ideal proportion vs a chosen anchor site.
  const anchorCm = anchor && latest ? (latest[anchor] as number | null) : null;
  const suggestedCm = anchor && anchorCm != null && IDEAL[siteKey] && IDEAL[anchor]
    ? anchorCm * (IDEAL[siteKey] / IDEAL[anchor]) : null;
  const anchorOptions = SITES.filter((s) => s.key !== siteKey && latest?.[s.key] != null && IDEAL[s.key]);

  const goalDisp = goalCm != null ? Math.round(toLen(goalCm) * 10) / 10 : 0;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHead}>
        <FsText variant="cardTitle">{SITE_LABEL(siteKey)}</FsText>
        <Pressable onPress={onClose} hitSlop={8}><X color={colors.text} size={22} /></Pressable>
      </View>

      <ScrollView style={{ maxHeight: 460 }}>
            <FsText variant="display" style={{ marginBottom: space[2] }}>
              {curDisp != null ? `${curDisp.toFixed(1)} ${lengthLabel}` : '—'}
            </FsText>

            {/* Trends */}
            <FsText variant="overline" style={{ marginTop: space[2], marginBottom: space[2] }}>Change over time</FsText>
            <View style={styles.trendRow}>
              {([['3 mo', trend(3)], ['6 mo', trend(6)], ['1 yr', trend(12)]] as const).map(([l, d]) => (
                <View key={l} style={styles.trendCell}>
                  <FsText variant="caption">{l}</FsText>
                  <FsText variant="cardTitle" style={{ color: d == null || Math.abs(d) < 0.05 ? colors.muted : d < 0 ? colors.success : colors.danger }}>
                    {d == null ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)}`}
                  </FsText>
                </View>
              ))}
            </View>
            {nextLandmark != null && (
              <FsText variant="caption" style={{ marginTop: space[2] }}>
                Next landmark: {nextLandmark.toFixed(1)} {lengthLabel}
              </FsText>
            )}

            {/* Goal */}
            <View style={styles.goalRow}>
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">Goal</FsText>
                {goalCm != null && curCm != null && (
                  <FsText variant="caption" style={{ marginTop: 2 }}>
                    {(toLen(goalCm) - toLen(curCm)).toFixed(1)} {lengthLabel} to go
                  </FsText>
                )}
              </View>
              <StepperField value={goalDisp} onCommit={(n) => (n > 0 ? onSetGoal(fromLen(n)) : onClearGoal())} step={step} min={0} max={120} unit={lengthLabel} />
            </View>

            {/* Golden ratio */}
            <View style={styles.ratioBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space[2] }}>
                <Sparkles color={colors.primary} size={16} />
                <FsText variant="bodyMedium">Ideal proportion</FsText>
              </View>
              <FsText variant="caption" style={{ marginBottom: space[2] }}>
                Pick a site you're happy with; see this site's classically-proportioned target (approximate aesthetic ideal).
              </FsText>
              <View style={styles.chips}>
                {anchorOptions.map((s) => (
                  <Pressable key={s.key} onPress={() => setAnchor(s.key)} style={[styles.chip, anchor === s.key && styles.chipOn]}>
                    <FsText variant="caption" style={{ color: anchor === s.key ? colors.white : colors.muted, fontWeight: '600' }}>{s.label}</FsText>
                  </Pressable>
                ))}
              </View>
              {suggestedCm != null && (
                <View style={{ marginTop: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <FsText variant="caption">Suggested {SITE_LABEL(siteKey)}</FsText>
                    <FsText variant="cardTitle">{toLen(suggestedCm).toFixed(1)} {lengthLabel}</FsText>
                  </View>
                  <Button title="Set as goal" onPress={() => onSetGoal(suggestedCm)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
                </View>
              )}
            </View>
          </ScrollView>
    </BottomSheet>
  );
}

function MeasurementDetail({ visible, entry, entries, fmt, toLen, fromLen, onClose, onSaved }: {
  visible: boolean;
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
    <BottomSheet visible={visible} onClose={onClose}>
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
    </BottomSheet>
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
  colDeltaTap: { width: 44, textAlign: 'right' },
  trendRow: { flexDirection: 'row', gap: space[2] },
  trendCell: { flex: 1, alignItems: 'center', backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingVertical: space[3], gap: 2 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.border },
  ratioBox: { marginTop: space[4], padding: space[3], backgroundColor: colors.surfaceHigh, borderRadius: radius.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  editInput: { width: 90, textAlign: 'right', color: colors.text, backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space[2],
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  milestones: { marginTop: space[3], gap: 3, padding: space[3], backgroundColor: colors.surfaceHigh, borderRadius: radius.md },
});
