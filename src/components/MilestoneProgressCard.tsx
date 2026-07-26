import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Flag, Check, Plus } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { Dropdown } from '@/components/Dropdown';
import { StepperField } from '@/components/StepperField';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';
import { PressableScale } from '@/components/anim/PressableScale';
import { useMotion } from '@/lib/useMotion';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { computeMilestones, projectDateFor, projectWeightAtDate, weightAtFraction, type MilestoneDirection } from '@/lib/milestones';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { toDisplay, toKg, formatWeight, UNIT_LABELS } from '@/lib/units';
import { CHART, EASE } from '@/theme/motion';
import { colors, radius, space, tintBg, themedStyles } from '@/theme/tokens';
import type { UnitSystem } from '@/types';
import { todayLocal } from '@/lib/date';

const LB_PER_KG = 2.20462;
const today = todayLocal;
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
  const router = useRouter();
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
  // "By goal date" mode: the signed weekly rate needed to reach the goal by its goal date, in the
  // same convention as weeklyChange (negative = losing). `requiredWeeklyRate` is signed (current − goal),
  // so negate it. Only available when a goal date + a still-reachable timeline exist.
  const requiredRateDisp = stats.requiredWeeklyRate != null ? disp(-stats.requiredWeeklyRate) : null;
  const mode = profile.milestoneRateMode ?? 'current';
  const byGoalDate = mode === 'goaldate' && requiredRateDisp != null;
  // Projection rate: current pace, or the pace required to hit the goal date. Every milestone's
  // date then falls out of `computeMilestones`/`etaFor` — reached rows still show their actual date.
  const activeRate = byGoalDate ? requiredRateDisp : rateDisp;

  const startD = disp(startKg);
  const goalD = disp(goalKg!);
  const currentD = disp(currentKg!);
  const result = computeMilestones({
    start: startD,
    current: currentD,
    goal: goalD,
    weeklyRate: activeRate,
    step: stepDisp,
  });

  const pct = Math.round(result.progress * 100);
  const remaining = Math.abs(disp(currentKg!) - disp(goalKg!));

  // Actual date a reached milestone was first crossed (for the ladder's past rows).
  // Use the *journey* direction (start→goal, from computeMilestones) — the top-level
  // `direction` is current→goal and flips wrong once the goal is overshot.
  const achievedDate = (value: number): Date | null => {
    const targetKg = toKg(value, unit);
    const hit = allEntries.find((e) => (result.direction === 'lose' ? e.weightKg <= targetKg : e.weightKg >= targetKg));
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

  // ── Custom milestones: a target weight → projected date, or a target date/event →
  // projected weight (placed on the weight bar at where you're trending to be by then). ──
  const clampFrac = (n: number) => Math.min(Math.max(n, 0), 1);
  const spanD = startD - goalD;
  const posOf = (wDisp: number) => (spanD === 0 ? 1 : clampFrac((startD - wDisp) / spanD));
  const showW = (wDisp: number) => `${fmtVal(Math.round(wDisp * 10) / 10)} ${label}`;
  const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const todayStr = today();
  const customs = (profile.customMilestones ?? []).map((c) => {
    if (c.kind === 'weight') {
      const wDisp = disp(c.weightKg);
      // Journey direction (start→goal), so an already-crossed weight still reads as reached
      // even after the goal is overshot (the top-level `direction` is current→goal).
      const reached = result.direction === 'lose' ? currentKg! <= c.weightKg : currentKg! >= c.weightKg;
      const eta = reached ? achievedDate(wDisp) : projectDateFor(wDisp, currentD, activeRate).etaDate;
      return {
        id: c.id,
        railValue: Math.round(wDisp * 10) / 10 as number | null,
        fraction: posOf(wDisp) as number | null,
        reached,
        primary: c.label ? `${c.label} · ${showW(wDisp)}` : showW(wDisp),
        secondary: reached ? (eta ? `Reached ${shortDate(eta)}` : 'Reached') : eta ? fmtDate(eta) : 'No trend yet',
      };
    }
    // Date/event milestone → projected weight on that day. "Today" is inclusive (projects
    // the current weight), so a same-day event isn't mislabeled "Past date" for its own day.
    const d = new Date(`${c.date}T00:00:00`);
    const past = c.date < todayStr;
    const projected = past ? null : c.date === todayStr ? currentD : projectWeightAtDate(d, currentD, activeRate);
    return {
      id: c.id,
      railValue: projected != null ? Math.round(projected * 10) / 10 : null,
      fraction: projected != null ? posOf(projected) : null,
      reached: false,
      primary: c.label ? `${c.label} · ${shortDate(d)}` : fmtDate(d),
      secondary: past ? 'Past date' : projected != null ? `~${showW(projected)}` : 'No trend yet',
    };
  });

  const customRail = customs
    .filter((c) => c.fraction != null && c.railValue != null)
    .map((c) => ({ value: c.railValue!, fraction: c.fraction!, tone: 'custom' as const }));

  const goalMarker = result.markers.find((m) => m.isGoal);
  const railItems: { value: number; fraction: number; tone: RailTone }[] = [
    { value: toDisplay(startKg, unit), fraction: 0, tone: 'start' },
    ...[
      ...result.markers.filter((m) => !m.isGoal).map((m) => ({
        value: m.value,
        fraction: m.fraction,
        tone: (m.reached ? 'reached' : 'upcoming') as RailTone,
      })),
      ...customRail,
    ].sort((a, b) => a.fraction - b.fraction),
    ...(goalMarker ? [{ value: goalMarker.value, fraction: 1, tone: 'goal' as RailTone }] : []),
  ];

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

      {/* Bar + milestone timeline below it. Drag anywhere on the bar to scrub a
          projected weight + date at that point along the journey. */}
      <ProgressBar
        progress={result.progress}
        scrub={{ start: startD, goal: goalD, current: currentD, rate: activeRate, unitLabel: label }}
      />
      <MarkerRail items={railItems} />

      {activeRate != null && Math.abs(activeRate) >= 0.05 && (
        <FsText variant="caption" style={{ marginTop: space[2] }}>
          {byGoalDate
            ? `${activeRate < 0 ? 'Lose' : 'Gain'} ~${fmtVal(Math.round(Math.abs(activeRate) * 10) / 10)} ${label}/wk to hit ${stats.goalTargetDate}`
            : `${activeRate < 0 ? 'Losing' : 'Gaining'} ~${fmtVal(Math.round(Math.abs(activeRate) * 10) / 10)} ${label}/wk · current pace`}
        </FsText>
      )}

      {/* Timeline basis: current pace vs. the pace required to hit the goal date. Only offered
          when a goal date + reachable timeline exist (else the ladder stays on current-rate ETAs). */}
      {requiredRateDisp != null && (
        <View style={styles.toggle}>
          {([['current', 'Current rate'], ['goaldate', 'By goal date']] as const).map(([key, lbl]) => {
            const active = mode === key;
            return (
              <Pressable
                key={key}
                style={[styles.toggleBtn, active && styles.toggleActive]}
                onPress={() => setProfile({ milestoneRateMode: key })}
              >
                <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>
                  {lbl}
                </FsText>
              </Pressable>
            );
          })}
        </View>
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

      {/* Custom milestones — user-set target weights + dates/events */}
      <View style={{ marginTop: space[4] }}>
        <View style={styles.headRow}>
          <FsText variant="cardTitle" style={{ fontSize: 15 }}>Your milestones</FsText>
          <Pressable
            onPress={() => router.push('/custom-milestone')}
            hitSlop={8}
            style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Plus color={colors.primary} size={16} />
            <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Add</FsText>
          </Pressable>
        </View>
        {customs.length === 0 ? (
          <FsText variant="caption" style={{ color: colors.muted, marginTop: space[2] }}>
            Add a target weight to see when you’ll reach it — or a date/event (like Thanksgiving) to see the weight you’re on track for.
          </FsText>
        ) : (
          customs.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/custom-milestone?id=${c.id}`)} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.dot, { backgroundColor: colors.warning, borderColor: colors.warning }]} />
                <FsText variant="bodyMedium">{c.primary}</FsText>
              </View>
              <FsText variant="caption" style={{ color: c.reached ? colors.success : colors.muted }}>{c.secondary}</FsText>
            </Pressable>
          ))
        )}
      </View>
    </Card>
  );
}

interface ScrubConfig {
  /** Display-unit start weight (bar left) and goal (bar right). */
  start: number;
  goal: number;
  /** Display-unit current weight + signed weekly rate (null ⇒ no date projection). */
  current: number;
  rate: number | null;
  unitLabel: string;
}

/** Clean filling bar (start → goal). Reuses the MacroBar animation pattern. When
 *  `scrub` is set the bar is draggable: dragging shows a live tooltip of the projected
 *  weight + date at that point along the journey, and snaps back on release. The fill
 *  itself stays at actual progress — the scrub is an exploratory overlay. */
function ProgressBar({ progress, scrub }: { progress: number; scrub?: ScrubConfig }) {
  const { animate } = useMotion();
  const p = useSharedValue(animate ? 0 : progress);
  useEffect(() => {
    p.value = animate ? withTiming(progress, { duration: CHART.bar, easing: EASE.outStrong }) : progress;
  }, [progress, animate, p]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  // Scrub state: track pixel width (for touchX→fraction) + the live drag fraction
  // (-1 = idle/hidden). Position stays on the UI thread; only the label text hops to JS.
  const width = useSharedValue(0);
  const frac = useSharedValue(-1);
  const [tip, setTip] = useState<{ w: string; sub: string } | null>(null);

  const updateTip = (f: number) => {
    if (!scrub) return;
    const wDisp = weightAtFraction(scrub.start, scrub.goal, f);
    const dir = scrub.goal <= scrub.start ? 'lose' : 'gain';
    const reached = dir === 'lose' ? scrub.current <= wDisp : scrub.current >= wDisp;
    const eta = projectDateFor(wDisp, scrub.current, scrub.rate).etaDate;
    const sub = reached ? 'already there' : eta ? fmtDate(eta) : 'no trend yet';
    setTip({ w: `${fmtVal(Math.round(wDisp * 10) / 10)} ${scrub.unitLabel}`, sub });
  };
  const clearTip = () => setTip(null);

  // activeOffsetX/failOffsetY let the horizontal scrub win over the vertical ScrollView
  // only on horizontal intent (and yield to scroll on vertical) — no long-press needed.
  const pan = Gesture.Pan()
    .enabled(!!scrub)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .shouldCancelWhenOutside(false)
    .hitSlop({ top: 20, bottom: 20 })
    .onStart((e) => {
      const f = width.value > 0 ? Math.min(Math.max(e.x / width.value, 0), 1) : 0;
      frac.value = f;
      runOnJS(updateTip)(f);
    })
    .onUpdate((e) => {
      const f = width.value > 0 ? Math.min(Math.max(e.x / width.value, 0), 1) : 0;
      frac.value = f;
      runOnJS(updateTip)(f);
    })
    .onFinalize(() => {
      frac.value = -1;
      runOnJS(clearTip)();
    });

  const handleStyle = useAnimatedStyle(() => ({
    opacity: frac.value < 0 ? 0 : 1,
    transform: [{ translateX: (frac.value < 0 ? 0 : frac.value * width.value) - 1 }],
  }));
  const TIP_HALF = 55;
  const tipStyle = useAnimatedStyle(() => {
    const x = frac.value < 0 ? 0 : frac.value * width.value;
    const cx = Math.min(Math.max(x, TIP_HALF), Math.max(width.value - TIP_HALF, TIP_HALF));
    return { opacity: frac.value < 0 ? 0 : 1, transform: [{ translateX: cx - TIP_HALF }] };
  });

  const track = (
    <View style={styles.track} onLayout={scrub ? (e) => { width.value = e.nativeEvent.layout.width; } : undefined}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );

  return (
    <View style={styles.barRow}>
      {scrub ? <GestureDetector gesture={pan}>{track}</GestureDetector> : track}
      {scrub && (
        <>
          <Animated.View pointerEvents="none" style={[styles.scrubHandle, handleStyle]} />
          <Animated.View pointerEvents="none" style={[styles.scrubTip, tipStyle]}>
            {tip && (
              <View style={styles.scrubTipBubble}>
                <FsText variant="caption" style={{ color: colors.text, fontWeight: '700' }}>{tip.w}</FsText>
                <FsText variant="caption" style={{ color: colors.muted, fontSize: 10, lineHeight: 13 }}>{tip.sub}</FsText>
              </View>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

type RailTone = 'start' | 'reached' | 'upcoming' | 'goal' | 'custom';

/**
 * Milestone timeline below the bar: a tick at every fraction, with labels added
 * only where they fit. Ticks are cheap and never collide, but the labels would
 * overlap when milestones are packed close together — so we always label the two
 * ends (start + goal) and then greedily fill in inner labels left→right, skipping
 * any that would touch the previous label or the goal label. The full value list
 * still lives in the projection ladder below, so dropping a crowded inner label
 * loses nothing.
 */
function MarkerRail({ items }: { items: { value: number; fraction: number; tone: RailTone }[] }) {
  const [width, setWidth] = useState(0);

  // Which labels to render. Always the two ends (start + goal); then inner labels
  // greedily left→right, skipping any that would touch a neighbor. Each centered
  // label's footprint is approximated from its digit count (tabular-nums @ fontSize
  // 10 ≈ 7px/char). Cheap O(n) over a handful of markers, so just compute per render.
  const showLabel = items.map(() => false);
  if (items.length > 0) {
    const last = items.length - 1;
    showLabel[0] = true;     // start — anchored left:0
    showLabel[last] = true;  // goal — anchored right:0
    if (width > 0 && last > 0) {
      const CHAR = 7, PAD = 4, GAP = 8;
      const labelW = (v: number) => fmtVal(v).length * CHAR + PAD;
      const goalLeft = width - labelW(items[last].value); // goal label hugs the right edge
      let cursorRight = labelW(items[0].value);           // start label hugs the left edge
      for (let i = 1; i < last; i++) {
        const w = labelW(items[i].value);
        const center = items[i].fraction * width;         // inner labels center on their tick
        if (center - w / 2 >= cursorRight + GAP && center + w / 2 <= goalLeft - GAP) {
          showLabel[i] = true;
          cursorRight = center + w / 2;
        }
      }
    }
  }

  return (
    <View style={styles.rail} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map((m, i) => {
        const color = m.tone === 'goal' ? colors.primary : m.tone === 'reached' ? colors.success : m.tone === 'custom' ? colors.warning : colors.muted;
        // Clamp the end markers to the edges so their labels don't clip off the card.
        const pos = m.fraction <= 0.001
          ? { left: 0, alignItems: 'flex-start' as const }
          : m.fraction >= 0.999
            ? { right: 0, alignItems: 'flex-end' as const }
            : { left: `${m.fraction * 100}%` as const, width: 44, marginLeft: -22, alignItems: 'center' as const };
        return (
          <View key={`${m.value}-${i}`} style={[styles.railItem, pos]}>
            <View style={[styles.railTick, { backgroundColor: color }]} />
            {showLabel[i] && (
              <FsText variant="caption" numberOfLines={1} style={[styles.railLabel, { color }]}>{fmtVal(m.value)}</FsText>
            )}
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
  scrubHandle: { position: 'absolute', left: 0, top: -4, width: 2, height: 20, borderRadius: 1, backgroundColor: colors.primary },
  scrubTip: { position: 'absolute', left: 0, bottom: 22, width: 110, alignItems: 'center' },
  scrubTipBubble: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
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
