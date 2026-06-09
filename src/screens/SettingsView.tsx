import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, Switch, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { Image } from 'react-native';
import { UserCircle, Camera, Heart, Search, X, ExternalLink } from 'lucide-react-native';
import Constants from 'expo-constants';
import { Card, FsText, SectionHeader, Chip, Button } from '@/components/ui';
import { SwipeToConfirm } from '@/components/SwipeToConfirm';
import { useDevStore } from '@/stores/devStore';
import { useRefreshStore } from '@/stores/refreshStore';
import { loadDemoData, clearLoggedData } from '@/lib/demoSeed';
import { REST_END_HAPTICS, fireDiagnosticHaptic, playRestEndHaptic } from '@/lib/haptics';
import { applyAccentIcon, iconMatchesAccent } from '@/lib/appIcon';
import { sendTestNotification } from '@/lib/reminders';
import { writeAndShareBackup, importFromUri, wipeAllData } from '@/lib/backup';
import { pickAvatar } from '@/lib/avatar';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTourStore } from '@/stores/tourStore';
import { useActiveCaloriesStore } from '@/stores/activeCaloriesStore';
import { DateField } from '@/components/DateField';
import { HeightField } from '@/components/HeightField';
import { useServerStore } from '@/stores/serverStore';
import { useNavStore } from '@/stores/navStore';
import { testServerConnection } from '@/lib/sync';
import { health, healthPlatformLabel } from '@/lib/health';
import { downloadAllMedia } from '@/lib/exerciseMedia';
import { colors, radius, space, themedStyles, SURFACE_PRESETS, ACCENT_PRESETS } from '@/theme/tokens';
import { useThemeStore } from '@/stores/themeStore';
import type { ActiveCalorieSource, Sex, UnitSystem } from '@/types';

// Donation link — opens in the browser (no in-app payment, to stay within Apple's
// rules; external donations are 0% on Android and exempt from Apple's IAP cut).
const SUPPORT_URL = 'https://ko-fi.com/haleapp';

// Searchable keywords per Settings section — synonyms a user might type, so the search
// matches intent ("dark" → Appearance, "backup" → Data, "calorie" → Health) not just titles.
const T = {
  units: 'units metric imperial kg lbs pounds cm centimeters measurement system',
  appearance: 'appearance theme dark light mode colour color accent scheme display',
  profile: 'profile name height birth date birthday age sex gender avatar photo picture',
  body: 'body composition fat navy estimate dexa lean mass percentage tape measurement',
  goals: 'goals goal weight target calorie calories macro macros protein carbs fat phase tdee maintenance calculator body fat activity level sedentary light moderate active very',
  help: 'help tour guide guided walkthrough onboarding tutorial intro feature guide docs documentation reference manual search how to explain features',
  feedback: 'feedback bug report issue problem crash feature request idea suggestion contact developer',
  support: 'support hale donate donation contribute tip sponsor give back',
  data: 'data backup export import restore merge replace wipe delete erase reset',
  offline: 'offline download demos gifs exercise media cache',
  health: 'health apple healthkit health connect steps active calories watch import weight body fat navy estimate',
  coaching: 'coaching reminders nudges prompts workout summary recap warnings',
  motion: 'motion animation animations confetti celebration reduce transitions',
  notifications: 'notifications reminders alerts schedule notify food weight measurement',
  devices: 'devices bluetooth scale kitchen food weigh grams renpho etekcity connect tare',
  server: 'server backup sync self hosted url token connection',
  developer: 'developer dev demo data sample seed debug haptic haptics vibration rest test notification notifications push',
  about: 'about credits attribution acknowledgements licenses exercise food data source exercisedb ascendapi open food facts odbl legal',
} as const;

const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const ACTIVE_CAL_SOURCES: { key: ActiveCalorieSource; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'auto', label: 'Automatic' },
  { key: 'watch', label: 'Watch only' },
  { key: 'inapp', label: 'In-app only' },
];

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  suffix?: string;
}) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <FsText variant="caption" style={{ marginBottom: 6 }}>{label}</FsText>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          style={styles.input}
        />
        {suffix ? <FsText variant="caption">{suffix}</FsText> : null}
      </View>
    </View>
  );
}

export function SettingsView() {
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const setSection = useNavStore((s) => s.setSection);
  const router = useRouter();
  const unit = profile.unitSystem;

  // Hidden developer tools — only in development builds, so the shipped App Store
  // build never exposes them. Tap the version footer 7× to unlock the demo-data card.
  const devMode = useDevStore((s) => s.devMode);
  const setDevMode = useDevStore((s) => s.setDevMode);

  // ── Settings search — filters which section cards render ──
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const show = (terms: string) => q === '' || terms.includes(q);
  const [versionTaps, setVersionTaps] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const devUnlocked = __DEV__ && devMode;

  // Whether any visible section matches the query (developer card only counts if unlocked).
  const noResults = q !== '' && ![
    T.units, T.appearance, T.profile, T.body, T.goals, T.help, T.support,
    T.data, T.offline, T.health, T.coaching, T.motion, T.notifications, T.server, T.about,
    ...(devUnlocked ? [T.developer] : []),
  ].some(show);

  const tapVersion = () => {
    if (!__DEV__ || devMode) return;
    const n = versionTaps + 1;
    setVersionTaps(n);
    if (n >= 7) {
      setVersionTaps(0);
      setDevMode(true);
      Alert.alert('Developer tools', 'Demo-data tools are now available at the bottom of Settings.');
    }
  };

  const openSupport = () => { WebBrowser.openBrowserAsync(SUPPORT_URL).catch(() => {}); };
  const openExerciseDb = () => { WebBrowser.openBrowserAsync('https://ascendapi.com').catch(() => {}); };
  const openOpenFoodFacts = () => { WebBrowser.openBrowserAsync('https://world.openfoodfacts.org').catch(() => {}); };

  // ── Data backup / restore / wipe ──
  const [busy, setBusy] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeAck, setWipeAck] = useState(false);

  const onExport = () => { writeAndShareBackup().catch((e) => Alert.alert('Export', `Couldn't export: ${String(e)}`)); };

  const runImport = async (uri: string, mode: 'replace' | 'merge') => {
    setBusy(true);
    try {
      await importFromUri(uri, mode);
      useRefreshStore.getState().bump();
      Alert.alert('Import complete', mode === 'replace' ? 'Your backup was restored.' : 'Records were merged into your data.');
    } catch (e) {
      Alert.alert('Import failed', String(e));
    } finally { setBusy(false); }
  };

  const onImport = async () => {
    let DocumentPicker: typeof import('expo-document-picker');
    try { DocumentPicker = await import('expo-document-picker'); }
    catch { Alert.alert('Import', 'Backup import needs a dev build of the app — rebuild and try again.'); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      Alert.alert('Import data', 'How should this backup be applied?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge (add records)', onPress: () => runImport(uri, 'merge') },
        {
          text: 'Replace all', style: 'destructive',
          onPress: () => Alert.alert('Replace everything?', 'This deletes your current data and restores the backup. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Replace', style: 'destructive', onPress: () => runImport(uri, 'replace') },
          ]),
        },
      ]);
    } catch (e) {
      Alert.alert('Import', `Couldn't read that file: ${String(e)}`);
    }
  };

  const onWipe = () => {
    setWipeOpen(false);
    setWipeAck(false);
    try { wipeAllData(); router.replace('/onboarding'); }
    catch (e) { Alert.alert('Wipe', String(e)); }
  };

  const runSeed = (fn: () => void, doneMsg: string) => {
    setSeeding(true);
    // Defer so the loading state paints before the synchronous SQLite work runs.
    setTimeout(() => {
      try { fn(); Alert.alert('Demo data', doneMsg); }
      catch (e) { Alert.alert('Demo data', `Something went wrong: ${String(e)}`); }
      finally { setSeeding(false); }
    }, 60);
  };
  const onLoadDemo = () => runSeed(loadDemoData, 'Sample data loaded across food, workouts, weight and measurements.');
  const onClearDemo = () => Alert.alert('Clear logged data?', 'Removes all food logs, workouts, weigh-ins and measurements. Your profile, goals and theme are kept.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => runSeed(clearLoggedData, 'Logged data cleared.') },
  ]);
  const onTestNotification = async () => {
    const result = await sendTestNotification();
    Alert.alert(
      result === 'sent' ? 'Test notification scheduled' : result === 'denied' ? 'Notifications are off' : 'Unavailable',
      result === 'sent'
        ? 'It should arrive in ~2 seconds — lock your screen to see it on the Lock Screen too.'
        : result === 'denied'
          ? 'Notifications aren’t permitted. Enable them for Hale in iOS Settings, then try again.'
          : 'Notifications need a dev/native build (they’re a no-op in Expo Go).'
    );
  };

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  const downloadDemos = async () => {
    setDownloading(true);
    setDownloadProgress('Starting…');
    const res = await downloadAllMedia((done, total) => {
      if (done % 25 === 0 || done === total) setDownloadProgress(`${done} / ${total}`);
    });
    setDownloading(false);
    setDownloadProgress('');
    Alert.alert('Offline demos', `Cached media for ${res.total} exercises.`);
  };

  const server = useServerStore();
  const [serverUrl, setServerUrl] = useState(server.serverUrl ?? '');
  const [serverToken, setServerToken] = useState(server.accessToken ?? '');
  const [testing, setTesting] = useState(false);

  const testServer = async () => {
    setTesting(true);
    const res = await testServerConnection(serverUrl);
    setTesting(false);
    if (res.ok) {
      server.setServer(serverUrl.trim().replace(/\/+$/, ''), serverToken.trim());
      Alert.alert('Server', res.message);
    } else {
      Alert.alert('Server', res.message);
    }
  };

  const connectHealth = async () => {
    if (!health.isAvailable()) {
      Alert.alert(healthPlatformLabel, `${healthPlatformLabel} isn't available in this build. It activates after a native rebuild with the health module + permissions.`);
      return;
    }
    const ok = await health.requestPermissions();
    if (!ok) {
      Alert.alert(healthPlatformLabel, 'Permission was denied or the health store is unavailable.');
      return;
    }
    const all = await health.getAllWeights();
    if (all.length) {
      // Keep one entry per day (latest wins) to match the app's one-weigh-in-per-day model.
      const byDay = new Map(all.map((w) => [w.date, w.weightKg]));
      byDay.forEach((kg, date) => healthRepo.upsertWeightEntry(date, kg));
      Alert.alert(healthPlatformLabel, `Connected. Imported ${byDay.size} weigh-in${byDay.size === 1 ? '' : 's'} from your history.`);
    } else {
      Alert.alert(healthPlatformLabel, 'Connected. No weight history was found to import.');
    }
  };

  const selectActiveCalSource = (key: ActiveCalorieSource) => {
    setProfile({ activeCalorieSource: key });
    if ((key === 'auto' || key === 'watch') && !health.isAvailable()) {
      Alert.alert(healthPlatformLabel, `${healthPlatformLabel} isn't available in this build, so the app's workout estimate will be used. Connect ${healthPlatformLabel} in a native build for watch data.`);
    } else if (key === 'auto' || key === 'watch') {
      health.requestPermissions().catch(() => {});
    }
    useActiveCaloriesStore.getState().refresh(key);
  };

  const changeAvatar = async () => {
    const uri = await pickAvatar();
    if (uri) setProfile({ avatarUri: uri });
    else Alert.alert('Photo', 'No photo selected (or photos permission is unavailable in this build).');
  };

  const switchUnit = (next: UnitSystem) => setProfile({ unitSystem: next });

  return (
    <>
      <View style={styles.searchRow}>
        <Search color={colors.muted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search settings"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query !== '' && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.muted} size={18} />
          </Pressable>
        )}
      </View>

      {noResults && (
        <Card style={{ marginBottom: space[3] }}>
          <FsText variant="caption">No settings match “{query.trim()}”.</FsText>
        </Card>
      )}

      <Card hidden={!show(T.units)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Units" />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Chip label="Metric (kg, cm)" selected={unit === 'METRIC'} onPress={() => switchUnit('METRIC')} />
          <Chip label="Imperial (lbs)" selected={unit === 'IMPERIAL'} onPress={() => switchUnit('IMPERIAL')} />
        </View>
      </Card>

      <Appearance hidden={!show(T.appearance)} />

      <Card hidden={!show(T.motion)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Motion" />
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, marginRight: space[3] }}>
            <FsText variant="bodyMedium">Animations</FsText>
            <FsText variant="caption">Screen transitions, count-ups and micro-interactions. Also respects your device's Reduce Motion setting.</FsText>
          </View>
          <Switch
            value={profile.animationsEnabled}
            onValueChange={(v) => setProfile({ animationsEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, marginRight: space[3] }}>
            <FsText variant="bodyMedium">Celebration confetti</FsText>
            <FsText variant="caption">A confetti burst on big wins (goal weight, new PRs).</FsText>
          </View>
          <Switch
            value={profile.confettiEnabled}
            onValueChange={(v) => setProfile({ confettiEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View style={{ marginTop: space[3] }}>
          <FsText variant="bodyMedium">Rest timer alert</FsText>
          <FsText variant="caption" style={{ marginBottom: space[2] }}>
            The ~3-second vibration when a rest timer finishes. Tap one to feel it.
          </FsText>
          <View style={styles.sourceRow}>
            {REST_END_HAPTICS.map((h) => (
              <Chip
                key={h.key}
                label={h.label}
                selected={profile.restEndHaptic === h.key}
                onPress={() => { setProfile({ restEndHaptic: h.key }); playRestEndHaptic(h.key); }}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card hidden={!show(T.profile)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Profile" />
        <Pressable onPress={changeAvatar} style={styles.avatarRow}>
          {profile.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}><UserCircle color={colors.muted} size={36} /></View>
          )}
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium">Profile photo</FsText>
            <FsText variant="caption">Tap to {profile.avatarUri ? 'change' : 'add'} your picture</FsText>
          </View>
          <Camera color={colors.primary} size={20} />
        </Pressable>
        <Field label="Name" value={profile.name ?? ''} onChangeText={(t) => setProfile({ name: t || null })} placeholder="Your name" />
        <FsText variant="caption" style={{ marginBottom: 6 }}>Height</FsText>
        <View style={{ marginBottom: space[3] }}>
          <HeightField valueCm={profile.heightCm} onChange={(cm) => setProfile({ heightCm: cm })} system={unit} />
        </View>
        <FsText variant="caption" style={{ marginBottom: 6 }}>Birth date</FsText>
        <View style={{ marginBottom: space[3] }}>
          <DateField
            value={profile.birthDate ?? null}
            onChange={(v) => setProfile({ birthDate: v })}
            placeholder="Select your birth date"
            minYear={1900}
            maxYear={new Date().getFullYear()}
            mode="cascade"
          />
        </View>
        <FsText variant="caption" style={{ marginBottom: 6 }}>Sex</FsText>
        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[2] }}>
          {SEXES.map((s) => (
            <Chip key={s} label={s[0] + s.slice(1).toLowerCase()} selected={profile.sex === s} onPress={() => setProfile({ sex: s })} />
          ))}
        </View>
      </Card>

      <Card hidden={!show(T.body)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Body composition" />
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, marginRight: space[3] }}>
            <FsText variant="bodyMedium">U.S. Navy body-fat estimate</FsText>
            <FsText variant="caption">When you haven't entered a measured body-fat %, estimate it from your neck/waist/hip tape measurements (U.S. Navy formula). Turn off to show only body-fat values you log yourself (or from a DEXA baseline).</FsText>
          </View>
          <Switch
            value={profile.navyBodyFatEnabled}
            onValueChange={(v) => setProfile({ navyBodyFatEnabled: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Card>

      <Card hidden={!show(T.goals)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Goals" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Your weight goal, activity level, calorie & macro targets, training and nutrient goals all live
          in one place now — the Goals editor (the target icon on Food/Workout/Health, or Dashboard → Goals).
        </FsText>
        <Button title="Edit goals" variant="ghost" onPress={() => setSection('dashboard', 'goals')} />
      </Card>

      <Card hidden={!show(T.health)} style={{ marginBottom: space[3] }}>
        <SectionHeader title={`Health · ${healthPlatformLabel}`} />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Import weight and steps from {healthPlatformLabel}. Activates in a native build with the
          health plugin enabled (cross-platform: Apple Health on iOS, Health Connect on Android).
        </FsText>
        <Button title={`Connect ${healthPlatformLabel}`} variant="ghost" onPress={connectHealth} />

        <View style={{ marginTop: space[4] }}>
          <FsText variant="bodyMedium">Add active calories to budget</FsText>
          <FsText variant="caption" style={{ marginTop: 2, marginBottom: space[2] }}>
            Eat back calories burned. Automatic uses {healthPlatformLabel} (watch) data and falls back to
            the app's workout estimate for anything it didn't track.
          </FsText>
          <View style={styles.sourceRow}>
            {ACTIVE_CAL_SOURCES.map((opt) => (
              <Chip
                key={opt.key}
                label={opt.label}
                selected={profile.activeCalorieSource === opt.key}
                onPress={() => selectActiveCalSource(opt.key)}
              />
            ))}
          </View>
        </View>

      </Card>

      <Card hidden={!show(T.help)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Help" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          New here, or want a refresher? Browse the searchable feature guide, or take a guided tour —
          a quick Basic run, the full Advanced walkthrough, or just one section.
        </FsText>
        <Button title="Feature guide" variant="ghost" onPress={() => router.push('/guide')} />
        <Button title="Take the app tour" variant="ghost" onPress={() => useTourStore.getState().openMenu()} style={{ marginTop: space[2] }} />
      </Card>

      <Card hidden={!show(T.feedback)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Feedback" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Hit a bug or have an idea? Send it my way — it shapes what gets built next. (On a TestFlight build
          you can also just take a screenshot to report a bug instantly.)
        </FsText>
        <Button title="Send feedback" variant="ghost" onPress={() => router.push('/feedback')} />
      </Card>

      <Card hidden={!show(T.data)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Data &amp; backup" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Your data lives only on this device. Export a backup file you can keep anywhere, then import it to
          restore or merge — on this device or a new one.
        </FsText>
        <Button title="Export data" onPress={onExport} disabled={busy} />
        <Button title={busy ? 'Working…' : 'Import data'} variant="ghost" onPress={onImport} loading={busy} disabled={busy} style={{ marginTop: space[2] }} />
        <Button title="Wipe all data" variant="ghost" onPress={() => { setWipeAck(false); setWipeOpen(true); }} disabled={busy} style={{ marginTop: space[2] }} />
      </Card>

      <Card hidden={!show(T.offline)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Offline" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Download all exercise demo GIFs to this device so the library works without internet.
        </FsText>
        <Button
          title={downloading ? `Downloading… ${downloadProgress}` : 'Download exercise demos'}
          onPress={downloadDemos}
          loading={downloading}
          disabled={downloading}
        />
      </Card>

      <Card hidden={!show(T.coaching)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Coaching &amp; reminders" />
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, marginRight: space[3] }}>
            <FsText variant="bodyMedium">Show goal-coaching prompts</FsText>
            <FsText variant="caption">Reminders to cut calories or add workouts when you're behind pace. Safety warnings always show.</FsText>
          </View>
          <Switch
            value={profile.showCoachingNudges}
            onValueChange={(v) => setProfile({ showCoachingNudges: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, marginRight: space[3] }}>
            <FsText variant="bodyMedium">Show workout summary</FsText>
            <FsText variant="caption">The celebratory recap shown after you finish a workout.</FsText>
          </View>
          <Switch
            value={profile.showWorkoutSummary}
            onValueChange={(v) => setProfile({ showWorkoutSummary: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Card>

      <Card hidden={!show(T.notifications)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Notifications &amp; reminders" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Reminders to measure your body, log your weight or food, and train — each with its own
          schedule. Off until you turn them on.
        </FsText>
        <Button title="Manage reminders" variant="ghost" onPress={() => router.push('/reminders')} />
      </Card>

      <Card hidden={!show(T.devices)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Bluetooth scale" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Connect a Bluetooth food scale to weigh foods straight into the app — the live weight fills
          the amount as you add or remove food. Connect &amp; test it here (needs a dev build; a
          simulator is built in to preview).
        </FsText>
        <Button title="Connect &amp; test scale" variant="ghost" onPress={() => router.push('/scale')} />
      </Card>

      <Card hidden={!show(T.server)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Server backup &amp; sync" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Optional. Point at your self-hosted Hale server to test a connection. The app stays
          fully usable offline; full two-way sync is on the roadmap.
        </FsText>
        <Field label="Server URL" value={serverUrl} onChangeText={setServerUrl} placeholder="http://192.168.1.10:3001" />
        <Field label="Access token (optional)" value={serverToken} onChangeText={setServerToken} placeholder="JWT" />
        <Button title={testing ? 'Testing…' : 'Test & save'} onPress={testServer} loading={testing} disabled={testing} />
        {!!server.serverUrl && (
          <Button title="Disconnect" variant="ghost" onPress={() => { server.clearServer(); setServerUrl(''); setServerToken(''); }} style={{ marginTop: space[2] }} />
        )}
      </Card>

      <Card hidden={!show(T.support)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="Support Hale" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Hale is free with no ads, no account, and nothing locked behind a paywall. If it helps you,
          an optional donation keeps it free for everyone and covers the developer costs — never required.
        </FsText>
        <Pressable onPress={openSupport} style={styles.supportBtn}>
          <Heart color={colors.white} size={18} />
          <FsText variant="bodyMedium" style={{ color: colors.white, fontWeight: '600' }}>Donate / support development</FsText>
        </Pressable>
      </Card>

      {devUnlocked && show(T.developer) && (
        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="Developer" />
          <FsText variant="caption" style={{ marginBottom: space[3] }}>
            Demo data for screenshots & the feature tour. Loading replaces any logged data with ~10 weeks of realistic sample activity.
          </FsText>
          <Button title={seeding ? 'Working…' : 'Load sample data'} onPress={onLoadDemo} loading={seeding} disabled={seeding} />
          <Button title="Clear logged data" variant="ghost" onPress={onClearDemo} disabled={seeding} style={{ marginTop: space[2] }} />

          <View style={styles.devDivider} />
          <FsText variant="bodyMedium" style={{ marginBottom: space[1] }}>Haptics</FsText>
          <FsText variant="caption" style={{ marginBottom: space[2] }}>
            The rest-end vibration is chosen in Motion above. This checks the haptics engine.
          </FsText>
          <Button
            title="Feel nothing? Diagnose haptics"
            variant="ghost"
            onPress={async () => {
              try {
                await fireDiagnosticHaptic();
                Alert.alert(
                  'Haptic sent',
                  'If you felt nothing: check Settings → Sounds & Haptics → System Haptics is on, you’re not in Low Power Mode, and the app is in the foreground (iOS never plays haptics in the background). If it still fails, rebuild the app.'
                );
              } catch (e) {
                Alert.alert('Haptics unavailable', `The native haptics module isn’t responding — rebuild the app (npx expo run:ios --device).\n\n${String(e)}`);
              }
            }}
            style={{ marginTop: space[2] }}
          />

          <View style={styles.devDivider} />
          <FsText variant="bodyMedium" style={{ marginBottom: space[1] }}>Notifications</FsText>
          <FsText variant="caption" style={{ marginBottom: space[2] }}>
            Fires a one-off local notification to confirm permission + delivery (needs a dev/native build).
          </FsText>
          <Button title="Send test notification" variant="ghost" onPress={onTestNotification} />

          <View style={styles.devDivider} />
          <Button title="Turn off developer tools" variant="ghost" onPress={() => setDevMode(false)} disabled={seeding} />
        </Card>
      )}

      <Card hidden={!show(T.about)} style={{ marginBottom: space[3] }}>
        <SectionHeader title="About & credits" />
        <FsText variant="caption" style={{ marginBottom: space[2] }}>
          Exercise data, images, and demo GIFs are provided by ExerciseDB, built by AscendAPI.
        </FsText>
        <Pressable onPress={openExerciseDb} style={styles.creditRow}>
          <FsText variant="bodyMedium" style={{ color: colors.primary, fontWeight: '600' }}>ExerciseDB · AscendAPI</FsText>
          <ExternalLink color={colors.primary} size={16} />
        </Pressable>
        <FsText variant="caption" style={{ marginTop: space[4], marginBottom: space[2] }}>
          Food & barcode data contains information from Open Food Facts, made available under the Open Database License (ODbL).
        </FsText>
        <Pressable onPress={openOpenFoodFacts} style={styles.creditRow}>
          <FsText variant="bodyMedium" style={{ color: colors.primary, fontWeight: '600' }}>Open Food Facts</FsText>
          <ExternalLink color={colors.primary} size={16} />
        </Pressable>
      </Card>

      {q === '' && (
        <Pressable onPress={tapVersion} style={{ alignItems: 'center', paddingVertical: space[4] }}>
          <FsText variant="caption" style={{ color: colors.muted }}>Hale v{appVersion}</FsText>
        </Pressable>
      )}

      {/* Wipe-all confirm: acknowledge toggle + slide-to-confirm so it can't be accidental. */}
      <Modal visible={wipeOpen} transparent animationType="fade" onRequestClose={() => setWipeOpen(false)}>
        <View style={styles.wipeBackdrop}>
          <Card style={styles.wipeCard}>
            <SectionHeader title="Wipe all data" />
            <FsText variant="caption" style={{ marginBottom: space[4] }}>
              This permanently deletes all your food logs, workouts, weigh-ins, measurements, recipes, goals
              and profile, and returns the app to first-run setup. This cannot be undone — export a backup
              first if you want to keep it.
            </FsText>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: space[3] }}>
                <FsText variant="bodyMedium">I understand this is permanent</FsText>
              </View>
              <Switch value={wipeAck} onValueChange={setWipeAck} trackColor={{ true: colors.danger, false: colors.border }} />
            </View>
            <View style={{ marginTop: space[4] }}>
              <SwipeToConfirm label="Slide to wipe everything" disabled={!wipeAck} onConfirm={onWipe} />
            </View>
            <Button title="Cancel" variant="ghost" onPress={() => setWipeOpen(false)} style={{ marginTop: space[3] }} />
          </Card>
        </View>
      </Modal>
    </>
  );
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

/** Theme picker: surface preset + accent (presets or a custom hex). Applies live. */
function Appearance({ hidden }: { hidden?: boolean }) {
  const preset = useThemeStore((s) => s.preset);
  const accent = useThemeStore((s) => s.accent);
  const setPreset = useThemeStore((s) => s.setPreset);
  const setAccent = useThemeStore((s) => s.setAccent);
  const [hex, setHex] = useState('');
  const [, setIconBump] = useState(0); // re-render the "Match app icon" button after a swap
  const hexValid = HEX_RE.test(hex);
  const applyHex = () => { if (hexValid) setAccent(hex.startsWith('#') ? hex.toLowerCase() : `#${hex.toLowerCase()}`); };

  return (
    <Card hidden={hidden} style={{ marginBottom: space[3] }}>
      <SectionHeader title="Appearance" />
      <FsText variant="caption" style={{ marginBottom: space[2] }}>Theme</FsText>
      <View style={styles.themeRow}>
        {Object.values(SURFACE_PRESETS).map((p) => {
          const on = preset === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPreset(p.key)}
              style={[styles.themeSwatch, { backgroundColor: p.surface.surface, borderColor: on ? colors.primary : p.surface.border }]}
            >
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <View style={[styles.themeDot, { backgroundColor: p.surface.bg }]} />
                <View style={[styles.themeDot, { backgroundColor: p.surface.surfaceHigh }]} />
                <View style={[styles.themeDot, { backgroundColor: colors.primary }]} />
              </View>
              <FsText variant="caption" style={{ color: p.surface.text, marginTop: 6, fontWeight: on ? '700' : '400' }}>{p.label}</FsText>
            </Pressable>
          );
        })}
      </View>

      <FsText variant="caption" style={{ marginTop: space[3], marginBottom: space[2] }}>Accent</FsText>
      <View style={styles.accentRow}>
        {ACCENT_PRESETS.map((a) => {
          const on = accent === a.key;
          return (
            <Pressable key={a.key} onPress={() => setAccent(a.key)} style={[styles.accentSwatch, { backgroundColor: a.hex, borderColor: on ? colors.text : 'transparent' }]} />
          );
        })}
      </View>
      <View style={styles.hexRow}>
        <View style={[styles.accentSwatch, { backgroundColor: hexValid ? (hex.startsWith('#') ? hex : `#${hex}`) : colors.surfaceHigh, borderColor: colors.border }]} />
        <TextInput
          value={hex}
          onChangeText={setHex}
          placeholder="custom #hex"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.hexInput}
        />
        <Button title="Set" variant="ghost" onPress={applyHex} disabled={!hexValid} />
      </View>

      {Platform.OS === 'ios' && (
        <>
          <Button
            title={iconMatchesAccent(accent) ? 'App icon matches accent ✓' : 'Match app icon to accent'}
            variant="ghost"
            onPress={() => { applyAccentIcon(accent); setIconBump((n) => n + 1); }}
            style={{ marginTop: space[3] }}
          />
          <FsText variant="caption" style={{ color: colors.muted, marginTop: space[1] }}>
            Sets the iOS app icon background to your accent color. Preset accents only — a custom color
            uses the default icon.
          </FsText>
        </>
      )}
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, marginBottom: space[3],
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 15 },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 13,
  },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  devDivider: { height: 1, backgroundColor: colors.border, marginVertical: space[4] },
  wipeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space[4] },
  wipeCard: { borderWidth: 1, borderColor: colors.danger },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: space[3] },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  themeSwatch: {
    paddingHorizontal: space[3], paddingVertical: space[3], borderRadius: radius.md,
    borderWidth: 2, alignItems: 'center', minWidth: 84,
  },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  accentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[3] },
  accentSwatch: { width: 30, height: 30, borderRadius: radius.full, borderWidth: 2 },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  hexInput: {
    flex: 1, color: colors.text, backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] },
  avatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.surfaceHigh },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
}));
