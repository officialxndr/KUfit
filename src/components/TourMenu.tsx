import { Modal, View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X, Zap, Compass, ChevronRight } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { useTourStore } from '@/stores/tourStore';
import { TOUR_PAGES, tourStepsFor, BASIC_STEP_COUNT, ADVANCED_STEP_COUNT } from '@/lib/tourSteps';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * The tour chooser. Lets the user pick a **Basic** (essentials) or **Advanced** (every
 * feature) walkthrough, or jump to a single section's tour on replay. Mounted once in
 * `AppShell`; opens via `tourStore.openMenu()` (onboarding finish + Settings → Help).
 */
export function TourMenu() {
  const open = useTourStore((s) => s.menuOpen);
  const close = useTourStore((s) => s.closeMenu);
  const startTour = useTourStore((s) => s.startTour);

  const run = (tier: 'basic' | 'advanced', pageKey?: string) => { haptic.tap(); startTour(tier, pageKey); };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <FsText variant="h2">Take a tour</FsText>
            <Pressable onPress={close} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
          </View>
          <FsText variant="caption" style={{ marginBottom: space[3] }}>
            A guided walkthrough on the real screens. Skip or step back anytime.
          </FsText>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <Pressable style={styles.tier} onPress={() => run('basic')}>
              <View style={styles.tierIcon}><Compass color={colors.primary} size={20} /></View>
              <View style={{ flex: 1 }}>
                <FsText variant="cardTitle">Basic tour</FsText>
                <FsText variant="caption">The essentials to get going · {BASIC_STEP_COUNT} steps</FsText>
              </View>
              <ChevronRight color={colors.muted} size={20} />
            </Pressable>

            <Pressable style={styles.tier} onPress={() => run('advanced')}>
              <View style={styles.tierIcon}><Zap color={colors.primary} size={20} /></View>
              <View style={{ flex: 1 }}>
                <FsText variant="cardTitle">Advanced tour</FsText>
                <FsText variant="caption">Every feature, across all sections · {ADVANCED_STEP_COUNT} steps</FsText>
              </View>
              <ChevronRight color={colors.muted} size={20} />
            </Pressable>

            <FsText variant="overline" style={{ color: colors.muted, marginTop: space[3], marginBottom: space[2] }}>
              Or jump to a section
            </FsText>
            {TOUR_PAGES.map((p) => {
              const Icon = p.icon;
              const count = tourStepsFor('advanced', p.key).length;
              return (
                <Pressable key={p.key} style={styles.pageRow} onPress={() => run('advanced', p.key)}>
                  <Icon color={colors.text} size={18} />
                  <FsText variant="bodyMedium" style={{ flex: 1 }}>{p.label}</FsText>
                  <FsText variant="caption" style={{ marginRight: space[2] }}>{count}</FsText>
                  <ChevronRight color={colors.muted} size={18} />
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[4] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4], borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  tier: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: space[3], marginBottom: space[2],
  },
  tierIcon: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  pageRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
}));
