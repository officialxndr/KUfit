import Svg, { Circle, Rect, Path, Ellipse } from 'react-native-svg';
import { colors } from '@/theme/tokens';

/**
 * Simple front-facing figure that draws a dashed indicator around the body part being
 * measured — a visual cue so the user measures the right place (e.g. waist at the navel
 * vs. hips at the widest point). Stylised, not anatomical; coordinates live in a
 * 120×260 viewBox and the indicator ellipses are tuned to sit on the silhouette.
 */
type Indicator = { cx: number; cy: number; rx: number; ry: number };

const INDICATORS: Record<string, Indicator> = {
  neck: { cx: 60, cy: 40, rx: 9, ry: 4 },
  shoulders: { cx: 60, cy: 54, rx: 30, ry: 4 },
  chest: { cx: 60, cy: 68, rx: 27, ry: 6 },
  waist: { cx: 60, cy: 96, rx: 19, ry: 5 },
  hips: { cx: 60, cy: 121, rx: 26, ry: 6 },
  leftArm: { cx: 27, cy: 72, rx: 7, ry: 4 },
  rightArm: { cx: 93, cy: 72, rx: 7, ry: 4 },
  leftThigh: { cx: 49, cy: 150, rx: 11, ry: 5 },
  rightThigh: { cx: 71, cy: 150, rx: 11, ry: 5 },
  leftCalf: { cx: 49, cy: 214, rx: 9, ry: 4 },
  rightCalf: { cx: 71, cy: 214, rx: 9, ry: 4 },
};

export function BodyDiagram({ site, height = 200 }: { site?: string | null; height?: number }) {
  const ind = site ? INDICATORS[site] : null;
  const fig = colors.surfaceHigh;
  const outline = colors.border;
  return (
    <Svg width={(height * 120) / 260} height={height} viewBox="0 0 120 260">
      {/* head + neck */}
      <Circle cx={60} cy={24} r={14} fill={fig} stroke={outline} strokeWidth={1.5} />
      <Rect x={54} y={34} width={12} height={11} rx={3} fill={fig} stroke={outline} strokeWidth={1.5} />
      {/* torso: wide shoulders → narrow waist → hips */}
      <Path d="M34,54 L86,54 L76,96 L82,122 L38,122 L44,96 Z" fill={fig} stroke={outline} strokeWidth={1.5} strokeLinejoin="round" />
      {/* arms */}
      <Rect x={22} y={56} width={10} height={62} rx={5} fill={fig} stroke={outline} strokeWidth={1.5} />
      <Rect x={88} y={56} width={10} height={62} rx={5} fill={fig} stroke={outline} strokeWidth={1.5} />
      {/* legs */}
      <Rect x={40} y={118} width={18} height={132} rx={8} fill={fig} stroke={outline} strokeWidth={1.5} />
      <Rect x={62} y={118} width={18} height={132} rx={8} fill={fig} stroke={outline} strokeWidth={1.5} />
      {/* dashed measurement indicator */}
      {ind && (
        <Ellipse
          cx={ind.cx}
          cy={ind.cy}
          rx={ind.rx}
          ry={ind.ry}
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeDasharray="4 3"
          fill="none"
        />
      )}
    </Svg>
  );
}
