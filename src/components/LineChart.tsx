import { View } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { FsText } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

export interface Series {
  points: number[];
  color: string;
}

/**
 * Minimal multi-series line chart (react-native-svg) with a labelled y-axis.
 * All series share one y-range; each is spread across the width by its own point
 * count, so it's a shape/trend comparison rather than a strictly date-aligned plot.
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
            const x = (i: number) => (s.points.length === 1 ? W / 2 : (i / (s.points.length - 1)) * W);
            const path = s.points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
            return <Path key={si} d={path} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
          })}
          {drawable.map((s, si) =>
            s.points.map((v, i) => {
              const x = s.points.length === 1 ? W / 2 : (i / (s.points.length - 1)) * W;
              return <Circle key={`${si}-${i}`} cx={x} cy={y(v)} r={2.5} fill={s.color} />;
            })
          )}
        </Svg>
      </View>
    </View>
  );
}
