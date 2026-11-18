import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, Lock, Film, ArrowRight } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { ModalHeader } from '@/components/ModalHeader';
import { photoRepo } from '@/lib/repositories/PhotoRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveProgressPhotoUri, deleteProgressPhoto } from '@/lib/progressPhoto';
import {
  POSES, POSE_LABEL, firstAndLatest, groupByDate, timelineFor, weightNear, daysBetween,
  type Pose, type ProgressPhoto,
} from '@/lib/photoTimeline';
import { usePhotoLock } from '@/lib/photoLock';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { longDate, shortDate, todayLocal } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles, primaryAlpha, PAGE_PADDING } from '@/theme/tokens';
import type { WeightEntry } from '@/types';

type Filter = 'all' | Pose;
const GAP = 6;

/**
 * Progress-photo gallery: a first-vs-latest headline, a timelapse entry, and a day-by-day grid
 * (newest first) with the weigh-in nearest each day. Tap a photo to view/compare, long-press to
 * delete. Optionally Face ID-locked (`profile.photoLock`).
 */
export default function Photos() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const { width } = useWindowDimensions();
  const { locked, unlock } = usePhotoLock();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const refresh = useCallback(() => {
    setPhotos(photoRepo.list());
    setWeights(healthRepo.getWeightEntries('0000-01-01', '9999-12-31'));
  }, []);
  useFocusEffect(refresh);

  const shown = filter === 'all' ? photos : photos.filter((p) => p.pose === filter);
  const days = useMemo(() => groupByDate(shown), [shown]);
  const headline = useMemo(() => firstAndLatest(photos, filter === 'all' ? undefined : filter), [photos, filter]);
  const thumbW = (width - PAGE_PADDING * 2 - GAP * 2) / 3;

  const addPhoto = () => router.push({ pathname: '/photo-capture', params: { date: todayLocal() } });
  const open = (p: ProgressPhoto) => router.push({ pathname: '/photo-compare', params: { id: p.id } });
  const remove = (p: ProgressPhoto) =>
    Alert.alert('Delete photo?', `Delete the ${POSE_LABEL[p.pose].toLowerCase()} photo from ${shortDate(p.date)}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteProgressPhoto(photoRepo.remove(p.id)); haptic.success(); refresh(); } },
    ]);

  if (locked) {
    return (
      <View style={styles.screen}>
        <ModalHeader title="Progress photos" onClose={() => router.back()} />
        <View style={styles.lockWrap}>
          <View style={styles.iconCircle}><Lock color={colors.primary} size={26} /></View>
          <FsText variant="cardTitle">Photos are locked</FsText>
          <FsText variant="caption" style={{ textAlign: 'center' }}>Unlock with Face ID or your passcode to view them.</FsText>
          <Button title="Unlock" onPress={unlock} style={{ marginTop: space[3], alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ModalHeader
        title="Progress photos"
        onClose={() => router.back()}
        right={<Pressable onPress={addPhoto} hitSlop={10} accessibilityLabel="Take progress photo"><Camera color={colors.primary} size={22} /></Pressable>}
      />

      {photos.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: PAGE_PADDING, gap: space[4] }}>
          <View style={[styles.lockWrap, { paddingTop: space[6] }]}>
            <View style={styles.iconCircle}><Camera color={colors.primary} size={26} /></View>
            <FsText variant="cardTitle">Track how your body changes</FsText>
            <FsText variant="caption" style={{ textAlign: 'center' }}>
              The scale doesn't show recomposition — photos do. Take a front, side and back photo every week or two.
            </FsText>
            <Button title="Take your first photos" onPress={addPhoto} style={{ marginTop: space[3], alignSelf: 'stretch' }} />
          </View>
          <Card style={{ gap: space[2] }}>
            <FsText variant="overline">Tips for comparable photos</FsText>
            {[
              'Same spot, same lighting, same time of day (mornings work best).',
              'Use the self-timer and prop the phone at chest height.',
              'Wear the same thing each time and stand relaxed.',
              'After your first set, a faint “ghost” of it helps you line up the next one.',
            ].map((t) => <FsText key={t} variant="caption">• {t}</FsText>)}
          </Card>
          <FsText variant="caption" style={{ textAlign: 'center', color: colors.muted }}>
            Photos stay on this device — they're never uploaded.
          </FsText>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: PAGE_PADDING, paddingBottom: space[8] }}>
          {/* Pose filter */}
          <View style={styles.filterRow}>
            {(['all', ...POSES] as Filter[]).map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipOn]}>
                <FsText variant="caption" style={{ color: filter === f ? colors.white : colors.text, fontWeight: '600' }}>
                  {f === 'all' ? 'All' : POSE_LABEL[f]}
                </FsText>
              </Pressable>
            ))}
          </View>

          {/* First vs latest */}
          {headline ? (
            <Pressable
              onPress={() => router.push({ pathname: '/photo-compare', params: { id: headline.first.id, with: headline.latest.id } })}
              style={styles.hero}
            >
              <View style={{ flexDirection: 'row', gap: GAP }}>
                <HeroThumb photo={headline.first} label="First" />
                <HeroThumb photo={headline.latest} label="Latest" />
              </View>
              <View style={styles.heroFoot}>
                <View style={{ flex: 1 }}>
                  <FsText variant="bodyMedium">{POSE_LABEL[headline.pose]} · {daysBetween(headline.first.date, headline.latest.date)} days apart</FsText>
                  <HeroDelta first={headline.first.date} latest={headline.latest.date} weights={weights} unit={unit} />
                </View>
                <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Compare</FsText>
                <ArrowRight color={colors.primary} size={16} />
              </View>
            </Pressable>
          ) : null}

          {/* Timelapse */}
          {(() => {
            const pose = filter === 'all' ? headline?.pose ?? 'front' : filter;
            const count = timelineFor(photos, pose).length;
            return count >= 3 ? (
              <Pressable onPress={() => router.push({ pathname: '/photo-timelapse', params: { pose } })} style={styles.timelapseRow}>
                <Film color={colors.primary} size={18} />
                <FsText variant="bodyMedium" style={{ flex: 1 }}>Timelapse · {POSE_LABEL[pose].toLowerCase()} ({count} photos)</FsText>
                <ArrowRight color={colors.muted} size={16} />
              </Pressable>
            ) : null;
          })()}

          {/* Day grid */}
          {days.map((d) => {
            const w = weightNear(d.date, weights);
            return (
              <View key={d.date} style={{ marginTop: space[4] }}>
                <View style={styles.dayHead}>
                  <FsText variant="bodyMedium">{longDate(d.date)}</FsText>
                  {w ? <FsText variant="caption">{formatWeight(w.weightKg, unit)}{w.date !== d.date ? ` · ${shortDate(w.date)}` : ''}</FsText> : null}
                </View>
                <View style={styles.thumbRow}>
                  {d.photos.map((p) => (
                    <Pressable key={p.id} onPress={() => open(p)} onLongPress={() => remove(p)} delayLongPress={350}>
                      <Thumb photo={p} width={thumbW} />
                    </Pressable>
                  ))}
                  {filter === 'all' && d.photos.length < 3 && d.date === todayLocal() ? (
                    <Pressable onPress={() => router.push({ pathname: '/photo-capture', params: { date: d.date } })} style={[styles.addThumb, { width: thumbW, height: thumbW * 4 / 3 }]}>
                      <Camera color={colors.primary} size={20} />
                      <FsText variant="caption" style={{ color: colors.primary }}>Add pose</FsText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
          <FsText variant="caption" style={{ textAlign: 'center', color: colors.muted, marginTop: space[6] }}>
            Long-press a photo to delete it. Photos stay on this device.
          </FsText>
        </ScrollView>
      )}
    </View>
  );
}

function Thumb({ photo, width }: { photo: ProgressPhoto; width: number }) {
  const uri = resolveProgressPhotoUri(photo.fileName);
  return (
    <View style={{ width }}>
      {uri
        ? <Image source={{ uri }} style={[styles.thumb, { width, height: width * 4 / 3 }]} contentFit="cover" transition={120} />
        : <View style={[styles.thumb, styles.thumbMissing, { width, height: width * 4 / 3 }]}><FsText variant="caption">Missing</FsText></View>}
      <View style={styles.poseTag}><FsText variant="caption" style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{POSE_LABEL[photo.pose]}</FsText></View>
    </View>
  );
}

function HeroThumb({ photo, label }: { photo: ProgressPhoto; label: string }) {
  const uri = resolveProgressPhotoUri(photo.fileName);
  return (
    <View style={{ flex: 1 }}>
      {uri ? <Image source={{ uri }} style={styles.heroImg} contentFit="cover" /> : <View style={[styles.heroImg, styles.thumbMissing]} />}
      <View style={styles.heroLabel}>
        <FsText variant="caption" style={{ color: '#fff', fontWeight: '700' }}>{label}</FsText>
        <FsText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>{shortDate(photo.date)}</FsText>
      </View>
    </View>
  );
}

function HeroDelta({ first, latest, weights, unit }: { first: string; latest: string; weights: WeightEntry[]; unit: 'METRIC' | 'IMPERIAL' }) {
  const a = weightNear(first, weights);
  const b = weightNear(latest, weights);
  if (!a || !b) return <FsText variant="caption">Log weigh-ins to see the change</FsText>;
  const d = b.weightKg - a.weightKg;
  const tone = Math.abs(d) < 0.05 ? colors.muted : d < 0 ? colors.success : colors.danger;
  return <FsText variant="caption" style={{ color: tone }}>{d > 0 ? '+' : ''}{formatWeight(d, unit)} · {formatWeight(a.weightKg, unit)} → {formatWeight(b.weightKg, unit)}</FsText>;
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  lockWrap: { alignItems: 'center', gap: space[2], padding: space[6], paddingTop: space[8] },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: primaryAlpha(0.12), alignItems: 'center', justifyContent: 'center', marginBottom: space[2] },
  filterRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  filterChip: { paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  filterChipOn: { backgroundColor: colors.primary },
  hero: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: GAP, borderWidth: 1, borderColor: colors.border },
  heroImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  heroLabel: { position: 'absolute', left: space[2], bottom: space[2], backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: space[1], padding: space[2], paddingTop: space[3] },
  timelapseRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[3],
    padding: space[3], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space[2] },
  thumbRow: { flexDirection: 'row', gap: GAP },
  thumb: { borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  thumbMissing: { alignItems: 'center', justifyContent: 'center' },
  poseTag: { position: 'absolute', left: 4, top: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  addThumb: {
    borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
}));
