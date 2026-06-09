import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { useNavStore } from '@/stores/navStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { MealType } from '@/types';

const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snacks' };

/**
 * Quick-add (A3): log a bare calorie number (+ optional macros) without picking a
 * food — for restaurant meals / estimates. Saves a custom `food_logs` row.
 */
export default function QuickAdd() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();
  const meal = (params.meal ?? 'SNACK') as MealType;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const num = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0);
  const cal = num(calories);
  const canSave = cal > 0;

  const save = () => {
    if (!canSave) return;
    foodRepo.addLog({
      date,
      meal,
      servingQty: 1,
      custom: { name: name.trim() || 'Quick add', calories: cal, protein: num(protein), carbs: num(carbs), fat: num(fat) },
    });
    // Land back on the Food → Today tab so the new entry is visible.
    useNavStore.getState().setSection('food', 'today');
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Quick add</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>
      <FsText variant="caption" style={{ paddingHorizontal: space[4], marginBottom: space[3] }}>
        Log calories without picking a food — to {MEAL_LABEL[meal]}.
      </FsText>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6], gap: space[3] }} keyboardShouldPersistTaps="handled">
          <Field label="Name (optional)">
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Restaurant lunch" placeholderTextColor={colors.muted} style={styles.input} autoFocus returnKeyType="next" />
          </Field>
          <Field label="Calories">
            <TextInput value={calories} onChangeText={setCalories} placeholder="0" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} />
            <FsText variant="caption" style={styles.suffix}>kcal</FsText>
          </Field>

          <FsText variant="overline" style={{ marginTop: space[2] }}>Macros (optional)</FsText>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Macro label="Protein" value={protein} onChange={setProtein} />
            <Macro label="Carbs" value={carbs} onChange={setCarbs} />
            <Macro label="Fat" value={fat} onChange={setFat} />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Add to log" onPress={save} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <FsText variant="caption">{label}</FsText>
      <View style={styles.fieldRow}>{children}</View>
    </View>
  );
}

function Macro({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <FsText variant="caption">{label}</FsText>
      <View style={styles.fieldRow}>
        <TextInput value={value} onChangeText={onChange} placeholder="0" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={styles.input} />
        <FsText variant="caption" style={styles.suffix}>g</FsText>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 15 },
  suffix: { color: colors.muted },
  footer: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[4] },
}));
