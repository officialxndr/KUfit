import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, PanResponder, type LayoutChangeEvent } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Play, Pause, Lock } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { photoRepo } from '@/lib/repositories/PhotoRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveProgressPhotoUri } from '@/lib/progressPhoto';
import { POSES, POSE_LABEL, timelineFor, frameAt, weightNear, daysBetween, isPose, type Pose } from '@/lib/photoTimeline';
import { usePhotoLock } from '@/lib/photoLock';
import { useMotion } from '@/lib/useMotion';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { longDate } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const FRAME_MS = 450;

/**
 * Timelapse of one pose: every photo oldest → newest, full screen. Drag the scrubber to move
 * through time (a light haptic per frame) or press play to watch it. Shows each frame's date, the
 * nearest weigh-in, and the change since the first photo.
 */
export default function PhotoTimelapse() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const { locked, unlock } = usePhotoLock();
  const { animate } = useMotion();
  const params = useLocalSearchParams<{ pose?: string }>();
  const [pose, setPose] = useState<Pose>(isPose(params.pose) ? params.pose : 'front');

  const all = useMemo(() => photoRepo.list(), []);
  const weights = useMemo(() => healthRepo.getWeightEntries('0000-01-01', '9999-12-31'), []);
  const frames = useMemo(() => timelineFor(all, pose), [all, pose]);
  const uris = useMemo(() => frames.map((f) => resolveProgressPhotoUri(f.fileName)), [frames]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Start at the newest frame for a new pose; warm the image cache so scrubbing doesn't flash.
  useEffect(() => {
    setIndex(Math.max(0, frames.length - 1));
    setPlaying(false);
    const list = uris.filter((u): u is string => !!u);
    if (list.length) Image.prefetch(list).catch(() => {});
  }, [frames, uris]);

  // Playback: advance a frame every FRAME_MS; stop on the last frame.
  useEffect(() => {
    if (!playing) return;
    if (index >= frames.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, frames.length - 1)), FRAME_MS);
    return () => clearTimeout(t);
  }, [playing, index, frames.length]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (index >= frames.length - 1) setIndex(0); // replay from the start
    setPlaying(true);
  };

  // Scrubber: map the finger's x along the bar to a frame.
  const bar = useRef({ x: 0, w: 1 });
  const barRef = useRef<View>(null);
  const lastFrame = useRef(-1);
  const countRef = useRef(frames.length);
  countRef.current = frames.length;
  const seek = (pageX: number) => {
    const i = frameAt((pageX - bar.current.x) / bar.current.w, countRef.current);
    if (i !== lastFrame.current) { lastFrame.current = i; haptic.tap(); setIndex(i); }
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { setPlaying(false); seek(e.nativeEvent.pageX); },
    onPanResponderMove: (e) => seek(e.nativeEvent.pageX),
    onPanResponderRelease: () => { lastFrame.current = -1; },
  })).current;
  const onBarLayout = (_e: LayoutChangeEvent) => {
    barRef.current?.measureInWindow((x, _y, w) => { bar.current = { x, w: Math.max(1, w) }; });
  };

  const close = () => router.back();

  if (locked) {
    return (
      <View style={[styles.screen, styles.center, { padding: space[6], gap: space[3] }]}>
        <StatusBar style="light" />
        <Pressable onPress={close} hitSlop={12} style={[styles.roundBtn, { position: 'absolute', top: insets.top + space[2], left: space[4] }]}><X color="#fff" size={22} /></Pressable>
        <Lock color="#fff" size={28} />
        <FsText variant="cardTitle" style={styles.white}>Photos are locked</FsText>
        <Button title="Unlock" onPress={unlock} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  const frame = frames[index];
  const uri = uris[index];
  const w = frame ? weightNear(frame.date, weights) : null;
  const w0 = frames[0] ? weightNear(frames[0].date, weights) : null;
  const delta = w && w0 ? w.weightKg - w0.weightKg : null;
  const day = frame && frames[0] ? daysBetween(frames[0].date, frame.date) : 0;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {uri
        ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={animate ? 140 : 0} />
        : <View style={[StyleSheet.absoluteFill, styles.center]}><FsText variant="caption" style={styles.dim}>{frames.length ? 'Photo unavailable' : `No ${POSE_LABEL[pose].toLowerCase()} photos yet`}</FsText></View>}

      {/* Top: close + pose switcher */}
      <View style={[styles.topBar, { paddingTop: insets.top + space[2] }]}>
        <Pressable onPress={close} hitSlop={12} style={styles.roundBtn}><X color="#fff" size={22} /></Pressable>
        <View style={styles.seg}>
          {POSES.map((p) => (
            <Pressable key={p} onPress={() => setPose(p)} style={[styles.segItem, pose === p && styles.segItemOn]}>
              <FsText variant="caption" style={pose === p ? styles.white : styles.dim}>{POSE_LABEL[p]}</FsText>
            </Pressable>
          ))}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Bottom: caption + scrubber + play */}
      {frames.length > 0 && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space[4] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: space[3] }}>
            <View style={{ flex: 1 }}>
              <FsText variant="cardTitle" style={styles.white}>{frame ? longDate(frame.date) : ''}</FsText>
              <FsText variant="caption" style={styles.dim}>
                {index === 0 ? 'First photo' : `Day ${day}`}{w ? ` · ${formatWeight(w.weightKg, unit)}` : ''}
                {delta != null && index > 0 ? ` (${delta > 0 ? '+' : ''}${formatWeight(delta, unit)})` : ''}
              </FsText>
            </View>
            <FsText variant="caption" style={styles.dim}>{index + 1} / {frames.length}</FsText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Pressable onPress={togglePlay} style={styles.playBtn} accessibilityLabel={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause color="#000" size={20} fill="#000" /> : <Play color="#000" size={20} fill="#000" />}
            </Pressable>
            <View ref={barRef} onLayout={onBarLayout} style={styles.scrubHit} {...pan.panHandlers}>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${frames.length > 1 ? (index / (frames.length - 1)) * 100 : 100}%` }]} />
              </View>
              {/* One tick per photo, so gaps in the routine are visible. */}
              <View style={styles.ticks} pointerEvents="none">
                {frames.map((f, i) => (
                  <View key={f.id} style={[styles.tick, { left: `${frames.length > 1 ? (i / (frames.length - 1)) * 100 : 50}%` }, i === index && styles.tickOn]} />
                ))}
              </View>
            </View>
          </View>
        </View>
      )}
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
  roundBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.full, padding: 3, gap: 2 },
  segItem: { paddingHorizontal: space[3], paddingVertical: 6, borderRadius: radius.full },
  segItemOn: { backgroundColor: colors.primary },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space[4], paddingTop: space[4], backgroundColor: 'rgba(0,0,0,0.45)' },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  scrubHit: { flex: 1, height: 44, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.primary },
  ticks: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  tick: { position: 'absolute', top: 16, width: 2, height: 12, marginLeft: -1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  tickOn: { backgroundColor: '#fff', height: 16, top: 14 },
}));
