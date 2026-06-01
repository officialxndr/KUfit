import { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, Keyboard } from 'react-native';
import { Search, Plus } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { FoodQuantitySheet } from '@/components/FoodQuantitySheet';
import { searchFood, ensureFoodItem, type FoodCandidate } from '@/lib/foodSearch';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { MealType } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);
const MEALS: { key: MealType; label: string }[] = [
  { key: 'BREAKFAST', label: 'Breakfast' },
  { key: 'LUNCH', label: 'Lunch' },
  { key: 'DINNER', label: 'Dinner' },
  { key: 'SNACK', label: 'Snack' },
];

function mealByTime(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'BREAKFAST';
  if (h < 15) return 'LUNCH';
  if (h < 21) return 'DINNER';
  return 'SNACK';
}

/**
 * Food → Search sub-tab: look up any food (local-first + Open Food Facts) to view
 * its full breakdown or quick-log it to today. Reuses `searchFood` + the shared
 * `FoodQuantitySheet`. (Batch B will fold favorites/recent tabs in here.)
 */
export function FoodSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [meal, setMeal] = useState<MealType>(mealByTime);
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [favActive, setFavActive] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pick = (item: FoodCandidate) => { Keyboard.dismiss(); setFavActive(!!item.isFavorite); setSelected(item); };
  const toggleFav = () => {
    if (!selected) return;
    const id = selected.localId ?? ensureFoodItem(selected);
    selected.localId = id;
    foodRepo.toggleFavorite(id);
    selected.isFavorite = !selected.isFavorite;
    setFavActive((v) => !v);
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults(foodRepo.getRecentFoodItems(10).map((fi) => ({
        ...fi, localId: fi.id, barcode: fi.barcode ?? null, brand: fi.brand ?? null,
        fiber: fi.fiber ?? null, sugar: fi.sugar ?? null, sodium: fi.sodium ?? null,
        saturatedFat: fi.saturatedFat ?? null, details: fi.details ?? null,
      })));
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      setResults(await searchFood(q));
      setLoading(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const logSelected = (qty: number) => {
    if (!selected) return;
    foodRepo.addLog({ date: today(), meal, foodItemLocalId: ensureFoodItem(selected), servingQty: qty });
    setSelected(null);
  };

  return (
    <>
      <View style={styles.searchField}>
        <Search color={colors.muted} size={18} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search foods…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
        />
      </View>

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

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: space[4] }} />}

      {q.trim().length < 2 && results.length > 0 && (
        <FsText variant="overline" style={{ marginBottom: space[2] }}>Recent</FsText>
      )}

      {!loading && results.length === 0 && (
        <FsText variant="caption" style={{ marginTop: space[4] }}>
          {q.length < 2 ? 'Recent foods appear here. Search to find anything.' : 'No matches.'}
        </FsText>
      )}

      {results.map((item, i) => (
        <Pressable key={(item.localId ?? item.barcode ?? item.name) + i} onPress={() => pick(item)}>
          <Card style={styles.resultRow}>
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{item.name}</FsText>
              <FsText variant="caption" numberOfLines={1}>
                {item.brand ? `${item.brand} · ` : ''}{Math.round(item.calories)} kcal / {item.servingSize}{item.servingUnit}
                {item.isCustom ? ' · custom' : ''}
              </FsText>
            </View>
            <Plus color={colors.primary} size={20} strokeWidth={2.4} />
          </Card>
        </Pressable>
      ))}

      <FoodQuantitySheet
        food={selected}
        date={today()}
        favorite={selected ? { active: favActive, onToggle: toggleFav } : undefined}
        onSubmit={logSelected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: space[3],
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  mealRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  mealChip: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  mealChipOn: { backgroundColor: colors.primary },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[2] },
}));
