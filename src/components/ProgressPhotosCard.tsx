import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, Lock, ChevronRight } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { photoRepo } from '@/lib/repositories/PhotoRepo';
import { resolveProgressPhotoUri } from '@/lib/progressPhoto';
import { groupByDate, daysBetween, POSE_LABEL, type ProgressPhoto } from '@/lib/photoTimeline';
import { usePhotoLock } from '@/lib/photoLock';
import { longDate, todayLocal } from '@/lib/date';
import { colors, radius, space, themedStyles, primaryAlpha } from '@/theme/tokens';

/**
 * Health → Body entry point for progress photos: the latest photo set (or a lock / empty state),
 * how long since it was taken, and shortcuts to take photos or open the gallery.
 */
export function ProgressPhotosCard() {
  const router = useRouter();
  const { locked, unlock } = usePhotoLock();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  useFocusEffect(useCallback(() => { setPhotos(photoRepo.list()); }, []));

  const latestDay = groupByDate(photos)[0] ?? null;
  const since = latestDay ? daysBetween(latestDay.date, todayLocal()) : null;
  const take = () => router.push({ pathname: '/photo-capture', params: { date: todayLocal() } });
  const openAll = () => router.push('/photos');

  return (
    <Card style={{ marginBottom: space[3] }}>
      <Pressable onPress={openAll} style={styles.head} hitSlop={6}>
        <FsText variant="cardTitle" style={{ flex: 1 }}>Progress photos</FsText>
        {photos.length > 0 && <FsText variant="caption">{photos.length}</FsText>}
        <ChevronRight color={colors.muted} size={18} />
      </Pressable>

      {photos.length === 0 ? (
        <Pressable onPress={take} style={styles.empty}>
          <View style={styles.iconCircle}><Camera color={colors.primary} size={20} /></View>
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium">Take your first photos</FsText>
            <FsText variant="caption">Front, side and back — the scale can't show recomposition.</FsText>
          </View>
        </Pressable>
      ) : locked ? (
        <Pressable onPress={unlock} style={styles.empty}>
          <View style={styles.iconCircle}><Lock color={colors.primary} size={18} /></View>
          <FsText variant="bodyMedium" style={{ flex: 1 }}>Locked · tap to unlock</FsText>
        </Pressable>
      ) : (
        <>
          <View style={styles.row}>
            {latestDay!.photos.map((p) => {
              const uri = resolveProgressPhotoUri(p.fileName);
              return (
                <Pressable key={p.id} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/photo-compare', params: { id: p.id } })}>
                  {uri ? <Image source={{ uri }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumb} />}
                  <FsText variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>{POSE_LABEL[p.pose]}</FsText>
                </Pressable>
              );
            })}
            {/* Keep three columns so one photo doesn't stretch across the card. */}
            {Array.from({ length: Math.max(0, 3 - latestDay!.photos.length) }).map((_, i) => <View key={i} style={{ flex: 1 }} />)}
          </View>
          <View style={styles.foot}>
            <FsText variant="caption" style={{ flex: 1 }}>
              {since === 0 ? 'Taken today' : `${longDate(latestDay!.date)} · ${since} day${since === 1 ? '' : 's'} ago`}
            </FsText>
            <Pressable onPress={take} style={styles.takeBtn} hitSlop={6}>
              <Camera color={colors.primary} size={14} />
              <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Take photos</FsText>
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: primaryAlpha(0.12), alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space[2] },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  foot: { flexDirection: 'row', alignItems: 'center', marginTop: space[3] },
  takeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space[2], paddingVertical: 4, borderRadius: radius.full, backgroundColor: primaryAlpha(0.12) },
}));
