import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withDelay,
} from 'react-native-reanimated';
import { FsText } from '@/components/ui';
import { colors, space } from '@/theme/tokens';
import { CHART, DURATION, EASE } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

export interface Series {
  points: number[];
  color: string;
}

/**
 * Minimal multi-series line chart (react-native-svg) with a labelled y-axis.
 * Lines **draw on** from the left (animated stroke dash) and the point markers
 * fade in just after. All series share one y-range; each is spread across the
 * width by its own point count, so it's a shape/trend comparison.
 */
export function LineChart({
  series,
  height = 150,
  emptyLabel = 'Not enough data yet.',
  format = (n: number) => String(Math.round(n)),
}: {
  series: Series[];
  height?: number;
  emptyLabel?: string;
  format?: (n: number) => string;
}) {
  const W = 320;
  const H = height;
  const all = series.flatMap((s) => s.points);
  const drawable = series.filter((s) => s.points.length >= 2);
  if (all.length < 2 || drawable.length === 0) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
        <FsText variant="caption">{emptyLabel}</FsText>
      </View>
    );
  }
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1;
  const min = lo - pad;
  const max = hi + pad;
  const mid = (min + max) / 2;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;

  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ height: H, justifyContent: 'space-between', marginRight: space[2], alignItems: 'flex-end' }}>
        <FsText variant="caption" style={{ fontSize: 10 }}>{format(hi)}</FsText>
        <FsText variant="caption" style={{ fontSize: 10 }}>{format(mid)}</FsText>
        <FsText variant="caption" style={{ fontSize: 10 }}>{format(lo)}</FsText>
      </View>
      <View style={{ flex: 1 }}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          {/* gridlines */}
          {[0, 0.5, 1].map((g) => (
            <Line key={g} x1={0} y1={H * g} x2={W} y2={H * g} stroke={colors.border} strokeWidth={1} opacity={0.5} />
          ))}
          {drawable.map((s, si) => {
            const xAt = (i: number) => (s.points.length === 1 ? W / 2 : (i / (s.points.length - 1)) * W);
            const coords = s.points.map((v, i) => ({ x: xAt(i), y: y(v) }));
            const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
            let length = 0;
            for (let i = 1; i < coords.length; i++) length += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
            return <TrendLine key={si} d={path} color={s.color} length={length} />;
          })}
          <DotsLayer>
            {drawable.map((s, si) =>
              s.points.map((v, i) => {
                const x = s.points.length === 1 ? W / 2 : (i / (s.points.length - 1)) * W;
                return <Circle key={`${si}-${i}`} cx={x} cy={y(v)} r={2.5} fill={s.color} />;
              })
            )}
          </DotsLayer>
        </Svg>
      </View>
    </View>
  );
}

/** A single series line that draws on from the left via an animated stroke dash. */
function TrendLine({ d, color, length }: { d: string; color: string; length: number }) {
  const { animate } = useMotion();
  const offset = useSharedValue(animate ? length : 0);
  useEffect(() => {
    offset.value = animate ? withTiming(0, { duration: CHART.line, easing: EASE.outStrong }) : 0;
  }, [animate, length, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={length}
      animatedProps={props}
    />
  );
}

/** Point markers fade in just after the lines finish drawing. */
function DotsLayer({ children }: { children: React.ReactNode }) {
  const { animate } = useMotion();
  const op = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    op.value = animate ? withDelay(CHART.line * 0.7, withTiming(1, { duration: DURATION.base })) : 1;
  }, [animate, op]);
  const props = useAnimatedProps(() => ({ opacity: op.value }));
  return <AnimatedG animatedProps={props}>{children}</AnimatedG>;
}
