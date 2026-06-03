import { View } from 'react-native';
import Animated, { withTiming, type EntryAnimationsValues } from 'react-native-reanimated';
import { DURATION } from '@/theme/motion';
import { useMotion } from '@/lib/useMotion';

/**
 * Plays a subtle fade + small directional slide whenever `transitionKey` changes
 * (used by the shell when you switch section/sub-tab). Keyed remount drives the
 * entering animation; entering-only keeps it smooth inside the shell ScrollView.
 * `direction`: +1 slides in from the right, -1 from the left, 0 = fade only.
 */
export function ScreenTransition({
  transitionKey,
  direction = 0,
  children,
}: {
  transitionKey: string;
  direction?: number;
  children: React.ReactNode;
}) {
  const { animate } = useMotion();
  if (!animate) return <View key={transitionKey}>{children}</View>;

  const entering = (_values: EntryAnimationsValues) => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateX: direction * 16 }] },
      animations: {
        opacity: withTiming(1, { duration: DURATION.base }),
        transform: [{ translateX: withTiming(0, { duration: DURATION.base }) }],
      },
    };
  };

  return (
    <Animated.View key={transitionKey} entering={entering}>
      {children}
    </Animated.View>
  );
}
