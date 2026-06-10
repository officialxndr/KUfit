import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { X, Sparkles } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { estimateMeal } from '@/lib/mealVision';
import { isVisionConfigured, resolveAiConfig } from '@/lib/llm/visionProviders';
import { getModel } from '@/lib/llm/models';
import { useMealSelection } from '@/lib/mealSelection';
import { useSettingsStore } from '@/stores/settingsStore';
import { useNavStore } from '@/stores/navStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { MealType } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);
const MEALS: { key: MealType; label: string }[] = [
  { key: 'BREAKFAST', label: 'Breakfast' }, { key: 'LUNCH', label: 'Lunch' },
  { key: 'DINNER', label: 'Dinner' }, { key: 'SNACK', label: 'Snack' },
];

/**
 * AI meal estimate (experimental): snap/pick a photo of a plate of food → the on-device
 * vision model guesses the dish + total calories/macros → review/edit → log it. A "test
 * how it works" feature; estimates are approximate, so the fields stay editable.
 */
export default function EstimateMeal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? today();
  const profile = useSettingsStore((s) => s.profile);
  const cfg = resolveAiConfig(profile);
  const aiReady = profile.aiProvider !== 'off' && isVisionConfigured(cfg);
  const isThinking = profile.aiProvider === 'device' && getModel(profile.aiModelId)?.reasoning === 'always';

  const [meal, setMeal] = useMealSelection();
  const [phase, setPhase] = useState<'capture' | 'review'>('capture');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rawNote, setRawNote] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const num = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0);

  const run = async (uri: string) => {
    setPhotoUri(uri);
    setProcessing(true);
    setRawNote(null);
    const { estimate, raw, error } = await estimateMeal(uri, cfg);
    setProcessing(false);
    if (error || !estimate) {
      Alert.alert('Could not estimate', error ?? `The model didn't return usable numbers.\n\n${raw.slice(0, 200) || '(empty)'}`);
      return;
    }
    setName(estimate.name);
    setCalories(String(estimate.calories));
    setProtein(String(estimate.protein));
    setCarbs(String(estimate.carbs));
    setFat(String(estimate.fat));
    setRawNote('✓ Estimated on-device — the photo stayed on your phone. Review and adjust before logging.');
    setPhase('review');
  };

  const pick = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Camera needed', 'Enable camera access to take a photo.'); return; }
      }
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      await run(res.assets[0].uri);
    } catch (e) {
      Alert.alert('Photo failed', String((e as Error)?.message ?? e));
    }
  };

  const save = () => {
    if (num(calories) <= 0) { Alert.alert('Add calories', 'Enter a calorie estimate before logging.'); return; }
    foodRepo.addLog({
      date, meal, servingQty: 1,
      custom: { name: name.trim() || 'Estimated meal', calories: num(calories), protein: num(protein), carbs: num(carbs), fat: num(fat) },
    });
    useNavStore.getState().setSection('food', 'today');
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Sparkles color={colors.primary} size={20} />
          <FsText variant="h2">Estimate a meal</FsText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[8], gap: space[3] }} keyboardShouldPersistTaps="handled">
          {!aiReady && (
            <Card style={{ gap: space[2] }}>
              <FsText variant="bodyMedium">No AI set up yet</FsText>
              <FsText variant="caption">Download an on-device model, or add an API endpoint (Ollama / LM Studio / OpenAI / Google), in Settings → AI.</FsText>
              <Button title="Open AI settings" variant="ghost" onPress={() => { useNavStore.getState().setSection('settings'); router.back(); }} />
            </Card>
          )}

          {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />}

          {processing ? (
            <View style={{ alignItems: 'center', paddingVertical: space[6], gap: space[2] }}>
              <ActivityIndicator color={colors.primary} />
              <FsText variant="caption">Estimating nutrition…{isThinking ? ' (thinking — slower)' : ''}</FsText>
            </View>
          ) : phase === 'capture' ? (
            <View style={{ gap: space[3] }}>
              <FsText variant="caption">Snap or choose a photo of your plate — the on-device AI will estimate the calories and macros. Approximate; you can edit before logging.</FsText>
              <Button title="Take a photo" onPress={() => pick('camera')} disabled={!aiReady} />
              <Button title="Choose from library" variant="ghost" onPress={() => pick('library')} disabled={!aiReady} />
            </View>
          ) : (
            <View style={{ gap: space[3] }}>
              {rawNote && <FsText variant="caption" style={{ color: colors.success }}>{rawNote}</FsText>}
              <Field label="Meal name" value={name} onChangeText={setName} />
              <Field label="Calories" value={calories} onChangeText={setCalories} keyboardType="decimal-pad" />
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <View style={{ flex: 1 }}><Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
              </View>

              <FsText variant="overline" style={{ marginTop: space[1] }}>Log to</FsText>
              <View style={styles.mealRow}>
                {MEALS.map((m) => {
                  const active = m.key === meal;
                  return (
                    <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.mealChip, active && styles.mealChipOn]}>
                      <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>{m.label}</FsText>
                    </Pressable>
                  );
                })}
              </View>

              <Button title="Add to log" onPress={save} />
              <Button title="Retake" variant="ghost" onPress={() => { setPhase('capture'); setPhotoUri(null); setRawNote(null); }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <FsText variant="caption">{label}</FsText>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  photo: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceHigh },
  input: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14 },
  mealRow: { flexDirection: 'row', gap: space[2] },
  mealChip: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  mealChipOn: { backgroundColor: colors.primary },
}));
