import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { Image } from 'react-native';
import { UserCircle, Camera } from 'lucide-react-native';
import { Card, FsText, SectionHeader, Chip, Button } from '@/components/ui';
import { pickAvatar } from '@/lib/avatar';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { useServerStore } from '@/stores/serverStore';
import { useNavStore } from '@/stores/navStore';
import { testServerConnection } from '@/lib/sync';
import { health, healthPlatformLabel } from '@/lib/health';
import { ACTIVITY_DESCRIPTIONS } from '@/lib/tdee';
import { downloadAllMedia } from '@/lib/exerciseMedia';
import { colors, radius, space, themedStyles, SURFACE_PRESETS, ACCENT_PRESETS } from '@/theme/tokens';
import { useThemeStore } from '@/stores/themeStore';
import type { ActivityLevel, Sex, UnitSystem } from '@/types';

const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const ACTIVITIES: ActivityLevel[] = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];

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

  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? '');

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

  const changeAvatar = async () => {
    const uri = await pickAvatar();
    if (uri) setProfile({ avatarUri: uri });
    else Alert.alert('Photo', 'No photo selected (or photos permission is unavailable in this build).');
  };

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const switchUnit = (next: UnitSystem) => setProfile({ unitSystem: next });

  return (
    <>
      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Units" />
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Chip label="Metric (kg, cm)" selected={unit === 'METRIC'} onPress={() => switchUnit('METRIC')} />
          <Chip label="Imperial (lbs)" selected={unit === 'IMPERIAL'} onPress={() => switchUnit('IMPERIAL')} />
        </View>
      </Card>

      <Appearance />

      <Card style={{ marginBottom: space[3] }}>
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
        <Field
          label="Height"
          value={heightCm}
          onChangeText={(t) => { setHeightCm(t); setProfile({ heightCm: num(t) }); }}
          keyboardType="numeric"
          suffix="cm"
          placeholder="178"
        />
        <Field
          label="Birth date (YYYY-MM-DD)"
          value={profile.birthDate ?? ''}
          onChangeText={(t) => setProfile({ birthDate: t || null })}
          placeholder="1995-04-12"
        />
        <FsText variant="caption" style={{ marginBottom: 6 }}>Sex</FsText>
        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[2] }}>
          {SEXES.map((s) => (
            <Chip key={s} label={s[0] + s.slice(1).toLowerCase()} selected={profile.sex === s} onPress={() => setProfile({ sex: s })} />
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Activity Level" />
        <View style={{ gap: space[2] }}>
          {ACTIVITIES.map((a) => (
            <Pressable
              key={a}
              onPress={() => setProfile({ activityLevel: a })}
              style={[styles.optionRow, profile.activityLevel === a && styles.optionRowActive]}
            >
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">{a[0] + a.slice(1).toLowerCase().replace('_', ' ')}</FsText>
                <FsText variant="caption">{ACTIVITY_DESCRIPTIONS[a]}</FsText>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Goals" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Your weight goal, calorie & macro targets, training and nutrient goals all live in one place
          now — the Goals editor (the target icon on Food/Workout/Health, or Dashboard → Goals).
        </FsText>
        <Button title="Edit goals" variant="ghost" onPress={() => setSection('dashboard', 'goals')} />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Tools" />
        <Button title="Open TDEE Calculator" variant="ghost" onPress={() => router.push('/tdee')} />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
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

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title={`Health · ${healthPlatformLabel}`} />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Import weight and steps from {healthPlatformLabel}. Activates in a native build with the
          health plugin enabled (cross-platform: Apple Health on iOS, Health Connect on Android).
        </FsText>
        <Button title={`Connect ${healthPlatformLabel}`} variant="ghost" onPress={connectHealth} />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Server backup &amp; sync" />
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Optional. Point at your self-hosted FitSelf server to test a connection. The app stays
          fully usable offline; full two-way sync is on the roadmap.
        </FsText>
        <Field label="Server URL" value={serverUrl} onChangeText={setServerUrl} placeholder="http://192.168.1.10:3001" />
        <Field label="Access token (optional)" value={serverToken} onChangeText={setServerToken} placeholder="JWT" />
        <Button title={testing ? 'Testing…' : 'Test & save'} onPress={testServer} loading={testing} disabled={testing} />
        {!!server.serverUrl && (
          <Button title="Disconnect" variant="ghost" onPress={() => { server.clearServer(); setServerUrl(''); setServerToken(''); }} style={{ marginTop: space[2] }} />
        )}
      </Card>

    </>
  );
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

/** Theme picker: surface preset + accent (presets or a custom hex). Applies live. */
function Appearance() {
  const preset = useThemeStore((s) => s.preset);
  const accent = useThemeStore((s) => s.accent);
  const setPreset = useThemeStore((s) => s.setPreset);
  const setAccent = useThemeStore((s) => s.setAccent);
  const [hex, setHex] = useState('');
  const hexValid = HEX_RE.test(hex);
  const applyHex = () => { if (hexValid) setAccent(hex.startsWith('#') ? hex.toLowerCase() : `#${hex.toLowerCase()}`); };

  return (
    <Card style={{ marginBottom: space[3] }}>
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
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowActive: { borderColor: colors.primary },
}));
