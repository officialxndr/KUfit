import { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { FsText, Button } from '@/components/ui';
import { useTourStore } from '@/stores/tourStore';
import { useNavStore } from '@/stores/navStore';
import { scrollMainTo } from '@/lib/appScroll';
import { useMotion } from '@/lib/useMotion';
import { DURATION, EASE } from '@/theme/motion';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, shadow, themedStyles } from '@/theme/tokens';

/**
 * The guided feature tour overlay. Rendered once at the top of `AppShell`; shows
 * only when `tourStore.active`. Each step drives the shell to a real screen via
 * `navStore.setSection`, with a docked explainer card floating above the bottom
 * nav (so the nav/FAB still peek through). A transparent touch-blocker keeps the
 * live UI non-interactive mid-tour — navigation is via the card's buttons only.
 */
export function FeatureTour() {
  const active = useTourStore((s) => s.active);
  const step = useTourStore((s) => s.step);
  const steps = useTourStore((s) => s.steps);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const insets = useSafeAreaInsets();
  const { animate } = useMotion();

  // Drive the shell to the step's screen, then scroll it into view.
  useEffect(() => {
    if (!active) return;
    const s = steps[step];
    if (!s) return;
    useNavStore.getState().setSection(s.section, s.subTab ?? null);
    // Reset to top immediately, then scroll to the step's target once the new
    // screen has mounted/laid out.
    scrollMainTo(0, false);
    const t = setTimeout(() => scrollMainTo(s.scroll ?? 0, true), 280);
    return () => clearTimeout(t);
  }, [active, step, steps]);

  if (!active || steps.length === 0) return null;

  const s = steps[step];
  const Icon = s.icon;
  const isLast = step === steps.length - 1;
  const finish = () => {
    useTourStore.getState().stop();
    useNavStore.getState().setSection('dashboard', 'overview');
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Blocks the live UI from being tapped during the tour (no dim — screens stay visible). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />

      <View style={[styles.cardWrap, { bottom: insets.bottom + 70 }]} pointerEvents="box-none">
        <Animated.View entering={animate ? SlideInDown.duration(DURATION.base).easing(EASE.standard) : undefined} style={styles.card}>
          <Animated.View key={step} entering={animate ? FadeIn.duration(DURATION.base) : undefined}>
            <View style={styles.iconWrap}><Icon color={colors.primary} size={22} /></View>
            <FsText variant="h2" style={{ marginTop: space[3] }}>{s.title}</FsText>
            <FsText variant="body" style={{ marginTop: space[2], color: colors.muted, lineHeight: 20 }}>{s.body}</FsText>
          </Animated.View>

          {/* Page label + progress bar — scales to long (Advanced) tours where a dot row wouldn't. */}
          <View style={styles.progress}>
            <View style={styles.progressHead}>
              <FsText variant="overline" style={{ color: colors.primary }}>{s.page}</FsText>
              <FsText variant="caption">{step + 1} / {steps.length}</FsText>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable onPress={() => { haptic.tap(); finish(); }} hitSlop={10}>
              <FsText variant="bodyMedium" style={{ color: colors.muted }}>Skip</FsText>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {step > 0 && <Button title="Back" variant="ghost" onPress={() => { haptic.tap(); back(); }} />}
              <Button title={isLast ? 'Done' : 'Next'} onPress={() => { haptic.tap(); isLast ? finish() : next(); }} />
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  cardWrap: { position: 'absolute', left: space[4], right: space[4], alignItems: 'stretch' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    ...shadow.pop,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  progress: { marginTop: space[4], marginBottom: space[4] },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  track: { height: 4, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));
