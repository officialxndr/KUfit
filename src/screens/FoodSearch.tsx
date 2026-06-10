import { useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, ScanLine } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { FoodQuantitySheet } from '@/components/FoodQuantitySheet';
import { searchFood, ensureFoodItem, type FoodCandidate } from '@/lib/foodSearch';
import { useMealSelection } from '@/lib/mealSelection';
import { onMainScrollNearEnd } from '@/lib/appScroll';
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

/**
 * Food → Search sub-tab: look up any food (local-first + Open Food Facts) to view
 * its full breakdown or quick-log it to today. Reuses `searchFood` + the shared
 * `FoodQuantitySheet`. (Batch B will fold favorites/recent tabs in here.)
 */
export function FoodSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [meal, setMeal] = useMealSelection();
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [favActive, setFavActive] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pagination state in refs so the scroll-end listener reads it without re-subscribing.
  const qRef = useRef('');
  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const pick = (item: FoodCandidate) => {
    Keyboard.dismiss();
    setFavActive(!!item.isFavorite);
    // Carry the item's last-logged amount + unit so the sheet can prefill it.
    const existing = item.localId
      ? foodRepo.getFoodItemById(item.localId)
      : item.barcode ? foodRepo.getFoodItemByBarcode(item.barcode) : null;
    setSelected({ ...item, details: item.details ?? existing?.details ?? null, lastAmount: existing?.lastAmount ?? null, lastUnit: existing?.lastUnit ?? null });
  };
  const toggleFav = () => {
    if (!selected) return;
    const id = selected.localId ?? ensureFoodItem(selected);
    selected.localId = id;
    foodRepo.toggleFavorite(id);
    selected.isFavorite = !selected.isFavorite;
    setFavActive((v) => !v);
  };

  // Live, debounced search (page 1). Recent foods show while the query is too short.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    qRef.current = q;
    pageRef.current = 1;
    hasMoreRef.current = false;
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
      const { items, hasMore } = await searchFood(q, 1);
      if (qRef.current !== q) return; // a newer keystroke superseded this query
      hasMoreRef.current = hasMore;
      setResults(items);
      setLoading(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  // Infinite scroll: append the next OFF page when the shell scroll nears the bottom.
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || qRef.current.trim().length < 2) return;
    const activeQ = qRef.current;
    const next = pageRef.current + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const { items, hasMore } = await searchFood(activeQ, next);
    if (qRef.current === activeQ) {
      pageRef.current = next;
      hasMoreRef.current = hasMore;
      setResults((prev) => {
        const seen = new Set(prev.map((p) => p.barcode || p.name.toLowerCase()));
        return [...prev, ...items.filter((it) => !seen.has(it.barcode || it.name.toLowerCase()))];
      });
    }
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  useEffect(() => onMainScrollNearEnd(loadMore), [loadMore]);

  const logSelected = (qty: number, entry: { amount: number; unit: string }) => {
    if (!selected) return;
    const id = ensureFoodItem(selected);
    foodRepo.addLog({ date: today(), meal, foodItemLocalId: id, servingQty: qty });
    foodRepo.setFoodItemLastEntry(id, entry.amount, entry.unit);
    setSelected(null);
  };

  return (
    <>
      <View style={styles.searchRow}>
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
        <Pressable
          onPress={() => router.push({ pathname: '/add-food', params: { meal, date: today(), scan: '1' } })}
          style={styles.scanBtn}
          hitSlop={6}
        >
          <ScanLine color={colors.white} size={20} />
        </Pressable>
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

      {loadingMore && <ActivityIndicator color={colors.primary} style={{ marginVertical: space[3] }} />}

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
  searchRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  scanBtn: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.md },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  mealRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  mealChip: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  mealChipOn: { backgroundColor: colors.primary },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[2] },
}));
