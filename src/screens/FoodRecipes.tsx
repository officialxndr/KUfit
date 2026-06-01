import { useCallback, useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search, Users, BookOpen, Plus, Trash2, Pencil } from 'lucide-react-native';

import { Card, FsText, Badge, Button } from '@/components/ui';
import { FoodQuantitySheet, type SheetFood } from '@/components/FoodQuantitySheet';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space } from '@/theme/tokens';
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
  const sheetFood = useMemo<SheetFood | null>(() => {
    if (!selected?.nutrition) return null;
    const b = foodRepo.getRecipeBreakdown(selected.id);
    const n = selected.nutrition;
    return {
      name: selected.name,
      brand: `${selected.servings} serving${selected.servings > 1 ? 's' : ''} · recipe`,
      servingSize: 1,
      servingUnit: 'serving',
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
            <Pressable key={r.id} onPress={() => setSelected(r)}>
            <Card style={{ marginBottom: space[3] }}>
              <View style={styles.recipeHead}>
                <View style={{ flex: 1 }}>
                  <FsText variant="cardTitle">{r.name}</FsText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Users color={colors.muted} size={12} />
                    <FsText variant="caption">{r.servings} serving{r.servings > 1 ? 's' : ''}</FsText>
                  </View>
                </View>
                {n && <Badge label={`${Math.round(n.perServingCalories)} kcal`} tone="primary" />}
              </View>
              {n && (
                <View style={styles.macroRow}>
                  {([
                    ['P', Math.round(n.perServingProtein), colors.macroProtein],
                    ['C', Math.round(n.perServingCarbs), colors.macroCarbs],
                    ['F', Math.round(n.perServingFat), colors.macroFat],
                  ] as const).map(([l, v, c]) => (
                    <View key={l} style={styles.macroCell}>
                      <FsText variant="overline" style={{ color: c }}>{l}</FsText>
                      <FsText variant="bodyMedium">{v}g</FsText>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.actions}>
                <Pressable onPress={() => remove(r)} hitSlop={8} style={{ padding: 4 }}>
                  <Trash2 color={colors.muted} size={16} />
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: '/recipe/new', params: { id: r.id } })} style={styles.editBtn}>
                  <Pencil color={colors.text} size={14} />
                  <FsText variant="caption">Edit</FsText>
                </Pressable>
                <Pressable onPress={() => setSelected(r)} style={styles.logBtn}>
                  <Plus color={colors.primary} size={14} />
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
        onSubmit={logServing}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space[3],
    marginTop: space[3],
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(99,102,241,0.12)',
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
  recipeHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  macroRow: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
  macroCell: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: space[2],
    alignItems: 'center',
    gap: 2,
  },
});
