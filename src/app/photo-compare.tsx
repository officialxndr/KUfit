import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { X, ChevronsLeftRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FsText, Button } from '@/components/ui';
import { ZoomableImage } from '@/components/ZoomableImage';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveProgressPhotoUri } from '@/lib/progressPhoto';
import { allowRotation, lockPortrait } from '@/lib/orientation';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { shortDate, parseLocalDay } from '@/lib/date';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { WeightEntry, UnitSystem } from '@/types';

type CompareMode = 'sideBySide' | 'slider';
const HANDLE_W = 44;

/**
 * Full-screen progress-photo viewer. The photo is edge-to-edge and pinch-to-zoom / pan / double-tap
 * (`ZoomableImage`). "Compare with…" picks another weigh-in that has a photo; the two show either
 * side by side (each zoomable) or as a draggable before/after slider, oldest → newest, with the
 * weight change over the span.
 */
export default function PhotoCompare() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const params = useLocalSearchParams<{ date?: string }>();
  const date = typeof params.date === 'string' ? params.date : null;

  const primary = useMemo(() => (date ? healthRepo.getWeightEntryByDate(date) : null), [date]);
  const photos = useMemo(() => healthRepo.getWeighInsWithPhotos(), []);
  const [secondDate, setSecondDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<CompareMode>('sideBySide');

  const second = secondDate ? photos.find((p) => p.date === secondDate) ?? null : null;
  // Candidates to compare against: every other photo weigh-in, minus the one already selected.
  const others = photos.filter((p) => p.date !== date && p.date !== secondDate);

  // Order the two panels chronologically (older left, newer right) so the delta always reads
  // time-forward regardless of which one the user opened first — a loss can't render as a gain.
  const ordered = second
    ? (parseLocalDay(primary!.date).getTime() <= parseLocalDay(second.date).getTime()
        ? { older: primary!, newer: second }
        : { older: second, newer: primary! })
    : null;

  const close = () => router.back();

  // Allow landscape only while comparing two photos — side-by-side / slider fill a wide screen far
  // better. A single photo stays portrait (taller box = bigger image). Re-lock portrait on exit.
  useEffect(() => { if (second) allowRotation(); else lockPortrait(); }, [second]);
  useEffect(() => () => { lockPortrait(); }, []);

  if (!primary) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <CloseButton onClose={close} top={insets.top} />
        <View style={styles.center}><FsText variant="caption" style={styles.dim}>Photo unavailable.</FsText></View>
      </View>
    );
  }

  return (
    // A native-stack modal renders outside the app-root GestureHandlerRootView, so gestures inside it
    // only fire when this subtree has its own — else pinch/pan/slider silently no-op (repo gotcha).
    <GestureHandlerRootView style={styles.screen}>
      <StatusBar style="light" />

      {second && ordered ? (
        <>
          {mode === 'slider'
            ? <SliderCompare older={ordered.older} newer={ordered.newer} unit={unit} />
            : (
              <View style={styles.twoUp}>
                <PhotoCol key={ordered.older.date} entry={ordered.older} unit={unit} />
                <PhotoCol key={ordered.newer.date} entry={ordered.newer} unit={unit} />
              </View>
            )}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space[3] }]}>
            <ModeToggle mode={mode} onChange={setMode} />
            <CompareDelta older={ordered.older} newer={ordered.newer} unit={unit} />
            <Button title="Compare another" variant="ghost" onPress={() => setPickerOpen(true)} />
          </View>
        </>
      ) : (
        <>
          <PhotoFill uri={resolveProgressPhotoUri(primary.photoUri)} />
          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space[6] }]} pointerEvents="box-none">
            <View style={{ flex: 1 }} pointerEvents="none">
              <FsText variant="stat" style={styles.white}>{formatWeight(primary.weightKg, unit)}</FsText>
              <FsText variant="caption" style={styles.dim}>{shortDate(primary.date)}</FsText>
            </View>
            {others.length > 0 && <Button title="Compare" onPress={() => setPickerOpen(true)} />}
          </View>
        </>
      )}

      <CloseButton onClose={close} top={insets.top} />

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={[styles.white, { marginBottom: space[3] }]}>Compare with</FsText>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {others.map((p) => (
                <Pressable key={p.id} style={styles.pickRow} onPress={() => { setSecondDate(p.date); setPickerOpen(false); }}>
                  <Image source={{ uri: resolveProgressPhotoUri(p.photoUri) ?? undefined }} style={styles.pickThumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <FsText variant="bodyMedium" style={styles.white}>{formatWeight(p.weightKg, unit)}</FsText>
                    <FsText variant="caption" style={styles.dim}>{shortDate(p.date)}</FsText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
  );
}

function CloseButton({ onClose, top }: { onClose: () => void; top: number }) {
  return (
    <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { top: top + space[2] }]}>
      <X color="#fff" size={22} />
    </Pressable>
  );
}

function ModeToggle({ mode, onChange }: { mode: CompareMode; onChange: (m: CompareMode) => void }) {
  return (
    <View style={styles.seg}>
      {([['sideBySide', 'Side by side'], ['slider', 'Slider']] as const).map(([m, label]) => (
        <Pressable key={m} onPress={() => onChange(m)} style={[styles.segItem, mode === m && styles.segItemOn]}>
          <FsText variant="caption" style={mode === m ? styles.white : styles.dim}>{label}</FsText>
        </Pressable>
      ))}
    </View>
  );
}

function PhotoFill({ uri }: { uri: string | null }) {
  if (!uri) return <View style={[StyleSheet.absoluteFill, styles.center]}><FsText variant="caption" style={styles.dim}>Photo unavailable</FsText></View>;
  return <ZoomableImage uri={uri} style={StyleSheet.absoluteFill} />;
}

function PhotoCol({ entry, unit }: { entry: WeightEntry; unit: UnitSystem }) {
  const uri = resolveProgressPhotoUri(entry.photoUri);
  return (
    <View style={styles.col}>
      {uri
        ? <ZoomableImage uri={uri} />
        : <View style={[StyleSheet.absoluteFill, styles.center]}><FsText variant="caption" style={styles.dim}>—</FsText></View>}
      <View style={styles.colCaption} pointerEvents="none">
        <FsText variant="bodyMedium" style={styles.white}>{formatWeight(entry.weightKg, unit)}</FsText>
        <FsText variant="caption" style={styles.dim}>{shortDate(entry.date)}</FsText>
      </View>
    </View>
  );
}

/** Before/after wipe: the newer photo underneath, the older clipped from the left to a draggable divider. */
function SliderCompare({ older, newer, unit }: { older: WeightEntry; newer: WeightEntry; unit: UnitSystem }) {
  const { width } = useWindowDimensions();
  // Store the divider as a 0..1 fraction (not pixels) so rotation preserves the user's position and
  // the divider can never strand off-screen — width just scales it at render time.
  const frac = useSharedValue(0.5);
  const start = useSharedValue(0.5);

  const pan = Gesture.Pan()
    .onStart(() => { start.value = frac.value; })
    .onUpdate((e) => { frac.value = Math.min(Math.max(start.value + e.translationX / width, 0), 1); });

  const clipStyle = useAnimatedStyle(() => ({ width: frac.value * width }));
  const handleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: frac.value * width - HANDLE_W / 2 }] }));

  const olderUri = resolveProgressPhotoUri(older.photoUri);
  const newerUri = resolveProgressPhotoUri(newer.photoUri);

  return (
    <View style={styles.fill}>
      {newerUri
        ? <Image source={{ uri: newerUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <View style={[StyleSheet.absoluteFill, styles.center]}><FsText variant="caption" style={styles.dim}>—</FsText></View>}

      <Animated.View style={[styles.clip, clipStyle]}>
        {olderUri
          ? <Image source={{ uri: olderUri }} style={[styles.clipImg, { width }]} contentFit="cover" />
          : <View style={[styles.clipImg, { width, backgroundColor: '#111' }, styles.center]}><FsText variant="caption" style={styles.dim}>—</FsText></View>}
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.handle, handleStyle]}>
          <View style={styles.handleLine} />
          <View style={styles.handleKnob}><ChevronsLeftRight color="#111" size={18} /></View>
          <View style={styles.handleLine} />
        </Animated.View>
      </GestureDetector>

      <View style={[styles.slLabel, { left: space[3] }]} pointerEvents="none">
        <FsText variant="bodyMedium" style={styles.white}>{formatWeight(older.weightKg, unit)}</FsText>
        <FsText variant="caption" style={styles.dim}>{shortDate(older.date)}</FsText>
      </View>
      <View style={[styles.slLabel, { right: space[3], alignItems: 'flex-end' }]} pointerEvents="none">
        <FsText variant="bodyMedium" style={styles.white}>{formatWeight(newer.weightKg, unit)}</FsText>
        <FsText variant="caption" style={styles.dim}>{shortDate(newer.date)}</FsText>
      </View>
    </View>
  );
}

function CompareDelta({ older, newer, unit }: { older: WeightEntry; newer: WeightEntry; unit: UnitSystem }) {
  const delta = newer.weightKg - older.weightKg; // time-forward: newer minus older (+ = gained, − = lost)
  const days = Math.abs(Math.round((parseLocalDay(newer.date).getTime() - parseLocalDay(older.date).getTime()) / 86_400_000));
  return (
    <FsText variant="bodyMedium" style={styles.white}>
      {delta > 0 ? '+' : ''}{formatWeight(delta, unit)} over {days} day{days === 1 ? '' : 's'}
    </FsText>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  dim: { color: 'rgba(255,255,255,0.65)' },
  closeBtn: {
    position: 'absolute', left: space[4], zIndex: 20,
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // Single view — weight/date + Compare overlaid on the bottom of the full-bleed photo. A soft scrim
  // keeps the white text legible over a bright photo (no gradient lib, so a low-opacity band).
  bottomOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    paddingHorizontal: space[4], paddingTop: space[8],
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  // Compare view — two full-height photos side by side + a caption over each.
  twoUp: { flex: 1, flexDirection: 'row', gap: 2 },
  col: { flex: 1 },
  colCaption: {
    position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 2,
    paddingTop: space[4], paddingBottom: space[2], backgroundColor: 'rgba(0,0,0,0.32)',
  },
  bottomBar: {
    alignItems: 'center', gap: space[2],
    paddingHorizontal: space[4], paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  // Slider (before/after wipe)
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  clipImg: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  handle: { position: 'absolute', top: 0, bottom: 0, width: HANDLE_W, alignItems: 'center', justifyContent: 'center' },
  handleLine: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.9)' },
  handleKnob: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginVertical: space[1] },
  slLabel: { position: 'absolute', bottom: space[3], gap: 2 },
  // Mode toggle (segmented)
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: 2 },
  segItem: { paddingHorizontal: space[4], paddingVertical: space[1], borderRadius: radius.sm },
  segItemOn: { backgroundColor: colors.primary },
  // Picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space[4] },
  pickCard: { backgroundColor: '#1c1c1e', borderRadius: radius.lg, padding: space[4] },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  pickThumb: { width: 44, height: 56, borderRadius: radius.sm, backgroundColor: '#333' },
}));
