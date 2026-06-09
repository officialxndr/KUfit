import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, TextInput, StyleSheet, Pressable, FlatList, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X, ScanLine, Search, Plus, Star, Utensils, BookmarkPlus, Pencil, Trash2 } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { KebabMenu } from '@/components/KebabMenu';
import { Skeleton } from '@/components/anim/Skeleton';
import { FoodQuantitySheet, type SheetFood } from '@/components/FoodQuantitySheet';
import { searchFood, barcodeLookup, ensureFoodItem, type FoodCandidate } from '@/lib/foodSearch';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { FoodItem, MealType, Recipe, SavedMeal } from '@/types';

type Tab = 'search' | 'recent' | 'favorites';
const TABS: { key: Tab; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'recent', label: 'Recent' },
  { key: 'favorites', label: 'Favorites' },
];

type Row = { kind: 'savedMeal'; meal: SavedMeal } | { kind: 'recipe'; recipe: Recipe } | { kind: 'food'; food: FoodCandidate };
type FavTarget = { kind: 'food'; candidate: FoodCandidate } | { kind: 'recipe'; recipe: Recipe };

/** Map a stored FoodItem to a search candidate (carries favorite + rich details). */
function toCandidate(fi: FoodItem): FoodCandidate {
  return {
    ...fi, localId: fi.id, barcode: fi.barcode ?? null, brand: fi.brand ?? null,
    fiber: fi.fiber ?? null, sugar: fi.sugar ?? null, sodium: fi.sodium ?? null,
    saturatedFat: fi.saturatedFat ?? null, isFavorite: fi.isFavorite ?? false, details: fi.details ?? null,
  };
}

/** Build a SheetFood for a recipe from its per-serving macros + aggregated ingredient breakdown. */
function recipeToSheetFood(r: Recipe): SheetFood | null {
  if (!r.nutrition) return null;
  const b = foodRepo.getRecipeBreakdown(r.id);
  const n = r.nutrition;
  return {
    name: r.name,
    brand: `${r.servings} serving${r.servings > 1 ? 's' : ''} · recipe`,
    servingSize: r.servingWeightG ?? 1, servingUnit: r.servingWeightG ? 'g' : 'serving',
    calories: n.perServingCalories, protein: n.perServingProtein, carbs: n.perServingCarbs, fat: n.perServingFat,
    fiber: b?.core.fiber ?? null, sugar: b?.core.sugar ?? null, sodium: b?.core.sodium ?? null,
    saturatedFat: b?.core.saturatedFat ?? null, details: b?.details ?? null,
  };
}

export default function AddFoodModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();
  const meal = (params.meal ?? 'SNACK') as MealType;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('search');
  const [foods, setFoods] = useState<FoodCandidate[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<{ food: SheetFood; log: (qty: number, entry: { amount: number; unit: string }) => void; fav: FavTarget } | null>(null);
  const [favActive, setFavActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allRecipes = useRef<Recipe[]>([]);
  useEffect(() => { allRecipes.current = foodRepo.getRecipes(); setRecipes(allRecipes.current); }, []);

  // Load results for the active tab + query.
  const load = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    allRecipes.current = foodRepo.getRecipes(); // keep favorite flags fresh
    const ql = q.trim().toLowerCase();
    const matchRecipes = ql.length >= 2 ? allRecipes.current.filter((r) => r.name.toLowerCase().includes(ql)) : allRecipes.current;
    const allMeals = foodRepo.getSavedMeals();
    const matchMeals = ql.length >= 2 ? allMeals.filter((m) => m.name.toLowerCase().includes(ql)) : allMeals;

    if (tab === 'favorites') {
      setFoods(foodRepo.getFavoriteFoodItems().map(toCandidate));
      setRecipes(allRecipes.current.filter((r) => r.isFavorite));
      setSavedMeals([]);
      setLoading(false);
      return;
    }
    if (tab === 'recent') {
      setFoods(foodRepo.getRecentFoodItems(15).map(toCandidate));
      setRecipes(matchRecipes);
      setSavedMeals(matchMeals);
      setLoading(false);
      return;
    }
    // search
    setRecipes(matchRecipes);
    setSavedMeals(matchMeals);
    if (ql.length < 2) {
      setFoods(foodRepo.getRecentFoodItems(10).map(toCandidate));
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      setFoods(await searchFood(q));
      setLoading(false);
    }, 350);
  }, [q, tab]);

  useEffect(() => { load(); return () => { if (debounce.current) clearTimeout(debounce.current); }; }, [load]);
  // Refresh when returning from the saved-meal editor so renamed/edited meals update.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows: Row[] = useMemo(() => [
    ...savedMeals.map((m) => ({ kind: 'savedMeal' as const, meal: m })),
    ...recipes.map((r) => ({ kind: 'recipe' as const, recipe: r })),
    ...foods.map((f) => ({ kind: 'food' as const, food: f })),
  ], [savedMeals, recipes, foods]);

  /** Fan a saved meal out into individual logs for this day/meal, then close. */
  const addSavedMeal = (m: SavedMeal) => {
    foodRepo.addSavedMeal(m.id, date, meal);
    router.back();
  };
  const removeSavedMeal = (m: SavedMeal) =>
    Alert.alert('Delete saved meal?', `Remove "${m.name}"? Your logged food won't be affected.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { foodRepo.deleteSavedMeal(m.id); load(); } },
    ]);

  const pickFood = (c: FoodCandidate) => {
    Keyboard.dismiss();
    setFavActive(!!c.isFavorite);
    // Prefill the sheet with the item's last-logged amount + unit, if known.
    const existing = c.localId
      ? foodRepo.getFoodItemById(c.localId)
      : c.barcode ? foodRepo.getFoodItemByBarcode(c.barcode) : null;
    const food: SheetFood = { ...c, lastAmount: existing?.lastAmount ?? null, lastUnit: existing?.lastUnit ?? null };
    setSelected({
      food,
      fav: { kind: 'food', candidate: c },
      log: (qty, entry) => {
        const id = ensureFoodItem(c);
        foodRepo.addLog({ date, meal, foodItemLocalId: id, servingQty: qty });
        foodRepo.setFoodItemLastEntry(id, entry.amount, entry.unit);
        router.back();
      },
    });
  };
  const pickRecipe = (r: Recipe) => {
    const food = recipeToSheetFood(r);
    if (!food) return;
    Keyboard.dismiss();
    setFavActive(!!r.isFavorite);
    setSelected({ food, fav: { kind: 'recipe', recipe: r }, log: (qty) => { foodRepo.addLog({ date, meal, recipeLocalId: r.id, servingQty: qty }); router.back(); } });
  };
  // Star toggle in the sheet — persists + flips the local flag so the row/list stays in sync.
  const toggleSelectedFav = () => {
    if (!selected) return;
    if (selected.fav.kind === 'recipe') {
      foodRepo.toggleRecipeFavorite(selected.fav.recipe.id);
      selected.fav.recipe.isFavorite = !selected.fav.recipe.isFavorite;
    } else {
      const c = selected.fav.candidate;
      const id = c.localId ?? ensureFoodItem(c);
      c.localId = id;
      foodRepo.toggleFavorite(id);
      c.isFavorite = !c.isFavorite;
    }
    setFavActive((v) => !v);
    load();
  };
  const toggleFav = (c: FoodCandidate) => {
    if (!c.localId) return;
    foodRepo.toggleFavorite(c.localId);
    load();
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert('Camera needed', 'Enable camera access to scan barcodes.'); return; }
    }
    setScanning(true);
  };

  const onScanned = async (r: BarcodeScanningResult) => {
    setScanning(false);
    setLoading(true);
    const found = await barcodeLookup(r.data);
    setLoading(false);
    if (found) pickFood(found);
    else Alert.alert('Not found', `No product found for barcode ${r.data}. Try searching by name.`);
  };

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
          onBarcodeScanned={onScanned}
        />
        <SafeAreaView style={styles.scanOverlay} edges={['top']}>
          <Pressable onPress={() => setScanning(false)} style={styles.iconBtn} hitSlop={10}>
            <X color="#fff" size={26} />
          </Pressable>
          <FsText variant="bodyMedium" style={{ color: '#fff', textAlign: 'center' }}>Point at a barcode</FsText>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.header}>
        <FsText variant="h2">Add to {meal[0] + meal.slice(1).toLowerCase()}</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Search color={colors.muted} size={18} />
          <TextInput
            value={q}
            onChangeText={(t) => { setQ(t); if (tab !== 'search' && t.trim().length >= 2) setTab('search'); }}
            placeholder="Search foods & recipes…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={openScanner} style={styles.scanBtn}>
          <ScanLine color={colors.white} size={20} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable key={t.key} style={[styles.tab, active && styles.tabOn]} onPress={() => setTab(t.key)}>
              <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>{t.label}</FsText>
            </Pressable>
          );
        })}
      </View>

      {loading && (
        <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[3] }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ gap: 6 }}>
              <Skeleton width="62%" height={15} />
              <Skeleton width="42%" height={11} />
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(item, i) => (item.kind === 'savedMeal' ? `m${item.meal.id}` : item.kind === 'recipe' ? `r${item.recipe.id}` : `f${item.food.localId ?? item.food.barcode ?? item.food.name}`) + i}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: 200 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ marginTop: space[4], gap: space[2] }}>
              <FsText variant="caption">
                {tab === 'favorites' ? 'Star foods to keep them here.' : q.length < 2 ? 'Recent foods & recipes appear here.' : 'No matches.'}
              </FsText>
              <Button title="Quick add calories" variant="ghost" onPress={() => router.push({ pathname: '/quick-add', params: { meal, date } })} />
              <Button title="Create custom food" variant="ghost" onPress={() => router.push({ pathname: '/custom-food', params: { meal, date } })} />
            </View>
          ) : null
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <View style={{ paddingTop: space[3], gap: space[2] }}>
              <Button title="Quick add calories" variant="ghost" onPress={() => router.push({ pathname: '/quick-add', params: { meal, date } })} />
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync('https://world.openfoodfacts.org').catch(() => {})}
                style={styles.creditFooter}
                hitSlop={6}
              >
                <FsText variant="caption" style={{ color: colors.muted, textAlign: 'center' }}>
                  Food data from Open Food Facts (ODbL)
                </FsText>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => item.kind === 'savedMeal' ? (
          <Pressable style={styles.resultRow} onPress={() => addSavedMeal(item.meal)}>
            <BookmarkPlus color={colors.primary} size={16} />
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{item.meal.name}</FsText>
              <FsText variant="caption" numberOfLines={1}>
                {item.meal.itemCount} item{item.meal.itemCount === 1 ? '' : 's'} · {Math.round(item.meal.calories)} kcal · saved meal
              </FsText>
            </View>
            <KebabMenu
              size={18}
              items={[
                { icon: Pencil, label: 'Edit meal', onPress: () => router.push({ pathname: '/saved-meal', params: { id: item.meal.id } }) },
                { icon: Trash2, label: 'Delete', danger: true, onPress: () => removeSavedMeal(item.meal) },
              ]}
            />
            <Plus color={colors.primary} size={20} strokeWidth={2.4} />
          </Pressable>
        ) : item.kind === 'recipe' ? (
          <Pressable style={styles.resultRow} onPress={() => pickRecipe(item.recipe)}>
            <Utensils color={colors.primary} size={16} />
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{item.recipe.name}</FsText>
              <FsText variant="caption" numberOfLines={1}>
                {item.recipe.nutrition ? `${Math.round(item.recipe.nutrition.perServingCalories)} kcal / serving` : ''} · recipe
              </FsText>
            </View>
            <Plus color={colors.primary} size={20} strokeWidth={2.4} />
          </Pressable>
        ) : (
          <Pressable style={styles.resultRow} onPress={() => pickFood(item.food)}>
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{item.food.name}</FsText>
              <FsText variant="caption" numberOfLines={1}>
                {item.food.brand ? `${item.food.brand} · ` : ''}{Math.round(item.food.calories)} kcal / {item.food.servingSize}{item.food.servingUnit}
                {item.food.isCustom ? ' · custom' : ''}
              </FsText>
            </View>
            {item.food.localId && (
              <Pressable onPress={() => toggleFav(item.food)} hitSlop={10} style={{ padding: 4 }}>
                <Star color={item.food.isFavorite ? colors.warning : colors.muted} size={18} fill={item.food.isFavorite ? colors.warning : 'transparent'} />
              </Pressable>
            )}
            <Plus color={colors.primary} size={20} strokeWidth={2.4} />
          </Pressable>
        )}
      />

      {/* Quantity sheet + nutrition summary (shared with Today + recipes) */}
      <FoodQuantitySheet
        food={selected?.food ?? null}
        date={date}
        favorite={selected ? { active: favActive, onToggle: toggleSelectedFav } : undefined}
        onSubmit={(qty, entry) => selected?.log(qty, entry)}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  searchRow: { flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], marginBottom: space[3] },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  scanBtn: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: space[1], paddingHorizontal: space[4], marginBottom: space[2] },
  tab: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  tabOn: { backgroundColor: colors.primary },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  creditFooter: { paddingTop: space[6], paddingBottom: space[2], alignItems: 'center' },
  scanOverlay: { padding: space[4], gap: space[4] },
  iconBtn: { alignSelf: 'flex-start' },
}));
