import { useState } from 'react';
import { View, Modal, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Sparkles, Bug, Check } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { getMeta, setMeta } from '@/lib/db';
import { WHATS_NEW, WHATS_NEW_VERSION } from '@/lib/feedback';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const SEEN_KEY = 'whatsNewSeen';

/**
 * "What's new to test" sheet — shows once per `WHATS_NEW_VERSION` (tracked in
 * `app_meta`). Lists what changed and nudges feedback. On non-production builds it
 * adds a "you're on a test build" line; the screenshot tip helps TestFlight testers.
 * Mounted once at the app root (after onboarding).
 */
export function WhatsNew() {
  const router = useRouter();
  const [open, setOpen] = useState(() => getMeta(SEEN_KEY) !== WHATS_NEW_VERSION);
  const isBeta = ((Constants.expoConfig?.extra as Record<string, unknown>)?.appVariant ?? 'production') !== 'production';

  const dismiss = () => { setMeta(SEEN_KEY, WHATS_NEW_VERSION); setOpen(false); };
  const go = (type: 'bug' | 'feature') => { dismiss(); router.push({ pathname: '/feedback', params: { type } }); };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}><Sparkles color={colors.primary} size={28} /></View>
          <FsText variant="h2" style={{ textAlign: 'center' }}>{WHATS_NEW.title}</FsText>
          {isBeta && (
            <FsText variant="caption" style={{ textAlign: 'center', color: colors.primary, marginTop: 4 }}>
              You're on a test build — thanks for helping shape the app. Please report anything that feels off.
            </FsText>
          )}

          <ScrollView style={{ maxHeight: 260, marginVertical: space[3] }}>
            {WHATS_NEW.items.map((it, i) => (
              <View key={i} style={styles.item}>
                <Check color={colors.success} size={16} style={{ marginTop: 2 }} />
                <FsText variant="body" style={{ flex: 1 }}>{it}</FsText>
              </View>
            ))}
          </ScrollView>

          <Card style={styles.tip}>
            <Bug color={colors.danger} size={16} />
            <FsText variant="caption" style={{ flex: 1 }}>
              Found a bug? On TestFlight, just take a screenshot to send it straight to me — or use the form.
            </FsText>
          </Card>

          <View style={{ gap: space[2], marginTop: space[3] }}>
            <Button title="Report a bug" variant="ghost" onPress={() => go('bug')} />
            <Button title="Suggest a feature" variant="ghost" onPress={() => go('feature')} />
            <Button title="Got it" onPress={dismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space[6] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  iconWrap: {
    alignSelf: 'center', width: 56, height: 56, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: space[3],
  },
  item: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start', marginBottom: space[2] },
  tip: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
}));
