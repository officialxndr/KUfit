import { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { CHART, EASE } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';

/**
 * A bar that grows up from its baseline (height 0 → target) on mount, optionally
 * staggered by `index`. For column charts whose container is bottom-aligned, so
 * the growth reads as rising from the axis. Honors `useMotion()`.
 */
export function GrowBar({
  height,
  index = 0,
  style,
}: {
  height: number;
  index?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const { animate } = useMotion();
  const h = useSharedValue(animate ? 0 : height);
  useEffect(() => {
    h.value = animate
      ? withDelay(index * 55, withTiming(height, { duration: CHART.bar, easing: EASE.outStrong }))
      : height;
  }, [height, animate, index, h]);
  const aStyle = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[style, aStyle]} />;
}
