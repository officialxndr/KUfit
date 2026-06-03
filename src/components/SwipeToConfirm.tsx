import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, PanResponder, LayoutChangeEvent } from 'react-native';
import { ChevronsRight, Check } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const THUMB = 48;
const PAD = 4;

/**
 * Drag-to-confirm slider for destructive, must-not-be-accidental actions (data
 * wipe). The user has to drag the thumb fully to the right edge to fire
 * `onConfirm`; a short drag springs back. `disabled` greys it out and ignores
 * touches. RN `Animated` + `PanResponder` (same approach as `BottomSheet`).
 */
export function SwipeToConfirm({
  label, onConfirm, disabled = false,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const [done, setDone] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  const maxXRef = useRef(0);
  maxXRef.current = Math.max(0, trackW - THUMB - PAD * 2);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const doneRef = useRef(done);
  doneRef.current = done;

  // Reset the slider if it gets disabled again (e.g. the acknowledge toggle is turned off).
  useEffect(() => {
    if (disabled && !done) Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
  }, [disabled, done, x]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current && !doneRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current && !doneRef.current,
      onPanResponderMove: (_e, g) => {
        const v = Math.min(Math.max(0, g.dx), maxXRef.current);
        x.setValue(v);
      },
      onPanResponderRelease: (_e, g) => {
        const max = maxXRef.current;
        if (max > 0 && g.dx >= max * 0.92) {
          Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: true }).start(() => {
            setDone(true);
            haptic.warning();
            onConfirm();
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
    })
  ).current;

  const labelOpacity = x.interpolate({ inputRange: [0, Math.max(1, maxXRef.current)], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      style={[styles.track, disabled && { opacity: 0.45 }]}
      onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={{ opacity: labelOpacity }}>
        <FsText variant="bodyMedium" style={{ color: colors.danger, fontWeight: '600' }}>{label}</FsText>
      </Animated.View>
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: x }] }]}
        {...(disabled ? {} : pan.panHandlers)}
      >
        {done ? <Check color={colors.white} size={22} strokeWidth={3} /> : <ChevronsRight color={colors.white} size={22} />}
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  track: {
    height: THUMB + PAD * 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
