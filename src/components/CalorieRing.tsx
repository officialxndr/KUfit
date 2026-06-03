import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, interpolateColor, Easing,
} from 'react-native-reanimated';
import { Flame } from 'lucide-react-native';
import { colors } from '@/theme/tokens';
import { type } from '@/theme/text';
import { DURATION } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';
import { AnimatedNumber } from '@/components/anim/AnimatedNumber';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Calorie ring — eaten vs goal. The fill **sweeps** from empty to the current
 * value and its color eases green → amber (→ red when over goal). When `burned`
 * > 0 a flame line shows how much active-calorie burn was added to the goal (the
 * `goal` passed in already includes it, so the "left of" total stays consistent).
 */
export function CalorieRing({
  eaten,
  goal,
  burned = 0,
  size = 160,
  strokeWidth = 14,
}: {
  eaten: number;
  goal: number;
  burned?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const { animate } = useMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const remaining = Math.max(Math.round(goal - eaten), 0);
  const ratio = goal > 0 ? eaten / goal : 0;
  const over = ratio > 1;

  const progress = useSharedValue(animate ? 0 : pct);
  useEffect(() => {
    progress.value = animate
      ? withTiming(pct, { duration: DURATION.slow, easing: Easing.out(Easing.cubic) })
      : pct;
  }, [pct, animate, progress]);

  // Pass color *strings* into the worklet — never the shared `colors` object.
  // Reanimated freezes objects captured by a worklet, and the theme system mutates
  // `colors` in place (`applyTheme`); freezing it would break live theme switching.
  const dangerC = colors.danger;
  const successC = colors.success;
  const warningC = colors.warning;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    stroke: over ? dangerC : interpolateColor(progress.value, [0, 0.85, 1], [successC, successC, warningC]),
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.ringTrack}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <AnimatedNumber value={Math.round(eaten)} variant="display" animateOnMount />
        <Text style={[type.caption, { marginTop: -2 }]}>kcal</Text>
      </View>
      {/* Caption below the ring so it never overlaps the stroke. */}
      <Text style={[type.caption, { marginTop: 6, textAlign: 'center' }]}>
        {goal > 0 ? `${remaining} left of ${goal}` : 'No goal set'}
      </Text>
      {burned > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <Flame color={colors.warning} size={11} />
          <Text style={[type.caption, { color: colors.warning }]}>+{Math.round(burned)} burned</Text>
        </View>
      )}
    </View>
  );
}
