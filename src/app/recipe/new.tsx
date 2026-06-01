import { useEffect, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Search, Plus, Minus, Trash2 } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space } from '@/theme/tokens';
import type { FoodItem } from '@/types';

interface Ingredient {
  foodItem: FoodItem;
  quantity: number;
}

export default function NewRecipe() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [name, setName] = useState('');
  const [servings, setServings] = useState(1);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');

  // Load the recipe when editing.
  useEffect(() => {
    if (!id) return;
    const r = foodRepo.getRecipes().find((x) => x.id === id);
    if (r) {
      setName(r.name);
      setServings(r.servings || 1);
      setIngredients(r.ingredients.map((ing) => ({ foodItem: ing.foodItem, quantity: ing.quantity })));
    }
  }, [id]);

  const results = useMemo(() => (query.trim() ? foodRepo.searchFoodItems(query.trim()).slice(0, 12) : []), [query]);

  const add = (fi: FoodItem) => {
    setIngredients((list) => (list.some((i) => i.foodItem.id === fi.id) ? list : [...list, { foodItem: fi, quantity: 1 }]));
    setQuery('');
  };
  const setQty = (id: string, delta: number) =>
    setIngredients((list) => list.map((i) => (i.foodItem.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)));
  const remove = (id: string) => setIngredients((list) => list.filter((i) => i.foodItem.id !== id));

  const total = ingredients.reduce(
    (acc, i) => ({
      cal: acc.cal + i.foodItem.calories * i.quantity,
      p: acc.p + i.foodItem.protein * i.quantity,
      c: acc.c + i.foodItem.carbs * i.quantity,
      f: acc.f + i.foodItem.fat * i.quantity,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
  const s = servings || 1;

  const save = () => {
    if (!name.trim()) return Alert.alert('Name your recipe', 'Give the recipe a name first.');
    if (ingredients.length === 0) return Alert.alert('Add ingredients', 'Add at least one ingredient.');
    const payload = {
      name: name.trim(),
      servings: s,
      ingredients: ingredients.map((i) => ({ foodItemLocalId: i.foodItem.id, quantity: i.quantity })),
    };
    if (editing && id) foodRepo.updateRecipe(id, payload);
    else foodRepo.createRecipe(payload);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
        <FsText variant="cardTitle">{editing ? 'Edit Recipe' : 'New Recipe'}</FsText>
        <Pressable onPress={save} hitSlop={10}>
          <FsText variant="bodyMedium" style={{ color: colors.success }}>Save</FsText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Recipe name…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <View style={styles.servingsRow}>
          <FsText variant="bodyMedium">Servings</FsText>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => setServings((v) => Math.max(1, v - 1))} hitSlop={4}>
              <Minus color={colors.text} size={16} />
            </Pressable>
            <FsText variant="cardTitle" style={{ minWidth: 28, textAlign: 'center' }}>{servings}</FsText>
            <Pressable style={styles.stepBtn} onPress={() => setServings((v) => v + 1)} hitSlop={4}>
              <Plus color={colors.text} size={16} />
            </Pressable>
          </View>
        </View>

        {/* Nutrition preview */}
        {ingredients.length > 0 && (
          <Card style={{ marginTop: space[3] }}>
            <FsText variant="overline">Per serving</FsText>
            <FsText variant="stat" style={{ marginTop: 4 }}>{Math.round(total.cal / s)} kcal</FsText>
            <FsText variant="caption" style={{ marginTop: 2 }}>
              P {Math.round(total.p / s)}g · C {Math.round(total.c / s)}g · F {Math.round(total.f / s)}g
              {'   ·   '}makes {s} serving{s > 1 ? 's' : ''} ({Math.round(total.cal)} kcal total)
            </FsText>
          </Card>
        )}

        {/* Ingredients */}
        <FsText variant="overline" style={{ marginTop: space[4], marginBottom: space[2] }}>Ingredients</FsText>
        {ingredients.length === 0 ? (
          <FsText variant="caption">Search below to add ingredients from your food items.</FsText>
        ) : (
          ingredients.map((i) => (
            <Card key={i.foodItem.id} style={styles.ingRow}>
              <View style={{ flex: 1 }}>
                <FsText variant="bodyMedium" numberOfLines={1}>{i.foodItem.name}</FsText>
                <FsText variant="caption">
                  {i.quantity} × {i.foodItem.servingSize}{i.foodItem.servingUnit} · {Math.round(i.foodItem.calories * i.quantity)} kcal
                </FsText>
              </View>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtnSm} onPress={() => setQty(i.foodItem.id, -1)} hitSlop={4}>
                  <Minus color={colors.text} size={14} />
                </Pressable>
                <FsText variant="bodyMedium" style={{ minWidth: 20, textAlign: 'center' }}>{i.quantity}</FsText>
                <Pressable style={styles.stepBtnSm} onPress={() => setQty(i.foodItem.id, 1)} hitSlop={4}>
                  <Plus color={colors.text} size={14} />
                </Pressable>
                <Pressable onPress={() => remove(i.foodItem.id)} hitSlop={6} style={{ marginLeft: space[2] }}>
                  <Trash2 color={colors.muted} size={16} />
                </Pressable>
              </View>
            </Card>
          ))
        )}

        {/* Ingredient search */}
        <View style={styles.searchRow}>
          <Search color={colors.muted} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your food items…"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.text, paddingVertical: 10, fontSize: 14 }}
          />
        </View>
        {results.map((fi) => (
          <Pressable key={fi.id} onPress={() => add(fi)}>
            <Card style={styles.resultRow}>
              <View style={{ flex: 1 }}>
                <FsText variant="body" numberOfLines={1}>{fi.name}</FsText>
                <FsText variant="caption">{Math.round(fi.calories)} kcal · {fi.servingSize}{fi.servingUnit}</FsText>
              </View>
              <Plus color={colors.primary} size={18} />
            </Card>
          </Pressable>
        ))}
        {query.trim() !== '' && results.length === 0 && (
          <FsText variant="caption" style={{ marginTop: space[2] }}>
            No matching food items. Log or create foods first (Food → +), then add them here.
          </FsText>
        )}

        <Button title={editing ? 'Save Changes' : 'Save Recipe'} onPress={save} style={{ marginTop: space[6] }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  stepBtnSm: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginTop: space[4],
    marginBottom: space[2],
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
});
