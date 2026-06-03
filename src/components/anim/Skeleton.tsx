import { useEffect } from 'react';
import { DimensionValue, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/theme/tokens';
import { DURATION } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';

/**
 * Shimmering placeholder block for genuinely-async surfaces (network food search,
 * remote exercise GIFs) so content fades in instead of popping onto a blank area.
 * Honors `useMotion()` (static block when motion is off).
 */
export function Skeleton({
  width = '100%',
  height = 16,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: ViewStyle;
}) {
  const { animate } = useMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (animate) p.value = withRepeat(withTiming(1, { duration: DURATION.slow * 3 }), -1, true);
    else p.value = 0;
  }, [animate, p]);

  const shimmer = useAnimatedStyle(() => ({ opacity: 0.45 + 0.4 * p.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh }, shimmer, style]}
    />
  );
}
