import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';

import { FEEDBACK_EMAIL, gatherDiagnostics } from '@/lib/diagnostics';
import { colors } from '@/theme/tokens';

/**
 * Last-resort screen when a render error escapes a screen (exported as `ErrorBoundary` from
 * `app/_layout.tsx`, so Expo Router shows it instead of a blank app). Deliberately built from
 * plain RN primitives — no FsText/Button/theme store hooks/safe-area provider — so it still
 * renders when the crash came from the shared UI kit, the theme, or the shell itself.
 *
 * Data is never touched here: everything lives in the on-device SQLite DB, so a crashed render
 * can't lose it. "Email the developer" opens the user's mail app pre-filled (nothing is sent
 * automatically — same private, no-server pattern as Settings → Feedback).
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const message = error?.message || String(error);

  const report = () => {
    let diag = '';
    try {
      const d = gatherDiagnostics();
      diag = `App: ${d.app} ${d.version ?? '?'} (${d.variant})\nDevice: ${d.device ?? 'unknown'} — ${d.platform} ${d.osVersion}`;
    } catch {}
    const stack = (error?.stack ?? '').split('\n').slice(0, 15).join('\n');
    const body =
      'What were you doing when this happened?\n\n\n' +
      '--- Crash details (no personal data) ---\n' +
      `${message}\n\n${stack}\n\n${diag}`;
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Hale crash report')}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {});
  };

  const restart = async () => {
    // A full JS reload clears any bad in-memory state the simple retry can't. expo-updates is
    // loaded lazily so a dev/Expo Go build without it falls back to the plain retry.
    try {
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch {
      retry().catch(() => {});
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          This screen hit an unexpected error. Your data is safe — it’s stored on your phone and
          nothing was lost.
        </Text>

        <Pressable style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => retry().catch(() => {})}>
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.ghost, { borderColor: colors.border }]} onPress={restart}>
          <Text style={[styles.btnText, { color: colors.text }]}>Restart Hale</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.ghost, { borderColor: colors.border }]} onPress={report}>
          <Text style={[styles.btnText, { color: colors.primary }]}>Email the developer</Text>
        </Pressable>

        <Pressable onPress={() => setShowDetails((v) => !v)} hitSlop={8} style={{ marginTop: 24 }}>
          <Text style={[styles.detailsToggle, { color: colors.muted }]}>
            {showDetails ? 'Hide details' : 'Show details'}
          </Text>
        </Pressable>
        {showDetails && (
          <View style={[styles.details, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text selectable style={[styles.mono, { color: colors.text }]}>{message}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  lead: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 12, marginBottom: 28 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  detailsToggle: { textAlign: 'center', fontSize: 13, textDecorationLine: 'underline' },
  details: { marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
});
