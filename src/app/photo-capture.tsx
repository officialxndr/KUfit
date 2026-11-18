import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, SwitchCamera, Images, Ghost, Timer, Check } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { photoRepo } from '@/lib/repositories/PhotoRepo';
import { saveProgressPhoto, pickProgressPhotoFromLibrary, resolveProgressPhotoUri, deleteProgressPhoto } from '@/lib/progressPhoto';
import { POSES, POSE_LABEL, ghostFor, isPose, nextPose, type Pose } from '@/lib/photoTimeline';
import { todayLocal, shortDate } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { useRefreshStore } from '@/stores/refreshStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const TIMERS = [0, 3, 5, 10] as const;
type TimerSec = (typeof TIMERS)[number];

/**
 * Guided progress-photo camera. Pick a pose (front/side/back), line the shot up against a faint
 * **ghost** of the last photo in that pose, and use a 3/5/10 s **self-timer** for mirror/tripod shots.
 * After each save it advances to the next pose not yet taken that day, so a full front→side→back set
 * is three shutter taps. "Library" imports an existing photo (with a date picker for back-filling).
 *
 * The front camera saves **mirrored** (`mirror`) so the stored photo matches the preview — and so the
 * ghost (a previous stored photo) lines up with what the user sees.
 */
export default function PhotoCapture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; pose?: string }>();
  const [date, setDate] = useState(typeof params.date === 'string' ? params.date : todayLocal());

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [ready, setReady] = useState(false);

  // Photos change as we save — bump to re-read.
  const [version, setVersion] = useState(0);
  const allPhotos = useMemo(() => photoRepo.list(), [version]);
  const todays = allPhotos.filter((p) => p.date === date);
  const [pose, setPose] = useState<Pose>(() => (isPose(params.pose) ? params.pose : nextPose(photoRepo.forDate(date))));

  const ghost = ghostFor(allPhotos, pose, date);
  const ghostUri = ghost ? resolveProgressPhotoUri(ghost.fileName) : null;
  const [ghostOn, setGhostOn] = useState(true);
  const [timer, setTimer] = useState<TimerSec>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shot, setShot] = useState<{ uri: string; width?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bump = useRefreshStore((s) => s.bump);

  useEffect(() => { if (permission && !permission.granted && permission.canAskAgain) requestPermission(); }, [permission, requestPermission]);

  // Self-timer: tick once a second with a haptic, fire the shutter at 0.
  useEffect(() => {
    if (countdown == null) return;
    if (countdown === 0) { setCountdown(null); void capture(); return; }
    haptic.tap();
    const t = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const capture = async () => {
    if (!cameraRef.current || !ready) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (pic?.uri) { haptic.success(); setShot({ uri: pic.uri, width: pic.width }); }
    } catch {
      Alert.alert('Camera error', 'Could not take the photo. Try again.');
    }
  };

  const onShutter = () => {
    if (countdown != null) { setCountdown(null); return; } // tap again to cancel the timer
    if (timer > 0) setCountdown(timer);
    else void capture();
  };

  /** Store a saved file in the (date, pose) slot, clean up a replaced file, and move to the next pose. */
  const commit = (fileName: string) => {
    const { replacedFile } = photoRepo.upsert(date, pose, fileName);
    if (replacedFile) deleteProgressPhoto(replacedFile);
    bump();
    const nowTaken = [...todays.filter((p) => p.pose !== pose), { pose }];
    const remaining = POSES.filter((p) => !nowTaken.some((t) => t.pose === p));
    setVersion((v) => v + 1);
    setShot(null);
    if (remaining.length) {
      setPose(remaining[0]);
      setToast(`${POSE_LABEL[pose]} saved · now ${POSE_LABEL[remaining[0]].toLowerCase()}`);
    } else {
      setToast('All three poses saved');
    }
  };

  const confirmReplace = (then: () => void) => {
    if (!todays.some((p) => p.pose === pose)) { then(); return; }
    Alert.alert(`Replace ${POSE_LABEL[pose].toLowerCase()} photo?`, `There's already a ${POSE_LABEL[pose].toLowerCase()} photo for ${shortDate(date)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: then },
    ]);
  };

  const usePhoto = () => {
    if (!shot) return;
    confirmReplace(async () => {
      setSaving(true);
      const name = await saveProgressPhoto(shot.uri, shot.width);
      setSaving(false);
      if (!name) { Alert.alert('Save failed', 'Could not save the photo. Try again.'); return; }
      commit(name);
    });
  };

  const fromLibrary = () => confirmReplace(async () => {
    setSaving(true);
    const name = await pickProgressPhotoFromLibrary();
    setSaving(false);
    if (name) commit(name);
  });

  const done = () => router.back();

  // ── Permission states ──
  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center, { padding: space[6] }]}>
        <StatusBar style="light" />
        <FsText variant="cardTitle" style={[styles.white, { textAlign: 'center' }]}>Camera access needed</FsText>
        <FsText variant="caption" style={[styles.dim, { textAlign: 'center', marginTop: space[2], marginBottom: space[4] }]}>
          Allow camera access to take progress photos, or import one from your library.
        </FsText>
        {permission.canAskAgain && <Button title="Allow camera" onPress={requestPermission} />}
        <Button title="Choose from library" variant="ghost" onPress={fromLibrary} style={{ marginTop: space[2] }} />
        <Button title="Close" variant="ghost" onPress={done} style={{ marginTop: space[2] }} />
      </View>
    );
  }

  const takenPoses = new Set(todays.map((p) => p.pose));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {shot ? (
        // ── Review ──
        <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={facing === 'front'}
            animateShutter
            onCameraReady={() => setReady(true)}
          />
          {ghostOn && ghostUri ? (
            <Image source={{ uri: ghostUri }} style={[StyleSheet.absoluteFill, { opacity: 0.32 }]} contentFit="cover" pointerEvents="none" />
          ) : (
            // No ghost yet: a centre line + head/hip guides to keep framing consistent from the first shot.
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.guideV} />
              <View style={[styles.guideH, { top: '14%' }]} />
              <View style={[styles.guideH, { top: '55%' }]} />
            </View>
          )}
          {countdown != null && (
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <FsText style={styles.countdown}>{countdown}</FsText>
            </View>
          )}
        </>
      )}

      {/* Top bar: close · pose picker · done */}
      <View style={[styles.topBar, { paddingTop: insets.top + space[2] }]}>
        <Pressable onPress={done} hitSlop={12} style={styles.roundBtn}><X color="#fff" size={22} /></Pressable>
        <View style={styles.poseSeg}>
          {POSES.map((p) => (
            <Pressable key={p} onPress={() => { setPose(p); haptic.tap(); }} style={[styles.poseItem, pose === p && styles.poseItemOn]}>
              {takenPoses.has(p) && <Check color="#fff" size={12} strokeWidth={3} />}
              <FsText variant="caption" style={pose === p ? styles.white : styles.dim}>{POSE_LABEL[p]}</FsText>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={done} hitSlop={12} style={styles.roundBtn}>
          <FsText variant="caption" style={[styles.white, { fontWeight: '700' }]}>Done</FsText>
        </Pressable>
      </View>

      {toast && (
        <View style={[styles.toast, { top: insets.top + 64 }]} pointerEvents="none">
          <FsText variant="caption" style={styles.white}>{toast}</FsText>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + space[4] }]}>
        {shot ? (
          <View style={styles.reviewRow}>
            <Button title="Retake" variant="ghost" onPress={() => setShot(null)} style={{ flex: 1 }} />
            <Button title={`Use ${POSE_LABEL[pose].toLowerCase()} photo`} onPress={usePhoto} loading={saving} style={{ flex: 2 }} />
          </View>
        ) : (
          <>
            <View style={styles.optionRow}>
              <View style={styles.dateChip}>
                <DateField value={date} onChange={(d) => { if (d && d <= todayLocal()) { setDate(d); setVersion((v) => v + 1); } }} />
              </View>
              {ghostUri ? (
                <Pressable onPress={() => setGhostOn((g) => !g)} style={[styles.chip, ghostOn && styles.chipOn]} accessibilityLabel="Toggle ghost overlay">
                  <Ghost color="#fff" size={14} />
                  <FsText variant="caption" style={styles.white}>Ghost</FsText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => { setTimer((t) => TIMERS[(TIMERS.indexOf(t) + 1) % TIMERS.length]); haptic.tap(); }}
                style={[styles.chip, timer > 0 && styles.chipOn]}
                accessibilityLabel="Self-timer"
              >
                <Timer color="#fff" size={14} />
                <FsText variant="caption" style={styles.white}>{timer ? `${timer}s` : 'Off'}</FsText>
              </Pressable>
            </View>
            <View style={styles.shutterRow}>
              <Pressable onPress={fromLibrary} hitSlop={10} style={styles.sideBtn} accessibilityLabel="Choose from library">
                {saving ? <ActivityIndicator color="#fff" /> : <Images color="#fff" size={24} />}
              </Pressable>
              <Pressable onPress={onShutter} style={styles.shutter} accessibilityLabel={countdown != null ? 'Cancel timer' : 'Take photo'}>
                <View style={[styles.shutterInner, countdown != null && { backgroundColor: colors.danger }]} />
              </Pressable>
              <Pressable onPress={() => { setFacing((f) => (f === 'front' ? 'back' : 'front')); setReady(false); }} hitSlop={10} style={styles.sideBtn} accessibilityLabel="Flip camera">
                <SwitchCamera color="#fff" size={24} />
              </Pressable>
            </View>
            {timer > 0 && countdown == null && (
              <FsText variant="caption" style={[styles.dim, { textAlign: 'center', marginTop: space[2] }]}>
                Tap the shutter, then step back — it fires in {timer}s
              </FsText>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  dim: { color: 'rgba(255,255,255,0.7)' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: space[4],
  },
  roundBtn: {
    minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: space[2],
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  poseSeg: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.full, padding: 3, gap: 2 },
  poseItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.full },
  poseItemOn: { backgroundColor: colors.primary },
  toast: {
    position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.full,
  },
  guideV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  guideH: { position: 'absolute', left: '20%', right: '20%', height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  countdown: { fontSize: 120, lineHeight: 130, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space[4], paddingTop: space[3], backgroundColor: 'rgba(0,0,0,0.35)' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], marginBottom: space[3] },
  dateChip: { minWidth: 130 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space[3], height: 34,
    borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipOn: { backgroundColor: colors.primary },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  sideBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  reviewRow: { flexDirection: 'row', gap: space[2] },
}));
