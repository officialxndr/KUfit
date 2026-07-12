import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FsText, Button } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveProgressPhotoUri } from '@/lib/progressPhoto';
import { allowRotation, lockPortrait } from '@/lib/orientation';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { shortDate, parseLocalDay } from '@/lib/date';
import { radius, space, themedStyles } from '@/theme/tokens';
import type { WeightEntry, UnitSystem } from '@/types';

/**
 * Full-screen progress-photo viewer. The photo is edge-to-edge; the weight/date and controls are
 * overlaid so the image gets the whole screen. "Compare with…" picks another weigh-in that has a
 * photo and shows the two side by side (oldest → newest) with the weight change over the span.
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

  // Allow landscape only while comparing two photos — side-by-side fills a wide screen far better.
  // A single photo stays portrait (taller box = bigger image). Re-lock portrait when leaving.
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
    <View style={styles.screen}>
      <StatusBar style="light" />

      {second && ordered ? (
        <>
          <View style={styles.twoUp}>
            <PhotoCol entry={ordered.older} unit={unit} />
            <PhotoCol entry={ordered.newer} unit={unit} />
          </View>
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space[3] }]}>
            <CompareDelta older={ordered.older} newer={ordered.newer} unit={unit} />
            <Button title="Compare another" variant="ghost" onPress={() => setPickerOpen(true)} />
          </View>
        </>
      ) : (
        <>
          <PhotoFill uri={resolveProgressPhotoUri(primary.photoUri)} />
          <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + space[6] }]}>
            <View style={{ flex: 1 }}>
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
    </View>
  );
}

function CloseButton({ onClose, top }: { onClose: () => void; top: number }) {
  return (
    <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { top: top + space[2] }]}>
      <X color="#fff" size={22} />
    </Pressable>
  );
}

function PhotoFill({ uri }: { uri: string | null }) {
  if (!uri) return <View style={[StyleSheet.absoluteFill, styles.center]}><FsText variant="caption" style={styles.dim}>Photo unavailable</FsText></View>;
  return <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />;
}

function PhotoCol({ entry, unit }: { entry: WeightEntry; unit: UnitSystem }) {
  const uri = resolveProgressPhotoUri(entry.photoUri);
  return (
    <View style={styles.col}>
      {uri
        ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        : <View style={[StyleSheet.absoluteFill, styles.center]}><FsText variant="caption" style={styles.dim}>—</FsText></View>}
      <View style={styles.colCaption} pointerEvents="none">
        <FsText variant="bodyMedium" style={styles.white}>{formatWeight(entry.weightKg, unit)}</FsText>
        <FsText variant="caption" style={styles.dim}>{shortDate(entry.date)}</FsText>
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
    alignItems: 'center', gap: space[1],
    paddingHorizontal: space[4], paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space[4] },
  pickCard: { backgroundColor: '#1c1c1e', borderRadius: radius.lg, padding: space[4] },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  pickThumb: { width: 44, height: 56, borderRadius: radius.sm, backgroundColor: '#333' },
}));
