import { useCallback, useState, type ComponentProps } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { X, Bug, Lightbulb, Camera, Trash2 } from 'lucide-react-native';

import { FsText, Card, Button, Chip } from '@/components/ui';
import { feedbackRepo, type FeedbackEntry, type FeedbackType } from '@/lib/repositories/FeedbackRepo';
import { submitFeedback, FEEDBACK_EMAIL } from '@/lib/feedback';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

type Tab = 'bug' | 'feature' | 'mine';

export default function FeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [tab, setTab] = useState<Tab>(params.type === 'feature' ? 'feature' : params.type === 'mine' ? 'mine' : 'bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [steps, setSteps] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<FeedbackEntry[]>([]);

  const refresh = useCallback(() => setHistory(feedbackRepo.list()), []);
  useFocusEffect(refresh);

  const submit = async (type: FeedbackType) => {
    if (!title.trim()) {
      Alert.alert('Add a title', `A short summary helps me triage your ${type === 'bug' ? 'bug' : 'idea'}.`);
      return;
    }
    setSubmitting(true);
    const ok = await submitFeedback({ type, title, body, steps: type === 'bug' ? steps : undefined });
    setSubmitting(false);
    refresh();
    if (ok) {
      haptic.success();
      setTitle(''); setBody(''); setSteps('');
      Alert.alert('Thanks! 🙌', 'Your mail app is open with everything filled in — just tap send. It’s also saved under “Mine”.');
    } else {
      Alert.alert('No mail app', `Couldn’t open a mail app. Please email me at ${FEEDBACK_EMAIL} — your draft is saved under “Mine”.`);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Send feedback</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <View style={styles.tabs}>
        <Chip label="Report a bug" selected={tab === 'bug'} onPress={() => setTab('bug')} />
        <Chip label="Feature idea" selected={tab === 'feature'} onPress={() => setTab('feature')} />
        <Chip label="Mine" selected={tab === 'mine'} onPress={() => setTab('mine')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {tab === 'bug' && (
          <>
            <Card style={styles.tipCard}>
              <Camera color={colors.primary} size={20} />
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">On TestFlight? Just screenshot.</FsText>
                <FsText variant="caption">Take a screenshot anywhere in the app — TestFlight lets you send it to me with a note, the fastest way to report a bug. Or use the form below.</FsText>
              </View>
            </Card>
            <Field label="What went wrong?" value={title} onChangeText={setTitle} placeholder="Short summary" />
            <Field label="Details" value={body} onChangeText={setBody} placeholder="What happened, and what did you expect?" multiline />
            <Field label="Steps to reproduce (optional)" value={steps} onChangeText={setSteps} placeholder={'1. …\n2. …'} multiline />
            <Button title={submitting ? 'Opening mail…' : 'Send bug report'} onPress={() => submit('bug')} loading={submitting} disabled={submitting} />
          </>
        )}

        {tab === 'feature' && (
          <>
            <Card style={styles.tipCard}>
              <Lightbulb color={colors.primary} size={20} />
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium">Got an idea?</FsText>
                <FsText variant="caption">Tell me what you'd love to see. Community voting on ideas is on the roadmap — for now these come straight to me.</FsText>
              </View>
            </Card>
            <Field label="Your idea" value={title} onChangeText={setTitle} placeholder="Short summary" />
            <Field label="Details" value={body} onChangeText={setBody} placeholder="What should it do, and why would it help?" multiline />
            <Button title={submitting ? 'Opening mail…' : 'Send feature request'} onPress={() => submit('feature')} loading={submitting} disabled={submitting} />
          </>
        )}

        {tab === 'mine' && (
          history.length === 0 ? (
            <Card><FsText variant="caption">Nothing yet. Reports you send are saved here so you can track them.</FsText></Card>
          ) : (
            history.map((f) => (
              <Card key={f.id} style={styles.historyRow}>
                {f.type === 'bug' ? <Bug color={colors.danger} size={18} /> : <Lightbulb color={colors.warning} size={18} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <FsText variant="bodyMedium" numberOfLines={1}>{f.title}</FsText>
                  <FsText variant="caption">
                    {f.type === 'bug' ? 'Bug' : 'Feature'} · {new Date(f.createdAt).toLocaleDateString()} · {f.status === 'sent' ? 'sent' : 'draft'}
                  </FsText>
                </View>
                <Pressable onPress={() => { feedbackRepo.remove(f.id); refresh(); }} hitSlop={8}>
                  <Trash2 color={colors.muted} size={16} />
                </Pressable>
              </Card>
            ))
          )
        )}

        <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[4], color: colors.muted }}>
          Reports open your mail app — nothing is sent automatically. You can also email {FEEDBACK_EMAIL}.
        </FsText>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <FsText variant="caption" style={{ marginBottom: 6 }}>{label}</FsText>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && { minHeight: 92, textAlignVertical: 'top' }]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  tabs: { flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingBottom: space[2] },
  tipCard: { marginBottom: space[3], flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  historyRow: { marginBottom: space[2], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 16 },
}));
