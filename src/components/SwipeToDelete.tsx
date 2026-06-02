import { Alert, Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/** Total reveal width of the delete action (button + its left gutter). */
const ACTION_W = 80 + space[2];

/**
 * Wraps a row/card so swiping left reveals a red Delete button that confirms
 * before calling `onDelete`. The standard delete affordance for user-entered
 * lists across the app. The button tracks the finger as you swipe (via
 * Reanimated) so it's revealed smoothly rather than popping in.
 */
export function SwipeToDelete({
  onDelete,
  confirmTitle = 'Delete?',
  confirmMessage = "This can't be undone.",
  marginBottom = space[3],
  children,
}: {
  onDelete: () => void;
  confirmTitle?: string;
  confirmMessage?: string;
  marginBottom?: number;
  children: React.ReactNode;
}) {
  const confirm = () => {
    haptic.warning();
    Alert.alert(confirmTitle, confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };
  return (
    <ReanimatedSwipeable
      overshootRight={false}
      rightThreshold={ACTION_W / 2}
      renderRightActions={(_progress, translation) => (
        <RightAction translation={translation} marginBottom={marginBottom} onPress={confirm} />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function RightAction({
  translation,
  marginBottom,
  onPress,
}: {
  translation: SharedValue<number>;
  marginBottom: number;
  onPress: () => void;
}) {
  // `translation` runs 0 (closed) → -ACTION_W (open); slide the button in lockstep.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + ACTION_W }],
  }));
  return (
    <View style={{ width: ACTION_W, marginBottom }}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <Pressable style={styles.action} onPress={onPress}>
          <Trash2 color={colors.white} size={18} />
          <FsText variant="caption" style={{ color: colors.white }}>Delete</FsText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  action: {
    flex: 1,
    width: 80,
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginLeft: space[2],
  },
}));
