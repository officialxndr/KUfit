import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, runOnJS,
} from 'react-native-reanimated';
import { colors } from '@/theme/tokens';

/**
 * Lightweight, dependency-free confetti burst for big wins (goal weight, new PR).
 * Hand-rolled with reanimated so it stays on-brand (accent palette) — render it
 * conditionally; it fires once on mount and calls `onDone` when finished. Gate the
 * render on `useMotion().confetti` at the call site. `pointerEvents` is off so it
 * never blocks touches.
 *
 * Shards launch up **from the bottom** (a cannon fanning out of bottom-centre),
 * arc to a peak and fall back under "gravity" (a parabola driven by linear time =
 * a natural projectile), then fade.
 */
const COUNT = 22;
const RISE_MS = 1500;

function Shard({ index, onLast }: { index: number; onLast?: () => void }) {
  // Read the live theme palette at render (a plain string array — never enters a
  // worklet, so it can't freeze the mutable `colors` object).
  const SHARD_COLORS = [colors.primary, colors.success, colors.warning, colors.macroFat, colors.macroCarbs];
  const { width, height } = useWindowDimensions();
  const startX = width / 2 + (Math.random() - 0.5) * width * 0.4;
  const driftX = (Math.random() - 0.5) * width * 0.7;
  const rise = height * (0.5 + Math.random() * 0.4);
  const delay = Math.random() * 140;
  const spin = (Math.random() - 0.5) * 720;
  const color = SHARD_COLORS[index % SHARD_COLORS.length];
  const size = 7 + Math.random() * 5;
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: RISE_MS, easing: Easing.linear }, (finished) => {
      if (finished && index === COUNT - 1 && onLast) runOnJS(onLast)();
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const t = p.value;
    // Parabola: 0 at the bottom → peak (−rise) at t=0.5 → back to bottom at t=1.
    const lift = -4 * rise * t * (1 - t);
    return {
      transform: [
        { translateX: driftX * t },
        { translateY: lift },
        { rotate: `${spin * t}deg` },
      ],
      opacity: 1 - Math.max(0, (t - 0.8) / 0.2),
    };
  });

  return <Animated.View style={[styles.shard, { left: startX, width: size, height: size * 1.6, backgroundColor: color }, style]} />;
}

export function Confetti({ onDone }: { onDone?: () => void }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <Shard key={i} index={i} onLast={onDone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shard: { position: 'absolute', bottom: -24, borderRadius: 2 },
});
