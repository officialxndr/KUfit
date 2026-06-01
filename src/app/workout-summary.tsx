import { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Trophy, Timer, Dumbbell, Layers, Flame } from 'lucide-react-native';

import { FsText, Button, Card, Badge } from '@/components/ui';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { formatVolume } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const DAY_MS = 86_400_000;
const WAVE_W = SCREEN_W * 2;
const WAVE_OVER = 100;
const BLOCK_H = SCREEN_H + WAVE_OVER;

/** A filled-below sine wave spanning two periods (so a one-screen shift loops seamlessly). */
function wavePath(amp: number, baseline: number): string {
  const period = SCREEN_W; // two periods across WAVE_W
  let d = `M0 ${baseline}`;
  for (let x = 0; x <= WAVE_W; x += 10) {
    const y = baseline + amp * Math.sin((x / period) * 2 * Math.PI);
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L${WAVE_W} ${BLOCK_H} L0 ${BLOCK_H} Z`;
}

function WaveLayer({ color, amp, baseline, dur, delay }: { color: string; amp: number; baseline: number; dur: number; delay: number }) {
  const tx = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(tx, { toValue: -SCREEN_W, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }] }]}>
      <Svg width={WAVE_W} height={BLOCK_H}>
        <Path d={wavePath(amp, baseline)} fill={color} />
      </Svg>
    </Animated.View>
  );
}

export default function WorkoutSummary() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const profile = useSettingsStore((s) => s.profile);
  const fromHistory = from === 'history';

  const session = useMemo(() => workoutRepo.getSessions(300).find((s) => s.id === id) ?? null, [id]);

  // Layered waves rise to wipe the screen, then content fades in (RN Animated — no worklets).
  // When opened from History it's a plain detail view: skip the celebratory wipe.
  const rise = useRef(new Animated.Value(fromHistory ? -WAVE_OVER : SCREEN_H)).current;
  const reveal = useRef(new Animated.Value(fromHistory ? 1 : 0)).current;
  useEffect(() => {
    if (fromHistory) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(rise, { toValue: -WAVE_OVER, duration: 1900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(reveal, { toValue: 1, duration: 550, delay: 1750, useNativeDriver: true }).start();
  }, []);

  const contentStyle = {
    opacity: reveal,
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  const done = () => {
    if (fromHistory) { router.back(); return; }
    useNavStore.getState().setSection('workout', 'history');
    router.replace('/(tabs)');
  };

  const sets = session?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0;
  const prs = session?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPersonalBest).length, 0) ?? 0;
  const volume = formatVolume(session?.totalVolume ?? 0, profile.unitSystem);
  const durationMin = session?.finishedAt
    ? Math.max(1, Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
    : null;

  // Progress toward the weekly-sessions goal.
  const weekStart = Date.now() - 7 * DAY_MS;
  const thisWeek = workoutRepo.getSessions(60).filter((s) => new Date(s.startedAt).getTime() >= weekStart).length;
  const target = profile.weeklySessionTarget ?? null;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.liquidBlock, { transform: [{ translateY: rise }] }]} pointerEvents="none">
        <WaveLayer color="rgba(99,102,241,0.10)" amp={12} baseline={52} dur={3000} delay={0} />
        <WaveLayer color="rgba(99,102,241,0.16)" amp={20} baseline={32} dur={2200} delay={140} />
        <WaveLayer color="rgba(99,102,241,0.26)" amp={9} baseline={64} dur={3600} delay={300} />
      </Animated.View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.trophyWrap}>
            <Trophy color={colors.white} size={40} />
          </View>
          <FsText variant="display" style={{ textAlign: 'center' }}>{fromHistory ? 'Workout' : 'Workout Complete'}</FsText>
          <FsText variant="bodyMedium" style={{ textAlign: 'center', color: colors.muted, marginBottom: space[6] }}>
            {session?.name ?? 'Workout'}
          </FsText>

          <View style={styles.grid}>
            <Stat icon={Timer} label="Duration" value={durationMin != null ? `${durationMin} min` : '—'} />
            <Stat icon={Dumbbell} label="Volume" value={volume} />
            <Stat icon={Layers} label="Sets" value={String(sets)} />
            <Stat icon={Flame} label="Exercises" value={String(session?.exercises.length ?? 0)} />
          </View>

          {prs > 0 && (
            <Card style={styles.prCard}>
              <Trophy color={colors.warning} size={20} />
              <FsText variant="cardTitle" style={{ flex: 1 }}>
                {prs} new personal best{prs > 1 ? 's' : ''}!
              </FsText>
              <Badge label="PR" tone="warning" />
            </Card>
          )}

          {target != null && (
            <Card style={{ marginTop: space[3] }}>
              <View style={styles.rowBetween}>
                <FsText variant="cardTitle">Weekly goal</FsText>
                <FsText variant="bodyMedium" style={{ color: thisWeek >= target ? colors.success : colors.text }}>
                  {Math.min(thisWeek, target)} / {target}
                </FsText>
              </View>
              <View style={styles.track}>
                <View style={{ width: `${Math.min(thisWeek / target, 1) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: radius.full }} />
              </View>
              <FsText variant="caption" style={{ marginTop: space[2] }}>
                {thisWeek >= target ? 'Weekly target hit — nice work.' : `${target - thisWeek} more this week to hit your goal.`}
              </FsText>
            </Card>
          )}

          <View style={{ flex: 1 }} />
          <Button title={fromHistory ? 'Close' : 'Done'} onPress={done} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Icon color={colors.primary} size={18} />
      <FsText variant="stat" style={{ marginTop: space[2] }}>{value}</FsText>
      <FsText variant="caption">{label}</FsText>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  liquidBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: BLOCK_H,
  },
  safe: { flex: 1 },
  content: { flex: 1, padding: space[4] },
  trophyWrap: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[6],
    marginBottom: space[4],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  statCard: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 2 },
  prCard: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  track: { height: 10, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
}));
