import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * Wraps a row/card so swiping left reveals a red Delete button that confirms
 * before calling `onDelete`. The standard delete affordance for user-entered
 * lists across the app.
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
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <View style={{ marginBottom }}>
          <Pressable style={styles.action} onPress={confirm}>
            <Trash2 color={colors.white} size={18} />
            <FsText variant="caption" style={{ color: colors.white }}>Delete</FsText>
          </Pressable>
        </View>
      )}
    >
      {children}
    </Swipeable>
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
