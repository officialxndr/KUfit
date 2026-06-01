import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { type } from '@/theme/text';

/**
 * Calorie ring — eaten vs goal. Color shifts green → amber → red as you
 * approach / exceed the goal, per the design system.
 */
export function CalorieRing({
  eaten,
  goal,
  size = 160,
  strokeWidth = 14,
}: {
  eaten: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0;
  const remaining = Math.max(Math.round(goal - eaten), 0);

  const ratio = goal > 0 ? eaten / goal : 0;
  const ringColor =
    ratio > 1 ? colors.danger : ratio > 0.9 ? colors.warning : colors.success;

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
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={[type.display]}>{Math.round(eaten)}</Text>
        <Text style={[type.caption, { marginTop: -2 }]}>kcal</Text>
      </View>
      {/* Caption below the ring so it never overlaps the stroke. */}
      <Text style={[type.caption, { marginTop: 6, textAlign: 'center' }]}>
        {goal > 0 ? `${remaining} left of ${goal}` : 'No goal set'}
      </Text>
    </View>
  );
}
