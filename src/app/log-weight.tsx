import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { X, Camera } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { todayLocal } from '@/lib/date';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { pickProgressPhoto, resolveProgressPhotoUri, deleteProgressPhoto } from '@/lib/progressPhoto';
import { syncBodyFatGoalWeight } from '@/lib/goalWeight';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, toDisplay, formatWeight, UNIT_LABELS } from '@/lib/units';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const today = todayLocal;
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const round1 = (n: number) => String(Math.round(n * 10) / 10);

export default function LogWeight() {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.profile.unitSystem);

  // `?date=YYYY-MM-DD` opens an existing weigh-in for editing; no param = log today.
  const params = useLocalSearchParams<{ date?: string }>();
  const editDate = typeof params.date === 'string' ? params.date : null;
  const entry = useMemo(() => (editDate ? healthRepo.getWeightEntryByDate(editDate) : null), [editDate]);
  const editing = !!entry;

  const prefillWeight = entry ? round1(toDisplay(entry.weightKg, unit)) : '';
  const [weight, setWeight] = useState(prefillWeight);
  const [bodyFat, setBodyFat] = useState(() => (entry?.bodyFat != null ? String(entry.bodyFat) : ''));
  const [photoName, setPhotoName] = useState<string | null>(entry?.photoUri ?? null);
  const photoUri = resolveProgressPhotoUri(photoName);

  const latest = healthRepo.getLatestWeightEntry();

  const attachPhoto = async (source: 'camera' | 'library') => {
    if (!entry) return;
    const name = await pickProgressPhoto(source);
    if (!name) return;
    if (photoName) deleteProgressPhoto(photoName); // replace any previous photo
    healthRepo.setWeightPhoto(entry.id, name);
    setPhotoName(name);
    haptic.success();
  };
  const addPhoto = () =>
    Alert.alert('Add progress photo', undefined, [
      { text: 'Take photo', onPress: () => attachPhoto('camera') },
      { text: 'Choose from library', onPress: () => attachPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const removePhoto = () =>
    Alert.alert('Remove photo?', 'This deletes the progress photo for this weigh-in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        if (!entry) return;
        deleteProgressPhoto(photoName);
        healthRepo.setWeightPhoto(entry.id, null);
        setPhotoName(null);
      } },
    ]);
  const openPhoto = () => { if (entry) router.push({ pathname: '/photo-compare', params: { date: entry.date } }); };

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
          deleteProgressPhoto(photoName); // remove the attached photo file too (live state, not the stale memoized entry)
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
      <View style={[styles.header, { paddingTop: space[3] }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle">{editing ? 'Edit weigh-in' : 'Log weight'}</FsText>
        <Pressable onPress={save} hitSlop={10}><FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText></Pressable>
      </View>

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

        {/* Progress photo (existing weigh-ins only) — attach, view/compare, or remove. */}
        {editing && (
          <View style={{ marginTop: space[6] }}>
            <FsText variant="caption" style={{ marginBottom: space[2] }}>Progress photo</FsText>
            {photoUri ? (
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <Pressable onPress={openPhoto}>
                  <Image source={{ uri: photoUri }} style={styles.thumb} contentFit="cover" />
                </Pressable>
                <View style={{ flex: 1, justifyContent: 'center', gap: space[2] }}>
                  <Button title="View & compare" variant="ghost" onPress={openPhoto} />
                  <Pressable onPress={removePhoto} hitSlop={8} style={{ alignSelf: 'flex-start', padding: space[1] }}>
                    <FsText variant="caption" style={{ color: colors.danger }}>Remove photo</FsText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={addPhoto} style={styles.addPhoto}>
                <Camera color={colors.primary} size={18} />
                <FsText variant="bodyMedium" style={{ color: colors.primary }}>Add progress photo</FsText>
              </Pressable>
            )}
          </View>
        )}

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
  thumb: { width: 108, height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  addPhoto: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingVertical: 14,
  },
}));
