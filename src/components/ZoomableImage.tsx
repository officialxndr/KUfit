import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 4;

/**
 * Pinch-to-zoom + pan + double-tap image. Built on gesture-handler + reanimated (both already in the
 * app), so it ships over the air — no native module. Pan only moves the image while zoomed in and is
 * clamped to the image's own edges (can't be flung into empty space); a double-tap toggles fit (1×)
 * and 2×; pinching below 1× snaps back to a centered fit on release.
 *
 * NOTE: consumers on a native-stack modal (expo-router `presentation:'modal'|'fullScreenModal'`) must
 * wrap the screen body in its own `GestureHandlerRootView` — the app-root one doesn't reach the modal
 * subtree, so gestures silently no-op otherwise (see photo-compare.tsx).
 */
export function ZoomableImage({ uri, contentFit = 'contain', style }: {
  uri: string;
  contentFit?: 'contain' | 'cover';
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.5), MAX_SCALE); })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withTiming(1); tx.value = withTiming(0); ty.value = withTiming(0);
        savedScale.value = 1; savedTx.value = 0; savedTy.value = 0;
      } else {
        savedScale.value = scale.value;
        // Re-clamp: zooming out shrinks the allowed offset, so a previously-fine pan may now overflow.
        const maxX = (scale.value - 1) * w.value / 2;
        const maxY = (scale.value - 1) * h.value / 2;
        tx.value = Math.min(Math.max(tx.value, -maxX), maxX);
        ty.value = Math.min(Math.max(ty.value, -maxY), maxY);
        savedTx.value = tx.value; savedTy.value = ty.value;
      }
    });

  const pan = Gesture.Pan()
    .maxPointers(2)
    .onUpdate((e) => {
      if (scale.value > 1) {
        const maxX = (scale.value - 1) * w.value / 2;
        const maxY = (scale.value - 1) * h.value / 2;
        tx.value = Math.min(Math.max(savedTx.value + e.translationX, -maxX), maxX);
        ty.value = Math.min(Math.max(savedTy.value + e.translationY, -maxY), maxY);
      }
    })
    // Only persist while zoomed — otherwise a pinch-back-to-fit that ended first (settle zeroed the
    // offset) would be overwritten by a stale mid-animation value.
    .onEnd(() => { if (scale.value > 1) { savedTx.value = tx.value; savedTy.value = ty.value; } });

  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1); tx.value = withTiming(0); ty.value = withTiming(0);
        savedScale.value = 1; savedTx.value = 0; savedTy.value = 0;
      } else {
        scale.value = withTiming(2); savedScale.value = 2;
      }
    });

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.fill, style]}
        onLayout={(e) => { w.value = e.nativeEvent.layout.width; h.value = e.nativeEvent.layout.height; }}
      >
        <Animated.View style={[styles.fill, animStyle]}>
          <Image source={{ uri }} style={styles.fill} contentFit={contentFit} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1, width: '100%' } });
