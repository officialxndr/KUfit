import { useCallback, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, Lock } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { ModalHeader } from '@/components/ModalHeader';
import { todayLocal } from '@/lib/date';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveProgressPhotoUri } from '@/lib/progressPhoto';
import { photoRepo } from '@/lib/repositories/PhotoRepo';
import { POSES, POSE_LABEL, type ProgressPhoto } from '@/lib/photoTimeline';
import { usePhotoLock } from '@/lib/photoLock';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, toDisplay, formatWeight, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const today = todayLocal;
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const round1 = (n: number) => String(Math.round(n * 10) / 10);

export default function LogWeight() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);

  // `?date=YYYY-MM-DD` opens an existing weigh-in for editing; no param = log today.
  const params = useLocalSearchParams<{ date?: string }>();
  const editDate = typeof params.date === 'string' ? params.date : null;
  const entry = useMemo(() => (editDate ? healthRepo.getWeightEntryByDate(editDate) : null), [editDate]);
  const editing = !!entry;

  const prefillWeight = entry ? round1(toDisplay(entry.weightKg, unit)) : '';
  const [weight, setWeight] = useState(prefillWeight);
  const [bodyFat, setBodyFat] = useState(() => (entry?.bodyFat != null ? String(entry.bodyFat) : ''));
  // Progress photos for this day (independent of the weigh-in — they survive deleting it).
  const day = entry?.date ?? today();
  const [dayPhotos, setDayPhotos] = useState<ProgressPhoto[]>([]);
  useFocusEffect(useCallback(() => { setDayPhotos(photoRepo.forDate(day)); }, [day]));
  const { locked: photosLocked, unlock: unlockPhotos } = usePhotoLock();

  const latest = healthRepo.getLatestWeightEntry();

  const takePhotos = () => router.push({ pathname: '/photo-capture', params: { date: day } });
  const openPhoto = (p: ProgressPhoto) => router.push({ pathname: '/photo-compare', params: { id: p.id } });

  const save = () => {
    const val = Number(weight);
    if (!val || val <= 0) return Alert.alert('Enter a weight', 'Please enter a valid weight.');
    const bf = bodyFat.trim() ? Number(bodyFat) : null;
    if (bf != null && (!Number.isFinite(bf) || bf <= 0 || bf >= 100)) {
      return Alert.alert('Body fat', 'Enter a body-fat % between 0 and 100, or leave it blank to clear it.');
    }
    if (editing && entry) {
      // Preserve DEXA data; clearing the field removes just the body fat. Keep the stored kg at
      // full precision when the weight field wasn't touched (e.g. editing only the body fat).
      const kg = weight === prefillWeight ? entry.weightKg : toKg(val, unit);
      healthRepo.updateWeightEntryValues(entry.id, kg, bf);
    } else {
      healthRepo.upsertWeightEntry(today(), toKg(val, unit), bf ?? undefined);
    }
    syncBodyFatGoalWeight(); // weight/body-fat changed → refresh a body-fat-mode goal weight
    haptic.success();
    router.back();
  };

  const remove = () => {
    if (!entry) return;
    Alert.alert('Delete weigh-in?', `Remove the ${shortDate(entry.date)} entry entirely?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          healthRepo.deleteWeightEntry(entry.id);
          syncBodyFatGoalWeight();
          haptic.success();
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ModalHeader
        title={editing ? 'Edit weigh-in' : 'Log weight'}
        onClose={() => router.back()}
        right={<Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
          <FsText variant="caption">
            {editing ? shortDate(entry!.date) : `Today${latest ? ` · last: ${formatWeight(latest.weightKg, unit)}` : ''}`}
          </FsText>
          {editing && entry?.source ? (
            <FsText variant="caption" style={{ color: colors.muted }}>· {entry.source === 'HEALTH' ? 'from Health' : entry.source.toLowerCase()}</FsText>
          ) : null}
        </View>
        <View style={styles.field}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="Weight"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            autoFocus={!editing}
            style={styles.input}
          />
          <FsText variant="bodyMedium" style={{ color: colors.muted }}>{UNIT_LABELS[unit].weight}</FsText>
        </View>
        <View style={[styles.field, { marginTop: space[3] }]}>
          <TextInput
            value={bodyFat}
            onChangeText={setBodyFat}
            placeholder={editing ? 'Body fat (blank clears it)' : 'Body fat (optional)'}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <FsText variant="bodyMedium" style={{ color: colors.muted }}>%</FsText>
        </View>
        <Button title="Save" onPress={save} style={{ marginTop: space[6] }} />

        {/* Progress photos for this day — taken with the guided camera, kept separately from the weigh-in. */}
        <View style={{ marginTop: space[6] }}>
          <FsText variant="caption" style={{ marginBottom: space[2] }}>Progress photos</FsText>
          {photosLocked && dayPhotos.length > 0 ? (
            <Pressable onPress={unlockPhotos} style={styles.addPhoto}>
              <Lock color={colors.muted} size={16} />
              <FsText variant="bodyMedium" style={{ color: colors.muted }}>{dayPhotos.length} photo{dayPhotos.length === 1 ? '' : 's'} · tap to unlock</FsText>
            </Pressable>
          ) : dayPhotos.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {POSES.map((pose) => {
                const p = dayPhotos.find((x) => x.pose === pose);
                const uri = p ? resolveProgressPhotoUri(p.fileName) : null;
                return p && uri ? (
                  <Pressable key={pose} style={{ flex: 1 }} onPress={() => openPhoto(p)}>
                    <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                    <FsText variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>{POSE_LABEL[pose]}</FsText>
                  </Pressable>
                ) : (
                  <Pressable key={pose} style={{ flex: 1 }} onPress={takePhotos}>
                    <View style={[styles.photo, styles.emptySlot]}><Camera color={colors.primary} size={18} /></View>
                    <FsText variant="caption" style={{ textAlign: 'center', marginTop: 4, color: colors.primary }}>{POSE_LABEL[pose]}</FsText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable onPress={takePhotos} style={styles.addPhoto}>
              <Camera color={colors.primary} size={18} />
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>Take progress photos</FsText>
            </Pressable>
          )}
        </View>

        {editing && (
          <Pressable onPress={remove} hitSlop={8} style={{ alignSelf: 'center', marginTop: space[6], padding: space[2] }}>
            <FsText variant="bodyMedium" style={{ color: colors.danger }}>Delete weigh-in</FsText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingBottom: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 18 },
  photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  emptySlot: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: 'transparent' },
  addPhoto: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingVertical: 14,
  },
}));
