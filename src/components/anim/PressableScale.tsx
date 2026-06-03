import { Pressable, PressableProps, ViewStyle, GestureResponderEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SPRING } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Drop-in `Pressable` that springs down slightly on press, giving every tappable
 * card/row the same tactile feel as the FAB. Honors `useMotion()`.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style'> & {
  style?: ViewStyle | ViewStyle[];
  scaleTo?: number;
}) {
  const { animate } = useMotion();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      style={[style as ViewStyle, animStyle]}
      onPressIn={(e: GestureResponderEvent) => { if (animate) scale.value = withSpring(scaleTo, SPRING.snappy); onPressIn?.(e); }}
      onPressOut={(e: GestureResponderEvent) => { if (animate) scale.value = withSpring(1, SPRING.snappy); onPressOut?.(e); }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
