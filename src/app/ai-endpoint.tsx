import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button, Chip } from '@/components/ui';
import { useSettingsStore, type AiEndpoint } from '@/stores/settingsStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Add / edit one saved remote AI endpoint (Settings → AI vision → API/cloud). Each is
 * OpenAI-compatible (Ollama / LM Studio / OpenWebUI / OpenAI / OpenRouter) or Gemini, with
 * its own nickname / URL / key / model — so several can be kept and switched between.
 */
export default function AiEndpointEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const existing = profile.aiEndpoints.find((e) => e.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<AiEndpoint['kind']>(existing?.kind ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [model, setModel] = useState(existing?.model ?? '');

  const save = () => {
    if (!model.trim()) { Alert.alert('Model required', 'Enter the model name (e.g. qwen2.5vl, gpt-4o-mini, gemini-2.0-flash).'); return; }
    if (kind === 'openai' && !baseUrl.trim()) { Alert.alert('Base URL required', 'Enter the endpoint base URL ending in /v1.'); return; }
    if (kind === 'gemini' && !apiKey.trim()) { Alert.alert('API key required', 'Enter your Google API key.'); return; }
    const ep: AiEndpoint = {
      id: existing?.id ?? newId(),
      name: name.trim() || (kind === 'gemini' ? 'Gemini' : 'Endpoint'),
      kind, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim(),
    };
    const list = existing ? profile.aiEndpoints.map((e) => (e.id === ep.id ? ep : e)) : [...profile.aiEndpoints, ep];
    setProfile({ aiEndpoints: list, aiActiveEndpointId: ep.id }); // saved endpoint becomes the active one
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete endpoint?', `Remove "${existing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          const list = profile.aiEndpoints.filter((e) => e.id !== existing.id);
          setProfile({ aiEndpoints: list, aiActiveEndpointId: profile.aiActiveEndpointId === existing.id ? (list[0]?.id ?? null) : profile.aiActiveEndpointId });
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">{existing ? 'Edit endpoint' : 'Add endpoint'}</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[8], gap: space[3] }} keyboardShouldPersistTaps="handled">
          <Field label="Nickname"><TextInput value={name} onChangeText={setName} placeholder="My Ollama" placeholderTextColor={colors.muted} style={styles.input} /></Field>

          <View style={{ gap: 6 }}>
            <FsText variant="caption">Type</FsText>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Chip label="OpenAI-compatible" selected={kind === 'openai'} onPress={() => setKind('openai')} />
              <Chip label="Gemini" selected={kind === 'gemini'} onPress={() => setKind('gemini')} />
            </View>
            <FsText variant="caption" style={{ color: colors.muted }}>
              {kind === 'openai'
                ? 'Ollama, LM Studio, OpenWebUI, OpenAI, OpenRouter — anything with /v1/chat/completions. Use a vision model.'
                : 'Google Gemini — get a free key at aistudio.google.com.'}
            </FsText>
          </View>

          {kind === 'openai' && (
            <Field label="Base URL">
              <TextInput value={baseUrl} onChangeText={setBaseUrl} placeholder="http://192.168.1.10:11434/v1"
                autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholderTextColor={colors.muted} style={styles.input} />
            </Field>
          )}
          <Field label={kind === 'gemini' ? 'API key' : 'API key (optional for local servers)'}>
            <TextInput value={apiKey} onChangeText={setApiKey} placeholder={kind === 'gemini' ? 'AIza…' : 'sk-… (blank for Ollama / LM Studio)'}
              secureTextEntry autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.muted} style={styles.input} />
          </Field>
          <Field label="Model">
            <TextInput value={model} onChangeText={setModel} placeholder={kind === 'gemini' ? 'gemini-2.0-flash' : 'qwen2.5vl / llava / gpt-4o-mini'}
              autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.muted} style={styles.input} />
          </Field>

          <Button title={existing ? 'Save' : 'Add endpoint'} onPress={save} style={{ marginTop: space[2] }} />
          {existing && <Button title="Delete" variant="ghost" onPress={remove} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <FsText variant="caption">{label}</FsText>
      {children}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14 },
}));
