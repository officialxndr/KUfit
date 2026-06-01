import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, Animated, PanResponder, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme/tokens';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Shared draggable bottom sheet: slides up on open, dims the backdrop (tap to
 * dismiss), and exposes a generous grab strip you can drag down to dismiss
 * (release past a threshold / quick flick closes; a short drag springs back).
 * The sheet is capped a clear gap below the notch. Closing — whether via the
 * grab gesture, the backdrop, a child button calling `onClose`, or the parent
 * flipping `visible` — always animates out (the sheet stays mounted until the
 * slide-out finishes).
 *
 * Children supply their own content below the grab strip. For tall content,
 * wrap it in a `ScrollView` with a `maxHeight` so it scrolls independently of
 * the drag gesture.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra style for the sheet body (e.g. custom padding). */
  contentStyle?: object;
}) {
  const insets = useSafeAreaInsets();
  const sheetMaxHeight = SCREEN_H - insets.top - 24;
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Drive slide-in / slide-out from `visible`; stay mounted through the exit.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SCREEN_H);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start();
    } else {
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 200, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, translateY]);

  const handlePan = useRef(
    PanResponder.create({
      // The grab strip has no tappable children, so claim the touch immediately.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 0.5) closeRef.current();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    })
  ).current;

  // The full-screen dim never moves — its opacity is driven by the sheet's travel
  // so it fades in as the sheet slides up (and lightens as you drag it down).
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SCREEN_H],
    outputRange: [0.55, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Dim backdrop (fades in, full screen) + a transparent tap layer to dismiss. */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.wrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { maxHeight: sheetMaxHeight, paddingBottom: insets.bottom + space[4], transform: [{ translateY }] },
              contentStyle,
            ]}
          >
            {/* Drag strip — grab the bar and swipe down to dismiss. */}
            <View style={styles.grabStrip} {...handlePan.panHandlers}>
              <View style={styles.grabber} />
            </View>
            {children}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: space[4],
  },
  grabStrip: { alignItems: 'center', paddingTop: space[1], paddingBottom: space[3] },
  grabber: { width: 44, height: 5, borderRadius: radius.full, backgroundColor: colors.border },
});
