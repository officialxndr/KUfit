import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Flag, Check } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { Dropdown } from '@/components/Dropdown';
import { StepperField } from '@/components/StepperField';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { PressableScale } from '@/components/anim/PressableScale';
import { useMotion } from '@/lib/useMotion';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { computeMilestones, type MilestoneDirection } from '@/lib/milestones';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { toDisplay, toKg, formatWeight, UNIT_LABELS } from '@/lib/units';
import { CHART, EASE } from '@/theme/motion';
import { colors, radius, space, tintBg, themedStyles } from '@/theme/tokens';
import type { UnitSystem } from '@/types';

const LB_PER_KG = 2.20462;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtVal = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/**
 * Milestone progress toward a weight goal: a filling bar from starting weight
 * (left) → goal (right) with milestone ticks, plus a projected-date ladder. The
 * start anchor (configurable), the 5/10 step, and the unit all come from the
 * profile; the projection rate reuses `computeStats().weeklyChange` so the dates
 * stay consistent with the existing "Goal ETA".
 *
 * `compact` (Dashboard): just the headline + bar + next milestone, tappable to
 * open the full card on the Weight tab. Full mode renders the controls + ladder.
 */
export function MilestoneProgressCard({ compact = false }: { compact?: boolean }) {
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const setSection = useNavStore((s) => s.setSection);
  const unit = profile.unitSystem;
  const label = UNIT_LABELS[unit].weight;
  const disp = (kg: number) => (unit === 'IMPERIAL' ? kg * LB_PER_KG : kg);

  // Effective goal honors an active phase override (mirrors resolveBaseTargets).
  const phase = healthRepo.getActiveGoalPhase();
  const goalType = phase?.goalType ?? profile.goalType;
  const goalKg = phase?.targetWeightKg ?? profile.goalWeightKg;

  const stats = healthRepo.computeStats(goalKg, phase?.endDate ?? profile.goalDate);
  const allEntries = healthRepo.getWeightEntries('1900-01-01', today());
  const currentKg = stats.current?.weightKg ?? allEntries[allEntries.length - 1]?.weightKg ?? null;

  // ── Guard states ──
  const noGoal = goalKg == null || goalType === 'MAINTAIN';
  const noData = currentKg == null || allEntries.length < 2;
  if (noGoal || noData) {
    if (compact) return null;
    return (
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.headRow}>
          <Flag color={colors.primary} size={16} />
          <FsText variant="cardTitle">Milestone Progress</FsText>
        </View>
        <FsText variant="caption" style={{ marginTop: space[2] }}>
          {noGoal
            ? 'Set a goal weight in Health → Goals to track milestones toward it.'
            : 'Log at least two weigh-ins to project your milestones.'}
        </FsText>
      </Card>
    );
  }

  const direction: MilestoneDirection = goalKg! <= currentKg! ? 'lose' : 'gain';

  // ── Starting-weight anchor ──
  const earliestKg = allEntries[0]?.weightKg ?? currentKg!;
  let startKg: number;
  switch (profile.milestoneStartBasis) {
    case 'custom':
      startKg = profile.milestoneStartKg ?? earliestKg;
      break;
    case 'earliest':
      startKg = earliestKg;
      break;
    case 'peak':
      startKg = allEntries.reduce(
        (acc, e) => (direction === 'lose' ? Math.max(acc, e.weightKg) : Math.min(acc, e.weightKg)),
        currentKg!
      );
      break;
    case 'phase':
    default: {
      const from = phase?.startDate;
      const atPhase = from ? allEntries.find((e) => e.date >= from)?.weightKg : null;
      startKg = atPhase ?? earliestKg;
      break;
    }
  }

  const stepDisp = profile.milestoneInterval === 'small'
    ? (unit === 'IMPERIAL' ? 5 : 2.5)
    : (unit === 'IMPERIAL' ? 10 : 5);
  const rateDisp = stats.weeklyChange != null ? disp(stats.weeklyChange) : null;

  const result = computeMilestones({
    start: disp(startKg),
    current: disp(currentKg!),
    goal: disp(goalKg!),
    weeklyRate: rateDisp,
    step: stepDisp,
  });

  const pct = Math.round(result.progress * 100);
  const remaining = Math.abs(disp(currentKg!) - disp(goalKg!));

  // Actual date a reached milestone was first crossed (for the ladder's past rows).
  const achievedDate = (value: number): Date | null => {
    const targetKg = toKg(value, unit);
    const hit = allEntries.find((e) => (direction === 'lose' ? e.weightKg <= targetKg : e.weightKg >= targetKg));
    return hit ? new Date(`${hit.date}T00:00:00`) : null;
  };

  // ── Compact (Dashboard) ──
  if (compact) {
    const next = result.markers.find((m) => !m.reached);
    return (
      <PressableScale onPress={() => setSection('health', 'weight')}>
        <Card style={{ marginBottom: space[3] }}>
          <View style={styles.headRow}>
            <Flag color={colors.primary} size={16} />
            <FsText variant="cardTitle">Milestone Progress</FsText>
            <FsText variant="caption" style={{ marginLeft: 'auto' }}>{pct}%</FsText>
          </View>
          <ProgressBar progress={result.progress} />
          <View style={styles.endLabels}>
            <FsText variant="caption">{formatWeight(startKg, unit)}</FsText>
            <FsText variant="caption">{formatWeight(goalKg!, unit)}</FsText>
          </View>
          {result.reachedGoal ? (
            <FsText variant="caption" style={{ marginTop: space[2], color: colors.success }}>Goal reached 🎉</FsText>
          ) : next ? (
            <FsText variant="caption" style={{ marginTop: space[2] }}>
              Next: {fmtVal(next.value)} {label}
              {next.etaDate ? ` by ${fmtDate(next.etaDate)}` : ''}
            </FsText>
          ) : null}
        </Card>
      </PressableScale>
    );
  }

  // ── Full (Weight tab) ──
  const basisItems = [
    { key: 'phase', label: 'Goal phase start' },
    { key: 'earliest', label: 'Earliest log' },
    { key: 'peak', label: direction === 'lose' ? 'Highest weight' : 'Lowest weight' },
    { key: 'custom', label: 'Custom…' },
  ];
  const basisLabel = basisItems.find((i) => i.key === profile.milestoneStartBasis)?.label ?? 'Start';

  const onBasis = (key: string) => {
    // Seed the custom value with the current anchor so the stepper starts sensibly.
    if (key === 'custom' && profile.milestoneStartKg == null) {
      setProfile({ milestoneStartBasis: 'custom', milestoneStartKg: startKg });
    } else {
      setProfile({ milestoneStartBasis: key as typeof profile.milestoneStartBasis });
    }
  };

  return (
    <Card style={{ marginBottom: space[3] }}>
      <View style={styles.headRow}>
        <Flag color={colors.primary} size={16} />
        <FsText variant="cardTitle">Milestone Progress</FsText>
        <View style={{ marginLeft: 'auto' }}>
          <Dropdown
            label={basisLabel}
            items={basisItems}
            selectedKey={profile.milestoneStartBasis}
            onSelect={onBasis}
            active={profile.milestoneStartBasis !== 'phase'}
            width={190}
          />
        </View>
      </View>

      {profile.milestoneStartBasis === 'custom' && (
        <View style={styles.customRow}>
          <FsText variant="caption">Starting weight</FsText>
          <StepperField
            value={toDisplay(startKg, unit)}
            onCommit={(n) => setProfile({ milestoneStartKg: toKg(n, unit) })}
            step={1}
            min={50}
            max={600}
            unit={label}
          />
        </View>
      )}

      {/* Headline */}
      <View style={styles.headline}>
        <AnimatedNumber value={result.progress * 100} format={(n) => `${Math.round(n)}%`} variant="display" />
        <FsText variant="caption" style={{ marginBottom: 4 }}>
          {result.reachedGoal ? 'goal reached 🎉' : `${fmtVal(Math.round(remaining * 10) / 10)} ${label} to goal`}
        </FsText>
      </View>

      {/* Bar + milestone timeline below it */}
      <ProgressBar progress={result.progress} />
      <MarkerRail
        items={[
          { value: toDisplay(startKg, unit), fraction: 0, tone: 'start' },
          ...result.markers.map((m) => ({
            value: m.value,
            fraction: m.fraction,
            tone: m.isGoal ? ('goal' as const) : m.reached ? ('reached' as const) : ('upcoming' as const),
          })),
        ]}
      />

      {rateDisp != null && Math.abs(rateDisp) >= 0.05 && (
        <FsText variant="caption" style={{ marginTop: space[2] }}>
          {rateDisp < 0 ? 'Losing' : 'Gaining'} ~{fmtVal(Math.round(Math.abs(rateDisp) * 10) / 10)} {label}/wk
        </FsText>
      )}

      {/* Step toggle */}
      <View style={styles.toggle}>
        {(['small', 'large'] as const).map((opt) => {
          const active = profile.milestoneInterval === opt;
          const v = opt === 'small' ? (unit === 'IMPERIAL' ? 5 : 2.5) : (unit === 'IMPERIAL' ? 10 : 5);
          return (
            <Pressable
              key={opt}
              style={[styles.toggleBtn, active && styles.toggleActive]}
              onPress={() => setProfile({ milestoneInterval: opt })}
            >
              <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>
                {v} {label}
              </FsText>
            </Pressable>
          );
        })}
      </View>

      {/* Projection ladder */}
      <View style={{ marginTop: space[3] }}>
        {result.markers.map((m, i) => {
          const reachedAt = m.reached && !m.isGoal ? achievedDate(m.value) : null;
          const right = m.reached
            ? (m.isGoal ? 'Reached 🎉' : reachedAt ? fmtDate(reachedAt) : 'Reached')
            : m.etaDate
              ? `${fmtDate(m.etaDate)}${m.weeksAway != null ? ` · ~${Math.max(1, Math.round(m.weeksAway))} wk` : ''}`
              : '—';
          return (
            <View key={`${m.value}-${i}`} style={[styles.row, m.isGoal && styles.goalRow]}>
              <View style={styles.rowLeft}>
                {m.reached
                  ? <Check color={colors.success} size={14} />
                  : <View style={[styles.dot, m.isGoal && { backgroundColor: colors.primary }]} />}
                <FsText variant="bodyMedium" style={m.isGoal ? { color: colors.primary, fontWeight: '700' } : undefined}>
                  {fmtVal(m.value)} {label}{m.isGoal ? ' · goal' : ''}
                </FsText>
              </View>
              <FsText
                variant="caption"
                style={m.isGoal ? { color: colors.primary } : m.reached ? { color: colors.success } : undefined}
              >
                {right}
              </FsText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Clean filling bar (start → goal). Reuses the MacroBar animation pattern. */
function ProgressBar({ progress }: { progress: number }) {
  const { animate } = useMotion();
  const p = useSharedValue(animate ? 0 : progress);
  useEffect(() => {
    p.value = animate ? withTiming(progress, { duration: CHART.bar, easing: EASE.outStrong }) : progress;
  }, [progress, animate, p]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  return (
    <View style={styles.barRow}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

type RailTone = 'start' | 'reached' | 'upcoming' | 'goal';

/** Milestone timeline below the bar: a tick + weight label at each fraction. */
function MarkerRail({ items }: { items: { value: number; fraction: number; tone: RailTone }[] }) {
  return (
    <View style={styles.rail}>
      {items.map((m, i) => {
        const color = m.tone === 'goal' ? colors.primary : m.tone === 'reached' ? colors.success : colors.muted;
        // Clamp the end markers to the edges so their labels don't clip off the card.
        const pos = m.fraction <= 0.001
          ? { left: 0, alignItems: 'flex-start' as const }
          : m.fraction >= 0.999
            ? { right: 0, alignItems: 'flex-end' as const }
            : { left: `${m.fraction * 100}%` as const, width: 44, marginLeft: -22, alignItems: 'center' as const };
        return (
          <View key={`${m.value}-${i}`} style={[styles.railItem, pos]}>
            <View style={[styles.railTick, { backgroundColor: color }]} />
            <FsText variant="caption" numberOfLines={1} style={[styles.railLabel, { color }]}>{fmtVal(m.value)}</FsText>
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headline: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2], marginTop: space[3] },
  customRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space[3], gap: space[2],
  },
  barRow: { height: 14, justifyContent: 'center', marginTop: space[3] },
  track: { height: 12, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rail: { position: 'relative', height: 28, marginTop: 5 },
  railItem: { position: 'absolute', top: 0 },
  railTick: { width: 2, height: 6, borderRadius: 1 },
  railLabel: { fontSize: 10, lineHeight: 13, marginTop: 2, fontVariant: ['tabular-nums'], textAlign: 'center' },
  toggle: { flexDirection: 'row', gap: space[1], marginTop: space[3] },
  toggleBtn: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  toggleActive: { backgroundColor: colors.primary },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  goalRow: { borderBottomWidth: 0, backgroundColor: tintBg.primary, borderRadius: radius.sm, paddingHorizontal: space[2], marginTop: 4 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.muted },
}));
