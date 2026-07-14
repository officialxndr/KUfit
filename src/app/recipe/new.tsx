import { useEffect, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, FlatList, Alert, Keyboard, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Search, Plus, Minus, Trash2 } from 'lucide-react-native';

import { FsText, Button, Card } from '@/components/ui';
import { FoodQuantitySheet, type SheetFood } from '@/components/FoodQuantitySheet';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { todayLocal } from '@/lib/date';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { FoodItem } from '@/types';

interface Ingredient {
  foodItem: FoodItem;
  quantity: number;
}

/** The stored `quantity` is a servings multiplier; show the resolved amount in the food's own unit. */
const fmtAmount = (i: Ingredient) => {
  const n = Math.round(i.quantity * i.foodItem.servingSize * 10) / 10;
  const unit = i.foodItem.servingUnit;
  const plural = unit === 'serving' && n !== 1 ? 's' : ''; // only 'serving' pluralizes cleanly
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}${plural}`;
};

/** FoodItem → the sheet's minimal food shape; drop last-logged prefill so recipes open at the set qty. */
const toSheetFood = (fi: FoodItem): SheetFood => ({
  name: fi.name, brand: fi.brand, servingSize: fi.servingSize, servingUnit: fi.servingUnit,
  servingText: fi.servingText, calories: fi.calories, protein: fi.protein, carbs: fi.carbs, fat: fi.fat,
  fiber: fi.fiber, sugar: fi.sugar, sodium: fi.sodium, saturatedFat: fi.saturatedFat, details: fi.details,
  lastAmount: null, lastUnit: null,
});

export default function NewRecipe() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [name, setName] = useState('');
  const [servings, setServings] = useState(1);
  const [servingWeight, setServingWeight] = useState(''); // grams per serving (optional)
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');

  // Load the recipe when editing.
  useEffect(() => {
    if (!id) return;
    const r = foodRepo.getRecipes().find((x) => x.id === id);
    if (r) {
      setName(r.name);
      setServings(r.servings || 1);
      setServingWeight(r.servingWeightG != null ? String(r.servingWeightG) : '');
      setIngredients(r.ingredients.map((ing) => ({ foodItem: ing.foodItem, quantity: ing.quantity })));
    }
  }, [id]);

  const [searchOpen, setSearchOpen] = useState(false);
  const results = useMemo(() => (query.trim() ? foodRepo.searchFoodItems(query.trim()).slice(0, 30) : []), [query]);

  // Adding/editing an ingredient opens the same quantity sheet as food logging, so the amount can be
  // grams / oz / servings / portions (or the Bluetooth scale) — not just whole servings. The sheet
  // returns a servings multiplier, stored as `quantity`; nutrition scales by it directly.
  const [sheet, setSheet] = useState<FoodItem | null>(null);
  const sheetExisting = sheet ? ingredients.some((i) => i.foodItem.id === sheet.id) : false;
  const sheetQty = sheet ? ingredients.find((i) => i.foodItem.id === sheet.id)?.quantity : undefined;

  // Open the quantity sheet over the search overlay; drop the keyboard so it doesn't fight the sheet.
  // The overlay stays up underneath, so after adding one you can keep searching for the next.
  const openSheet = (fi: FoodItem) => { Keyboard.dismiss(); setSheet(fi); };
  const closeSearch = () => { setSearchOpen(false); setQuery(''); };

  // Android: while the search overlay is open, hardware Back should close it — not pop the whole
  // editor and discard the draft (the overlay is a plain View, so unlike a Modal it doesn't intercept
  // back on its own). No-op on iOS (no hardware back button).
  useEffect(() => {
    if (!searchOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { closeSearch(); return true; });
    return () => sub.remove();
  }, [searchOpen]);
  const applyQty = (qty: number) => {
    if (!sheet) return;
    setIngredients((list) => (
      list.some((i) => i.foodItem.id === sheet.id)
        ? list.map((i) => (i.foodItem.id === sheet.id ? { ...i, quantity: qty } : i))
        : [...list, { foodItem: sheet, quantity: qty }]
    ));
    setSheet(null);
  };
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
    const weightG = Number(servingWeight);
    const payload = {
      name: name.trim(),
      servings: s,
      servingWeightG: servingWeight.trim() && weightG > 0 ? weightG : null,
      ingredients: ingredients.map((i) => ({ foodItemLocalId: i.foodItem.id, quantity: i.quantity })),
    };
    if (editing && id) foodRepo.updateRecipe(id, payload);
    else foodRepo.createRecipe(payload);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
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

        <View style={styles.servingsRow}>
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium">Grams per serving</FsText>
            <FsText variant="caption" style={{ marginTop: 2 }}>Optional — lets you log this recipe by weight</FsText>
          </View>
          <View style={styles.weightField}>
            <TextInput
              value={servingWeight}
              onChangeText={(t) => setServingWeight(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.muted}
              style={{ color: colors.text, fontSize: 16, textAlign: 'right', minWidth: 48, paddingVertical: 8 }}
            />
            <FsText variant="caption">g</FsText>
          </View>
        </View>

        {/* Nutrition preview */}
        {ingredients.length > 0 && (() => {
          const weightG = Number(servingWeight);
          const hasWeight = servingWeight.trim() !== '' && weightG > 0;
          return (
            <Card style={{ marginTop: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <FsText variant="overline">Per serving</FsText>
                {hasWeight && <FsText variant="caption">{Math.round(weightG)} g / serving</FsText>}
              </View>
              <FsText variant="stat" style={{ marginTop: 4 }}>{Math.round(total.cal / s)} kcal</FsText>
              <FsText variant="caption" style={{ marginTop: 2 }}>
                P {Math.round(total.p / s)}g · C {Math.round(total.c / s)}g · F {Math.round(total.f / s)}g
                {'   ·   '}makes {s} serving{s > 1 ? 's' : ''}
                {hasWeight ? ` (${Math.round(weightG * s)} g total)` : ` (${Math.round(total.cal)} kcal total)`}
              </FsText>
            </Card>
          );
        })()}

        {/* Ingredients */}
        <FsText variant="overline" style={{ marginTop: space[4], marginBottom: space[2] }}>Ingredients</FsText>
        {ingredients.length === 0 ? (
          <FsText variant="caption">Tap “Add ingredient” to build your recipe from your food items.</FsText>
        ) : (
          ingredients.map((i) => (
            <Card key={i.foodItem.id} style={styles.ingRow}>
              <Pressable style={{ flex: 1 }} onPress={() => setSheet(i.foodItem)}>
                <FsText variant="bodyMedium" numberOfLines={1}>{i.foodItem.name}</FsText>
                <FsText variant="caption">
                  {fmtAmount(i)} · {Math.round(i.foodItem.calories * i.quantity)} kcal · tap to edit
                </FsText>
              </Pressable>
              <Pressable onPress={() => remove(i.foodItem.id)} hitSlop={6} style={{ marginLeft: space[2] }}>
                <Trash2 color={colors.muted} size={18} />
              </Pressable>
            </Card>
          ))
        )}

        {/* Add via the full food-search overlay (pinned input + scrolling results), so the keyboard
            never covers the search box — the same flow as logging a food. */}
        <Pressable style={styles.addRow} onPress={() => setSearchOpen(true)}>
          <Plus color={colors.primary} size={18} />
          <FsText variant="bodyMedium" style={{ color: colors.primary }}>Add ingredient</FsText>
        </Pressable>

        <Button title={editing ? 'Save Changes' : 'Save Recipe'} onPress={save} style={{ marginTop: space[6] }} />
      </ScrollView>

      {/* Full-screen ingredient search: the input is PINNED at the top with a scrolling list below, so
          the keyboard can never cover it (a plain View overlay, not a Modal, so the quantity sheet's
          Modal still layers on top). Stays open while you add several, then Done returns to the recipe. */}
      {searchOpen && (
        <View style={styles.searchOverlay}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            <View style={styles.overlayHeader}>
              <View style={styles.searchField}>
                <Search color={colors.muted} size={18} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search your food items…"
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, color: colors.text, paddingVertical: 10, fontSize: 15 }}
                  autoFocus
                  autoCorrect={false}
                />
              </View>
              <Pressable onPress={closeSearch} hitSlop={10}>
                <FsText variant="bodyMedium" style={{ color: colors.primary }}>Done</FsText>
              </Pressable>
            </View>
            <FlatList
              data={results}
              keyExtractor={(fi) => fi.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: space[4], paddingBottom: 200 }}
              renderItem={({ item: fi }) => {
                const inRecipe = ingredients.some((i) => i.foodItem.id === fi.id);
                return (
                  <Pressable onPress={() => openSheet(fi)}>
                    <Card style={styles.resultRow}>
                      <View style={{ flex: 1 }}>
                        <FsText variant="body" numberOfLines={1}>{fi.name}</FsText>
                        <FsText variant="caption">
                          {Math.round(fi.calories)} kcal · {fi.servingSize}{fi.servingUnit}{inRecipe ? ' · in recipe' : ''}
                        </FsText>
                      </View>
                      <Plus color={inRecipe ? colors.muted : colors.primary} size={18} />
                    </Card>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <FsText variant="caption">
                  {query.trim()
                    ? 'No matching food items. Log or create foods first (Food → +), then add them here.'
                    : 'Search your food items to add them to the recipe.'}
                </FsText>
              }
            />
          </SafeAreaView>
        </View>
      )}

      {/* Same quantity sheet as food logging (grams / oz / servings / portions / scale), for recipes. */}
      <FoodQuantitySheet
        food={sheet ? toSheetFood(sheet) : null}
        date={todayLocal()}
        hideDayContext
        initialServings={sheetQty != null ? Math.round(sheetQty * 100) / 100 : 1}
        submitLabel={sheetExisting ? 'Save' : 'Add to Recipe'}
        onSubmit={(servings) => applyQty(servings)}
        onClose={() => setSheet(null)}
        onDelete={sheetExisting ? () => { remove(sheet!.id); setSheet(null); } : undefined}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
  weightField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: 12,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingVertical: 14, marginTop: space[3],
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  // Full-screen ingredient-search overlay (pinned input + scrolling list).
  searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, zIndex: 10 },
  overlayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
}));
