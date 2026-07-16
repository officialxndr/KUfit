import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, PanResponder } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { TrendingDown, TrendingUp, Maximize2, Minimize2, ImageIcon } from 'lucide-react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';

import { Card, FsText, Button, SectionHeader, Badge } from '@/components/ui';
import { MilestoneProgressCard } from '@/components/MilestoneProgressCard';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { ActivitySuggestions } from '@/components/ActivitySuggestions';
import { GoalWarning } from '@/components/GoalWarning';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { deleteProgressPhoto } from '@/lib/progressPhoto';
import { goalSafetyWarning, describePace, goalDateStat } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePullRefresh } from '@/stores/refreshStore';
import { toDisplay, formatWeight, UNIT_LABELS } from '@/lib/units';
import { computeWeightTrend, type TrendPoint } from '@/lib/weightTrend';
import { shortDate, parseLocalDay, todayLocal } from '@/lib/date';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { HealthStats, WeightEntry } from '@/types';

const DAY_MS = 86_400_000;
const PERIODS: { key: string; label: string; days: number }[] = [
  { key: '7', label: '1W', days: 7 },
  { key: '30', label: '1M', days: 30 },
  { key: '90', label: '3M', days: 90 },
  { key: '180', label: '6M', days: 180 },
  { key: '365', label: '1Y', days: 365 },
];

export function HealthWeight() {
  const router = useRouter();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const unit = profile.unitSystem;

  const [stats, setStats] = useState<HealthStats | null>(null);
  // Full weigh-in history for the chart — `stats.entries` is capped at 90 days, which isn't enough for
  // the 6M/1Y ranges or to seed the trend's momentum at a window's left edge.
  const [allEntries, setAllEntries] = useState<WeightEntry[]>([]);
  const [period, setPeriod] = useState('30');

  const refresh = useCallback(() => {
    // Phase endDate overrides the profile goal date when a goal phase is active.
    const effectiveGoalDate = healthRepo.getActiveGoalPhase()?.endDate ?? profile.goalDate;
    setStats(healthRepo.computeStats(profile.goalWeightKg, effectiveGoalDate));
    setAllEntries(healthRepo.getWeightEntries('2000-01-01', todayLocal()));
  }, [profile.goalWeightKg, profile.goalDate]);

  const toggleGoalDateMode = () =>
    setProfile({ goalDateMode: profile.goalDateMode === 'target' ? 'projection' : 'target' });

  useFocusEffect(refresh);
  usePullRefresh(refresh);

  const remove = (e: WeightEntry) => {
    deleteProgressPhoto(e.photoUri); // reclaim the attached photo file (swipe-delete path)
    healthRepo.deleteWeightEntry(e.id);
    refresh();
  };

  const entries = stats?.entries ?? [];
  const recent = [...entries].reverse().slice(0, 14);
  const days = PERIODS.find((p) => p.key === period)!.days;
  const cutoff = Date.now() - days * DAY_MS;
  // Trend line (EWMA) over the full history, then sliced to the visible window so the trend keeps its
  // momentum at the window's left edge.
  const windowed = computeWeightTrend(allEntries).filter((p) => parseLocalDay(p.date).getTime() >= cutoff);

  const weeklyChange = stats?.weeklyChange ?? null;
  const ChangeIcon = (weeklyChange ?? 0) < 0 ? TrendingDown : TrendingUp;
  const changeColor = weeklyChange == null ? colors.muted : weeklyChange < 0 ? colors.success : weeklyChange > 0 ? colors.danger : colors.muted;

  // Always-on safety caution (independent of coaching nudges).
  const safetyWarning = goalSafetyWarning(profile, stats?.current?.weightKg ?? null);

  return (
    <>
      {/* Current weight */}
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.rowBetween}>
          <View>
            <FsText variant="caption">Current Weight</FsText>
            <FsText variant="display" style={{ marginTop: 2 }}>
              {stats?.current ? formatWeight(stats.current.weightKg, unit) : '—'}
            </FsText>
          </View>
          {weeklyChange != null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Badge
                label={`${weeklyChange < 0 ? '−' : weeklyChange > 0 ? '+' : ''}${formatWeight(Math.abs(weeklyChange), unit)}/wk`}
                tone={weeklyChange < 0 ? 'success' : weeklyChange > 0 ? 'danger' : 'primary'}
              />
            </View>
          )}
        </View>
      </Card>

      {/* Trend chart */}
      <Card style={{ marginBottom: space[3] }}>
        <View style={styles.rowBetween}>
          <FsText variant="cardTitle">Weight Trend</FsText>
          <ChangeIcon color={changeColor} size={16} />
        </View>
        <WeightChart points={windowed} goalKg={profile.goalWeightKg} unit={unit} />
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
      </Card>

      {/* Milestone progress toward goal */}
      <MilestoneProgressCard />

      {/* Log weight → popup */}
      <Button title="＋ Log Weight" onPress={() => router.push('/log-weight')} style={{ marginBottom: space[3] }} />

      <GoalWarning message={safetyWarning} />

      {/* Trend stats */}
      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Trend" />
        <View style={styles.statGrid}>
          <Stat label="Current" value={stats?.current ? formatWeight(stats.current.weightKg, unit) : '—'} />
          <Stat label="7-day avg" value={stats?.avg7 != null ? formatWeight(stats.avg7, unit) : '—'} />
          <Stat
            label="Weekly change"
            value={stats?.weeklyChange != null ? `${stats.weeklyChange > 0 ? '+' : ''}${toDisplay(stats.weeklyChange, unit)} ${UNIT_LABELS[unit].weight}` : '—'}
            tone={changeColor}
          />
          {(() => {
            const gd = goalDateStat(stats, profile.goalDateMode);
            return <Stat label={gd.label} value={gd.value} onPress={gd.canToggle ? toggleGoalDateMode : undefined} />;
          })()}
        </View>
        {stats?.dailyCalorieDelta != null && !stats.onTrack && profile.showCoachingNudges && (() => {
          const pace = describePace(stats.dailyCalorieDelta, (stats.requiredWeeklyRate ?? 0) >= 0 ? 'lose' : 'gain');
          return (
            <View style={{ marginTop: space[3] }}>
              <FsText variant="caption" style={{ color: colors.warning }}>{pace.title} — {pace.message}</FsText>
            </View>
          );
        })()}
      </Card>

      {/* How to hit it — MET-based activity suggestions when behind pace */}
      {stats?.dailyCalorieDelta != null && !stats.onTrack && stats.dailyCalorieDelta > 0 && stats.current && profile.showCoachingNudges && (
        <View style={{ marginBottom: space[3] }}>
          <ActivitySuggestions calories={stats.dailyCalorieDelta} weightKg={stats.current.weightKg} />
        </View>
      )}

      {/* Recent entries — tap to edit weight / body fat, swipe to delete */}
      <SectionHeader title="Recent entries" />
      {recent.length === 0 ? (
        <Card><FsText variant="caption">No entries yet.</FsText></Card>
      ) : (
        recent.map((e) => (
          <SwipeToDelete key={e.id} onDelete={() => remove(e)} confirmTitle="Delete entry?" confirmMessage={`Remove the ${e.date} weigh-in?`}>
            <Pressable onPress={() => router.push({ pathname: '/log-weight', params: { date: e.date } })}>
              <Card style={{ marginBottom: space[2], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <FsText variant="bodyMedium">{formatWeight(e.weightKg, unit)}</FsText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  {e.photoUri ? <ImageIcon color={colors.muted} size={14} /> : null}
                  <FsText variant="caption">{e.date}{e.bodyFat ? ` · ${e.bodyFat}% BF` : ''}</FsText>
                </View>
              </Card>
            </Pressable>
          </SwipeToDelete>
        ))
      )}
    </>
  );
}


/** Catmull-Rom → cubic-bézier smoothing so the weight lines read as smooth curves (like the reference). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function WeightChart({ points, goalKg, unit }: { points: TrendPoint[]; goalKg: number | null; unit: import('@/types').UnitSystem }) {
  const W = 320, H = 140;
  const [sel, setSel] = useState<number | null>(null);
  // false = fit the y-range to the data (zoomed-in trend); true = expand to include the goal line.
  const [showGoal, setShowGoal] = useState(false);
  const widthRef = useRef(0);
  const nRef = useRef(points.length);
  nRef.current = points.length;

  // Drag across the chart to inspect the nearest weigh-in. The *capture* handlers
  // claim the touch before the parent ScrollView so scrubbing never scrolls the page.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
      onPanResponderRelease: () => setSel(null),
      onPanResponderTerminate: () => setSel(null),
    })
  ).current;
  const pick = (px: number) => {
    const n = nRef.current, w = widthRef.current;
    if (n < 2 || w <= 0) return;
    setSel(Math.max(0, Math.min(n - 1, Math.round((px / w) * (n - 1)))));
  };

  if (points.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <FsText variant="caption">Log at least two weigh-ins to see a trend.</FsText>
      </View>
    );
  }
  const vals = points.map((p) => toDisplay(p.weightKg, unit));       // raw scale weight
  const trendVals = points.map((p) => toDisplay(p.trendKg, unit));   // EWMA trend
  const goal = goalKg != null ? toDisplay(goalKg, unit) : null;
  const dataLo = Math.min(...vals, ...trendVals), dataHi = Math.max(...vals, ...trendVals);
  // The goal only affects the range when the user has asked to keep it in view.
  const includeGoal = showGoal && goal != null;
  const lo = Math.min(dataLo, includeGoal ? goal! : Infinity);
  const hi = Math.max(dataHi, includeGoal ? goal! : -Infinity);
  // Offer the toggle only when the goal actually sits outside the data's own range.
  const goalOutside = goal != null && (goal < dataLo || goal > dataHi);
  const pad = (hi - lo) * 0.12 || 2;
  const min = lo - pad, max = hi + pad;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const scalePath = smoothPath(vals.map((v, i) => ({ x: x(i), y: y(v) })));
  const trendPath = smoothPath(trendVals.map((v, i) => ({ x: x(i), y: y(v) })));
  const showMarkers = points.length <= 16; // hollow dots on short ranges (like the reference); clean line on long ones
  const mid = (lo + hi) / 2;
  const yTicks = [hi, mid, lo];
  const fmtTick = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
  const Y_AXIS_W = 34;

  return (
    <View style={{ marginVertical: space[2] }}>
      <View style={{ height: 22, justifyContent: 'center' }}>
        {sel != null && (
          <FsText variant="caption" style={{ color: colors.text, fontWeight: '600', textAlign: 'center' }}>
            {formatWeight(points[sel].weightKg, unit)} · trend {formatWeight(points[sel].trendKg, unit)} · {shortDate(points[sel].date)}
          </FsText>
        )}
        {goalOutside && (
          <Pressable onPress={() => setShowGoal((v) => !v)} hitSlop={6} style={styles.zoomBtn}>
            {showGoal
              ? <Minimize2 color={colors.primary} size={13} />
              : <Maximize2 color={colors.primary} size={13} />}
            <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
              {showGoal ? 'Fit data' : 'Show goal'}
            </FsText>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: Y_AXIS_W, height: H }}>
          {yTicks.map((v) => (
            <FsText key={v} variant="caption" style={{ position: 'absolute', right: 4, top: y(v) - 7, fontSize: 10 }}>
              {fmtTick(v)}
            </FsText>
          ))}
        </View>
        <View style={{ flex: 1 }} onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }} {...pan.panHandlers}>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
            {/* horizontal gridlines */}
            {yTicks.map((v) => (
              <Line key={v} x1={0} y1={y(v)} x2={W} y2={y(v)} stroke={colors.border} strokeWidth={1} opacity={0.5} />
            ))}
            {goal != null && goal >= min && goal <= max && (
              <Line x1={0} y1={y(goal)} x2={W} y2={y(goal)} stroke={colors.primary} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
            )}
            {/* Raw scale weight — secondary (lighter + thinner), the noisy day-to-day line. */}
            <Path d={scalePath} fill="none" stroke={colors.primary} strokeOpacity={0.4} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
            {/* Trend (EWMA) — the hero line; hollow markers on short ranges. */}
            <Path d={trendPath} fill="none" stroke={colors.primary} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" />
            {showMarkers && trendVals.map((v, i) => (
              <Circle key={i} cx={x(i)} cy={y(v)} r={2.8} fill={colors.surface} stroke={colors.primary} strokeWidth={1.6} />
            ))}
            {sel != null && (
              <>
                <Line x1={x(sel)} y1={0} x2={x(sel)} y2={H} stroke={colors.muted} strokeWidth={1} strokeDasharray="3 3" />
                <Circle cx={x(sel)} cy={y(vals[sel])} r={3} fill={colors.primary} opacity={0.5} />
                <Circle cx={x(sel)} cy={y(trendVals[sel])} r={4.5} fill={colors.primary} />
              </>
            )}
            {goal != null && (
              <SvgText x={4} y={y(goal) - 4} fill={colors.muted} fontSize={9}>goal {fmtTick(goal)}</SvgText>
            )}
          </Svg>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingLeft: Y_AXIS_W }}>
        <FsText variant="caption">{shortDate(points[0].date)}</FsText>
        <FsText variant="caption">{shortDate(points[points.length - 1].date)}</FsText>
      </View>
      {/* Legend + why the trend matters (eases the frustration of daily bounce). */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.primary, opacity: 0.4 }]} />
          <FsText variant="caption">Scale weight</FsText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
          <View style={styles.legendDot} />
          <FsText variant="caption">Trend weight</FsText>
        </View>
      </View>
      <FsText variant="caption" style={{ color: colors.muted, textAlign: 'center', marginTop: 2 }}>
        The trend smooths out daily water-weight swings.
      </FsText>
    </View>
  );
}

function Stat({ label, value, tone, onPress }: { label: string; value: string; tone?: string; onPress?: () => void }) {
  const Wrap: typeof View | typeof Pressable = onPress ? Pressable : View;
  return (
    <Wrap style={styles.statCell} onPress={onPress}>
      <FsText variant="caption">{label}</FsText>
      <FsText variant="cardTitle" style={tone ? { color: tone } : undefined}>{value}</FsText>
    </Wrap>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  zoomBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space[4], marginTop: space[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.6, borderColor: colors.primary, backgroundColor: colors.surface, marginLeft: -4 },
  toggle: { flexDirection: 'row', gap: space[1], marginTop: space[2] },
  toggleBtn: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  toggleActive: { backgroundColor: colors.primary },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: space[3], gap: 2 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
}));
