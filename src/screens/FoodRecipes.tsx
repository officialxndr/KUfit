import { useCallback, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, Users, BookOpen, Plus, Trash2, Pencil, Utensils, Star } from 'lucide-react-native';

import { Card, FsText, Button } from '@/components/ui';
import { FoodQuantitySheet, type SheetFood } from '@/components/FoodQuantitySheet';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space, tintBg, themedStyles } from '@/theme/tokens';
import type { MealType, Recipe } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);
const MEALS: { key: MealType; label: string }[] = [
  { key: 'BREAKFAST', label: 'Breakfast' },
  { key: 'LUNCH', label: 'Lunch' },
  { key: 'DINNER', label: 'Dinner' },
  { key: 'SNACK', label: 'Snack' },
];

/** Recipe library — reads saved recipes; the calorie/macro chips are per serving. */
export function FoodRecipes() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => setRecipes(foodRepo.getRecipes()), []);
  useFocusEffect(refresh);

  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));

  // Recipe preview/log via the shared rich sheet (full ingredient-aggregated breakdown).
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [favActive, setFavActive] = useState(false);
  const openRecipe = (r: Recipe) => { setFavActive(!!r.isFavorite); setSelected(r); };
  const toggleRecipeFav = () => {
    if (!selected) return;
    foodRepo.toggleRecipeFavorite(selected.id);
    selected.isFavorite = !selected.isFavorite;
    setFavActive((v) => !v);
    refresh();
  };
  const sheetFood = useMemo<SheetFood | null>(() => {
    if (!selected?.nutrition) return null;
    const b = foodRepo.getRecipeBreakdown(selected.id);
    const n = selected.nutrition;
    return {
      name: selected.name,
      brand: `${selected.servings} serving${selected.servings > 1 ? 's' : ''} · recipe`,
      // A gram-weighted serving lets the sheet offer a `g` unit; otherwise it's abstract "1 serving".
      servingSize: selected.servingWeightG ?? 1,
      servingUnit: selected.servingWeightG ? 'g' : 'serving',
      calories: n.perServingCalories,
      protein: n.perServingProtein,
      carbs: n.perServingCarbs,
      fat: n.perServingFat,
      fiber: b?.core.fiber ?? null,
      sugar: b?.core.sugar ?? null,
      sodium: b?.core.sodium ?? null,
      saturatedFat: b?.core.saturatedFat ?? null,
      details: b?.details ?? null,
    };
  }, [selected]);

  const logServing = (qty: number) => {
    const r = selected;
    setSelected(null);
    if (!r) return;
    Alert.alert(`Log "${r.name}"`, 'Add to which meal?', [
      ...MEALS.map((m) => ({
        text: m.label,
        onPress: () => foodRepo.addLog({ date: today(), meal: m.key, recipeLocalId: r.id, servingQty: qty }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const remove = (r: Recipe) => {
    Alert.alert('Delete recipe?', `Remove "${r.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { foodRepo.deleteRecipe(r.id); refresh(); } },
    ]);
  };

  return (
    <>
      <View style={styles.topRow}>
        <View style={styles.searchRow}>
          <Search color={colors.muted} size={16} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>
        <Button title="+ New" onPress={() => router.push('/recipe/new')} style={{ paddingHorizontal: 14 }} />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <BookOpen color={colors.muted} size={28} />
          </View>
          <FsText variant="cardTitle" style={{ color: colors.muted }}>
            {recipes.length === 0 ? 'No recipes yet' : 'No matches'}
          </FsText>
          <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
            {recipes.length === 0
              ? 'Recipes you save will show here with per-serving calories and macros.'
              : 'Try a different search.'}
          </FsText>
        </View>
      ) : (
        filtered.map((r) => {
          const n = r.nutrition;
          return (
            <Pressable key={r.id} onPress={() => openRecipe(r)}>
            <Card style={{ marginBottom: space[3], padding: 0, overflow: 'hidden' }}>
              <View style={styles.cardBody}>
                <View style={styles.headRow}>
                  <View style={styles.avatar}>
                    <Utensils color={colors.primary} size={20} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FsText variant="cardTitle" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name}</FsText>
                      {r.isFavorite && <Star color={colors.warning} size={13} fill={colors.warning} />}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Users color={colors.muted} size={12} />
                      <FsText variant="caption">
                        {r.servings} serving{r.servings > 1 ? 's' : ''}{r.servingWeightG ? ` · ${Math.round(r.servingWeightG)}g` : ''}
                      </FsText>
                    </View>
                  </View>
                  {n && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <FsText variant="stat">{Math.round(n.perServingCalories)}</FsText>
                      <FsText variant="caption" style={{ marginTop: -2 }}>kcal / serving</FsText>
                    </View>
                  )}
                </View>
                {n && (
                  <View style={styles.macroRow}>
                    {([
                      ['P', Math.round(n.perServingProtein), colors.macroProtein],
                      ['C', Math.round(n.perServingCarbs), colors.macroCarbs],
                      ['F', Math.round(n.perServingFat), colors.macroFat],
                    ] as const).map(([l, v, c]) => (
                      <View key={l} style={styles.macroChip}>
                        <View style={[styles.dot, { backgroundColor: c }]} />
                        <FsText variant="caption" style={{ color: colors.muted }}>{l}</FsText>
                        <FsText variant="bodyMedium">{v}g</FsText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.footer}>
                <Pressable onPress={() => remove(r)} hitSlop={8} style={styles.iconBtn}>
                  <Trash2 color={colors.muted} size={16} />
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/recipe/new', params: { id: r.id } })} hitSlop={8} style={styles.iconBtn}>
                  <Pencil color={colors.muted} size={16} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => openRecipe(r)} style={styles.logBtn}>
                  <Plus color={colors.primary} size={15} />
                  <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Log Serving</FsText>
                </Pressable>
              </View>
            </Card>
            </Pressable>
          );
        })
      )}

      <FoodQuantitySheet
        food={sheetFood}
        date={today()}
        submitLabel="Log Serving"
        favorite={selected ? { active: favActive, onToggle: toggleRecipeFav } : undefined}
        onSubmit={logServing}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  cardBody: { padding: space[4] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: tintBg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: radius.full },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconBtn: { padding: 6 },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: tintBg.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: space[8], gap: space[2] },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  macroRow: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
}));
