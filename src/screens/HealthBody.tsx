import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Scale, TrendingDown, TrendingUp, Minus, Target } from 'lucide-react-native';

import { Card, FsText, Badge, Button } from '@/components/ui';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { formatWeight, toDisplay, UNIT_LABELS } from '@/lib/units';
import { estimateBodyFat, navyBodyFat, composition, targetWeightForBodyFat } from '@/lib/bodyComposition';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { WeightEntry, BodyMeasurement, UnitSystem } from '@/types';

/** Waist change since a scan — direction only; visceral fat tracks waist directionally. */
function computeWaistTrend(measurements: BodyMeasurement[], scanDate: string | null): { deltaCm: number } | null {
  if (!scanDate) return null;
  const withWaist = measurements.filter((m) => m.waist != null); // newest-first
  if (withWaist.length < 1) return null;
  const now = withWaist[0];
  const atScan = withWaist.find((m) => m.date <= scanDate) ?? withWaist[withWaist.length - 1];
  if (!now || !atScan || now.date === atScan.date) return null;
  return { deltaCm: (now.waist as number) - (atScan.waist as number) };
}

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
  const router = useRouter();
  const profile = useSettingsStore((s) => s.profile);
  const unit = profile.unitSystem;
  const [latest, setLatest] = useState<WeightEntry | null>(null);
  const [baseline, setBaseline] = useState<WeightEntry | null>(null);
  const [measurement, setMeasurement] = useState<BodyMeasurement | null>(null);
  const [dexa, setDexa] = useState<WeightEntry | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);

  const refresh = useCallback(() => {
    setLatest(healthRepo.getLatestWeightEntry());
    setBaseline(healthRepo.getLatestBodyFatBaseline());
    // Coalesce the latest non-null value per site — waist & neck may live on
    // different dated rows, and the Navy estimate needs them together.
    setMeasurement(healthRepo.getLatestMeasurementBySite());
    setDexa(healthRepo.getLatestDexa());
    setMeasurements(healthRepo.getMeasurements()); // newest-first; powers the waist-trend cue
  }, []);
  useFocusEffect(refresh);

  const openDexa = () => router.push('/log-dexa');

  // U.S. Navy estimate from the latest tape measurement + height/sex, when available.
  const navyBf =
    profile.navyBodyFatEnabled && measurement && profile.heightCm && (profile.sex === 'MALE' || profile.sex === 'FEMALE')
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
    syncBodyFatGoalWeight(); // a new body-fat reading changes lean mass → refresh the derived goal weight
    haptic.success();
    refresh();
  };

  if (!latest) {
    return <Empty message="Log your weight — or a full DEXA scan — to see body composition." action={{ label: 'Log DEXA scan', onPress: openDexa }} />;
  }

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
    // With the Navy estimate turned off, the only sources are a value you enter or a
    // DEXA baseline — guide toward that rather than the tape-measurement formula.
    if (!profile.navyBodyFatEnabled) {
      return <Empty message="Enter a body-fat % when you log your weight (e.g. from a DEXA scan or calipers) to see body composition. You can also turn the U.S. Navy tape estimate back on in Settings." action={{ label: 'Log DEXA scan', onPress: openDexa }} />;
    }
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
      // Everything's present but the formula is out of domain (e.g. waist ≤ neck).
      message = 'Your measurements don’t fit the U.S. Navy formula (waist must exceed neck). Re-check your waist/neck' + (profile.sex === 'FEMALE' ? '/hips' : '') + ', or enter a body-fat % when you log your weight.';
    } else {
      const parts: string[] = [];
      if (needSettings.length) parts.push(`set your ${joinList(needSettings)} in Settings`);
      if (needMeasure.length) parts.push(`log your ${joinList(needMeasure)} in Measurements`);
      message = `To estimate body fat with the U.S. Navy method, ${parts.join(' and ')}. Or enter a body-fat % when you log your weight (e.g. from a DEXA scan).`;
    }
    return <Empty message={message} action={{ label: 'Log DEXA scan', onPress: openDexa }} />;
  }

  const weightKg = latest.weightKg;
  const boneKg = dexa?.boneMassKg ?? null; // carried forward from the last DEXA (~constant)
  const comp = composition(weightKg, bf, boneKg);
  const fatKg = comp.fatKg;
  const leanKg = comp.ffmKg;          // fat-free mass (incl. bone) — drives FFMI
  const leanSoftKg = comp.leanSoftKg; // muscle/organs/water, bone removed (null without a DEXA)
  const estimated = source !== 'measured';
  const hM = profile.heightCm ? profile.heightCm / 100 : null;
  const bmi = hM ? weightKg / (hM * hM) : null;
  const ffmi = hM ? leanKg / (hM * hM) : null;
  const band = bfBand(bf);
  // Optional body-fat goal: target total mass at that %, holding current lean mass.
  // Only surfaced when the goal is actually expressed by body fat (not scale weight).
  const goalBf = profile.goalMode === 'bodyfat' ? profile.goalBodyFat : null;
  const goalTargetKg = goalBf != null ? targetWeightForBodyFat(leanKg, goalBf) : null;
  const goalDeltaKg = goalTargetKg != null ? weightKg - goalTargetKg : null;
  const goToSettings = () => useNavStore.getState().setSection('settings');
  // Composition-bar flex weights (×10 → integer ratios). 3-way when bone is known.
  const leanFlex = Math.round((leanSoftKg ?? leanKg) * 10);
  const fatFlex = Math.round(fatKg * 10);
  const boneFlex = boneKg != null ? Math.round(boneKg * 10) : 0;
  // Direction-only cue for visceral fat (magnitude isn't reliable from waist alone).
  const waistTrend = computeWaistTrend(measurements, dexa?.date ?? null);

  return (
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
        {leanSoftKg != null ? (
          <>
            <Metric label="Lean (soft tissue)" value={formatWeight(leanSoftKg, unit)} tone={colors.success} />
            <Metric label="Fat Mass" value={formatWeight(fatKg, unit)} tone={colors.muted} />
            <Metric label="Bone" value={formatWeight(boneKg as number, unit)} />
          </>
        ) : (
          <>
            <Metric label="Lean Mass" value={formatWeight(leanKg, unit)} tone={colors.success} />
            <Metric label="Fat Mass" value={formatWeight(fatKg, unit)} tone={colors.muted} />
          </>
        )}
        <Metric label="BMI" value={bmi != null ? bmi.toFixed(1) : 'Add height'} onPress={bmi == null ? goToSettings : undefined} />
        <Metric label="FFMI" value={ffmi != null ? ffmi.toFixed(1) : 'Add height'} tone={ffmi != null ? colors.primary : undefined} onPress={ffmi == null ? goToSettings : undefined} />
      </View>

      {goalBf != null && goalTargetKg != null && goalDeltaKg != null && (
        <Card style={{ marginBottom: space[3] }}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Target color={colors.primary} size={16} />
              <FsText variant="cardTitle">Body-fat goal</FsText>
            </View>
            <Badge label={`${goalBf}%`} tone="primary" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space[3] }}>
            <View>
              <FsText variant="caption">Target weight</FsText>
              <FsText variant="stat" style={{ marginTop: 2 }}>{formatWeight(goalTargetKg, unit)}</FsText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <FsText variant="caption">{goalDeltaKg >= 0 ? 'Fat to lose' : 'Room to gain'}</FsText>
              <FsText variant="stat" style={{ marginTop: 2, color: goalDeltaKg >= 0 ? colors.warning : colors.success }}>
                {formatWeight(Math.abs(goalDeltaKg), unit)}
              </FsText>
            </View>
          </View>
          <FsText variant="caption" style={{ marginTop: space[3], color: colors.muted, lineHeight: 17 }}>
            Total mass to reach {goalBf}% body fat, holding your current lean mass ({formatWeight(leanKg, unit)}) constant. Set this in Goals.
          </FsText>
        </Card>
      )}

      <Card>
        <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Composition</FsText>
        <View style={styles.compBar}>
          <View style={{ flex: leanFlex, backgroundColor: colors.primary }} />
          <View style={{ flex: fatFlex, backgroundColor: colors.warning }} />
          {boneFlex > 0 && <View style={{ flex: boneFlex, backgroundColor: colors.muted }} />}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4], marginTop: space[3] }}>
          <Legend color={colors.primary} label="Lean" value={formatWeight(leanSoftKg ?? leanKg, unit)} />
          <Legend color={colors.warning} label="Fat" value={formatWeight(fatKg, unit)} />
          {boneKg != null && <Legend color={colors.muted} label="Bone" value={formatWeight(boneKg, unit)} />}
        </View>
        {bmi == null && (
          <FsText variant="caption" style={{ marginTop: space[3] }}>
            Add your height in Settings to compute BMI and FFMI.
          </FsText>
        )}
      </Card>

      {dexa ? (
        <DexaCard dexa={dexa} unit={unit} waistTrend={waistTrend} onUpdate={openDexa} />
      ) : (
        <Button title="Log DEXA scan" variant="ghost" onPress={openDexa} style={{ marginTop: space[3] }} />
      )}
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

function Metric({ label, value, tone, onPress }: { label: string; value: string; tone?: string; onPress?: () => void }) {
  if (onPress) {
    // Tappable CTA state (e.g. "Add height") — smaller, accent-colored text so it
    // reads as an action rather than a stat, and routes to where the data is set.
    return (
      <Pressable style={styles.metric} onPress={onPress}>
        <Card style={{ width: '100%' }}>
          <FsText variant="overline">{label}</FsText>
          <FsText variant="bodyMedium" style={{ marginTop: 4, color: colors.primary }}>{value}</FsText>
        </Card>
      </Pressable>
    );
  }
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

/** DEXA-anchored card: held-constant scan values + a direction-only visceral cue. */
function DexaCard({ dexa, unit, waistTrend, onUpdate }: {
  dexa: WeightEntry;
  unit: UnitSystem;
  waistTrend: { deltaCm: number } | null;
  onUpdate: () => void;
}) {
  const ageDays = Math.max(0, Math.round((Date.now() - new Date(`${dexa.date}T00:00:00`).getTime()) / 86_400_000));
  const ageLabel = ageDays === 0 ? 'today' : `${ageDays} day${ageDays === 1 ? '' : 's'} ago`;
  const wLabel = UNIT_LABELS[unit].weight;
  const lenLabel = UNIT_LABELS[unit].smallLength;
  const toLen = (cm: number) => (unit === 'IMPERIAL' ? cm / 2.54 : cm);
  const visceral = dexa.visceralFatKg != null ? `${toDisplay(dexa.visceralFatKg, unit).toFixed(2)} ${wLabel}` : null;

  // Direction-only visceral cue from the waist trend since the scan (magnitude isn't reliable).
  let dir: { color: string; text: string } | null = null;
  let DirIcon: typeof TrendingDown | null = null;
  if (visceral && waistTrend) {
    const mag = `${Math.abs(toLen(waistTrend.deltaCm)).toFixed(1)} ${lenLabel}`;
    if (waistTrend.deltaCm < -0.5) { dir = { color: colors.success, text: `waist −${mag} since — likely lower` }; DirIcon = TrendingDown; }
    else if (waistTrend.deltaCm > 0.5) { dir = { color: colors.danger, text: `waist +${mag} since — likely higher` }; DirIcon = TrendingUp; }
    else { dir = { color: colors.muted, text: 'waist ~steady since' }; DirIcon = Minus; }
  }

  return (
    <Card style={{ marginTop: space[3] }}>
      <View style={styles.rowBetween}>
        <FsText variant="cardTitle">DEXA scan</FsText>
        <FsText variant="caption">{shortDate(dexa.date)} · {ageLabel}</FsText>
      </View>
      <FsText variant="caption" style={{ marginTop: 2, marginBottom: space[3], color: colors.muted }}>
        Carried from your scan until the next one — bone mass &amp; density barely change.
      </FsText>
      <View style={styles.dexaGrid}>
        {dexa.boneMassKg != null && <Mini label="Bone mass" value={formatWeight(dexa.boneMassKg, unit)} />}
        {dexa.boneTScore != null && <Mini label="Bone density (T-score)" value={dexa.boneTScore.toFixed(1)} />}
        {visceral && <Mini label="Visceral fat" value={visceral} />}
      </View>
      {dir && DirIcon && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space[3] }}>
          <DirIcon color={dir.color} size={14} />
          <FsText variant="caption" style={{ color: dir.color, flex: 1 }}>
            Visceral fat: {dir.text}. Re-scan to confirm.
          </FsText>
        </View>
      )}
      <Button title="Log new DEXA scan" variant="ghost" onPress={onUpdate} style={{ marginTop: space[4] }} />
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <FsText variant="caption" style={{ fontSize: 11 }}>{label}</FsText>
      <FsText variant="bodyMedium" style={{ marginTop: 2 }}>{value}</FsText>
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
  dexaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], rowGap: space[3] },
  mini: { width: '47%', flexGrow: 1 },
  compBar: { flexDirection: 'row', height: 20, borderRadius: radius.full, overflow: 'hidden', gap: 2 },
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: space[2],
  },
}));
