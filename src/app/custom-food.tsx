import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { FsText, Card, Button, SectionHeader } from '@/components/ui';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space } from '@/theme/tokens';
import type { MealType } from '@/types';

export default function CustomFood() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sodium, setSodium] = useState('');

  // Empty optional fields stay null (unknown) rather than collapsing to 0.
  const optional = (v: string) => (v.trim() === '' ? null : Number(v) || 0);

  const create = (thenLog: boolean) => {
    if (!name.trim() || !calories) {
      Alert.alert('Missing info', 'A name and calories are required.');
      return;
    }
    const localId = foodRepo.createCustomFoodItem({
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: null,
      servingSize: Number(servingSize) || 100,
      servingUnit: servingUnit || 'g',
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: optional(fiber),
      sugar: optional(sugar),
      sodium: optional(sodium),
      saturatedFat: optional(saturatedFat),
      source: 'MANUAL',
      isCustom: true,
    });
    if (thenLog && params.meal) {
      foodRepo.addLog({
        date: params.date ?? new Date().toISOString().slice(0, 10),
        meal: params.meal,
        foodItemLocalId: localId,
        servingQty: 1,
      });
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Custom Food</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="Details" />
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom's Granola" />
          <Field label="Brand (optional)" value={brand} onChangeText={setBrand} />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 2 }}>
              <Field label="Serving size" value={servingSize} onChangeText={setServingSize} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Unit" value={servingUnit} onChangeText={setServingUnit} />
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="Nutrition (per serving)" />
          <Field label="Calories" value={calories} onChangeText={setCalories} keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
          </View>
        </Card>

        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="More nutrients (optional)" />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Field label="Fiber (g)" value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Sugar (g)" value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Field label="Sat. fat (g)" value={saturatedFat} onChangeText={setSaturatedFat} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Sodium (mg)" value={sodium} onChangeText={setSodium} keyboardType="decimal-pad" /></View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <View style={{ flex: 1 }}><Button title="Save" variant="ghost" onPress={() => create(false)} /></View>
          {params.meal ? (
            <View style={{ flex: 2 }}><Button title="Save & Log" onPress={() => create(true)} /></View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <FsText variant="caption" style={{ marginBottom: 4 }}>{label}</FsText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
  },
});
