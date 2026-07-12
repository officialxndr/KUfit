import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FsText, Button } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveProgressPhotoUri } from '@/lib/progressPhoto';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { shortDate, parseLocalDay } from '@/lib/date';
import { radius, space, themedStyles } from '@/theme/tokens';
import type { WeightEntry, UnitSystem } from '@/types';

/**
 * Full-screen progress-photo viewer. Opens on one weigh-in's photo; "Compare with…" picks another
 * weigh-in that has a photo and shows the two side by side with each date/weight + the change.
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

  if (!primary) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <TopBar title="Photo" onClose={close} />
        <View style={styles.center}><FsText variant="caption" style={styles.dim}>Photo unavailable.</FsText></View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <TopBar title={second ? 'Compare' : 'Progress photo'} onClose={close} />

      {second && ordered ? (
        <>
          <View style={styles.twoUp}>
            <PhotoCol entry={ordered.older} unit={unit} />
            <PhotoCol entry={ordered.newer} unit={unit} />
          </View>
          <CompareDelta older={ordered.older} newer={ordered.newer} unit={unit} />
          <View style={[styles.actions, { paddingBottom: insets.bottom + space[3] }]}>
            <Button title="Compare with another" variant="ghost" onPress={() => setPickerOpen(true)} />
          </View>
        </>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            <PhotoFill uri={resolveProgressPhotoUri(primary.photoUri)} />
          </View>
          <View style={styles.caption}>
            <FsText variant="bodyMedium" style={styles.white}>{formatWeight(primary.weightKg, unit)}</FsText>
            <FsText variant="caption" style={styles.dim}>{shortDate(primary.date)}</FsText>
          </View>
          <View style={[styles.actions, { paddingBottom: insets.bottom + space[3] }]}>
            <Button title="Compare with…" onPress={() => setPickerOpen(true)} disabled={others.length === 0} />
            {others.length === 0 && (
              <FsText variant="caption" style={[styles.dim, { textAlign: 'center', marginTop: space[2] }]}>
                Add a photo to another weigh-in to compare.
              </FsText>
            )}
          </View>
        </>
      )}

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

function TopBar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onClose} hitSlop={12}><X color="#fff" size={26} /></Pressable>
      <FsText variant="bodyMedium" style={styles.white}>{title}</FsText>
      <View style={{ width: 26 }} />
    </View>
  );
}

function PhotoFill({ uri }: { uri: string | null }) {
  if (!uri) return <View style={styles.center}><FsText variant="caption" style={styles.dim}>Photo unavailable</FsText></View>;
  return <Image source={{ uri }} style={{ flex: 1, width: '100%' }} contentFit="contain" />;
}

function PhotoCol({ entry, unit }: { entry: WeightEntry; unit: UnitSystem }) {
  const uri = resolveProgressPhotoUri(entry.photoUri);
  return (
    <View style={styles.col}>
      {uri
        ? <Image source={{ uri }} style={{ flex: 1, width: '100%' }} contentFit="contain" />
        : <View style={styles.center}><FsText variant="caption" style={styles.dim}>—</FsText></View>}
      <View style={styles.colCaption}>
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
    <View style={styles.delta}>
      <FsText variant="caption" style={styles.white}>
        {delta > 0 ? '+' : ''}{formatWeight(delta, unit)} over {days} day{days === 1 ? '' : 's'}
      </FsText>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  dim: { color: 'rgba(255,255,255,0.65)' },
  singleWrap: { flex: 1 },
  caption: { alignItems: 'center', paddingVertical: space[3] },
  twoUp: { flex: 1, flexDirection: 'row', gap: 2 },
  col: { flex: 1 },
  colCaption: { alignItems: 'center', paddingVertical: space[2] },
  delta: { alignItems: 'center', paddingVertical: space[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  actions: { paddingHorizontal: space[4], paddingTop: space[2] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space[4] },
  pickCard: { backgroundColor: '#1c1c1e', borderRadius: radius.lg, padding: space[4] },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  pickThumb: { width: 44, height: 56, borderRadius: radius.sm, backgroundColor: '#333' },
}));
