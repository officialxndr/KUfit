import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Coffee,
  Sun,
  Moon,
  Cookie,
  type LucideIcon,
} from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { CalorieMacroCard } from '@/components/CalorieMacroCard';
import { MonthCalendar } from '@/components/MonthCalendar';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { FoodQuantitySheet, type SheetFood } from '@/components/FoodQuantitySheet';
import { foodRepo, type DayNutrients } from '@/lib/repositories/FoodRepo';
import { resolveTargets } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, PAGE_PADDING, themedStyles } from '@/theme/tokens';
import type { FoodLog, MealType } from '@/types';

/** Normalize a logged item (food or recipe) into the shared quantity sheet's shape. */
function logToSheetFood(l: FoodLog): SheetFood | null {
  if (l.foodItem) return l.foodItem;
  if (l.recipe?.nutrition) {
    const n = l.recipe.nutrition;
    return {
      name: l.recipe.name,
      servingSize: 1,
      servingUnit: 'serving',
      calories: n.perServingCalories,
      protein: n.perServingProtein,
      carbs: n.perServingCarbs,
      fat: n.perServingFat,
    };
  }
  return null;
}

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const PAGE_W = Dimensions.get('window').width - PAGE_PADDING * 2;

// Soft daily reference values for nutrients without an explicit profile target.
const REF = { fiber: 30, sugar: 50, sodium: 2300, saturatedFat: 20 };

const MEALS: { key: MealType; label: string; icon: LucideIcon }[] = [
  { key: 'BREAKFAST', label: 'Breakfast', icon: Coffee },
  { key: 'LUNCH', label: 'Lunch', icon: Sun },
  { key: 'DINNER', label: 'Dinner', icon: Moon },
  { key: 'SNACK', label: 'Snacks', icon: Cookie },
];

export function FoodToday() {
  const profile = useSettingsStore((s) => s.profile);
  const router = useRouter();

  const [date, setDate] = useState(() => isoDate(new Date()));
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [totals, setTotals] = useState<DayNutrients>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, saturatedFat: 0 });
  const [open, setOpen] = useState<Record<MealType, boolean>>({ BREAKFAST: true, LUNCH: true, DINNER: false, SNACK: false });
  const [page, setPage] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => firstOfMonth(new Date()));
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    setLogs(foodRepo.getLogs(date));
    setTotals(foodRepo.getDayTotals(date));
  }, [date]);
  useFocusEffect(refresh);

  // Days with logged food in the visible calendar month (for dots).
  const loadMarks = useCallback((month: Date) => {
    const from = isoDate(new Date(month.getFullYear(), month.getMonth(), 1));
    const to = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    setMarked(new Set(foodRepo.getDailyCalories(from, to).filter((r) => r.calories > 0).map((r) => r.date)));
  }, []);

  const openCalendar = () => { const m = firstOfMonth(new Date(date)); setCalMonth(m); loadMarks(m); setCalOpen(true); };
  const shiftDay = (delta: number) => setDate((d) => isoDate(new Date(new Date(d).getTime() + delta * DAY_MS)));

  const targets = resolveTargets(profile);
  const goal = targets.calorieTarget ?? 0;
  const remaining = goal - totals.calories;

  // Custom nutrient goals override the soft REF defaults on the "Other nutrients" page.
  const nutrientGoals = profile.nutrientGoals ?? [];
  const targetFor = (key: string, fallback: number) =>
    nutrientGoals.find((g) => g.key === key)?.target ?? fallback;

  const remove = (id: string) => { foodRepo.deleteLog(id); refresh(); };

  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [favActive, setFavActive] = useState(false);
  const editFood = editing ? logToSheetFood(editing) : null;
  const openEdit = (l: FoodLog) => { setFavActive(!!(l.foodItem?.isFavorite ?? l.recipe?.isFavorite)); setEditing(l); };
  const toggleEditFav = () => {
    if (!editing) return;
    if (editing.recipe) foodRepo.toggleRecipeFavorite(editing.recipe.id);
    else if (editing.foodItem) foodRepo.toggleFavorite(editing.foodItem.id);
    setFavActive((v) => !v);
  };
  const saveEdit = (qty: number) => {
    if (!editing) return;
    if (qty <= 0) foodRepo.deleteLog(editing.id);
    else foodRepo.updateLog(editing.id, qty);
    setEditing(null);
    refresh();
  };

  const d = new Date(date);
  const todayIso = isoDate(new Date());
  const dayLabel = date === todayIso ? 'Today'
    : date === isoDate(new Date(Date.now() - DAY_MS)) ? 'Yesterday'
      : date === isoDate(new Date(Date.now() + DAY_MS)) ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'long' });
  const dateSub = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const onPageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / PAGE_W));

  return (
    <>
      {/* Date header */}
      <Card style={{ marginBottom: space[3], padding: 0, overflow: 'hidden' }}>
        <View style={styles.dateRow}>
          <Pressable onPress={() => shiftDay(-1)} hitSlop={8} style={styles.arrow}><ChevronLeft color={colors.muted} size={22} /></Pressable>
          <Pressable style={styles.dateCenter} onPress={openCalendar}>
            <FsText variant="bodyMedium">{dayLabel}</FsText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <FsText variant="caption">{dateSub}</FsText>
              <CalendarDays color={colors.primary} size={14} />
            </View>
          </Pressable>
          <Pressable onPress={() => shiftDay(1)} hitSlop={8} style={styles.arrow}><ChevronRight color={colors.muted} size={22} /></Pressable>
        </View>

        {/* Swipeable nutrient summary */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPageScroll}
        >
          {/* Page 1 — calories ring + macros (shared with Dashboard) */}
          <View style={{ width: PAGE_W, padding: space[4], paddingTop: space[2], justifyContent: 'center' }}>
            <CalorieMacroCard
              calories={totals.calories}
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
              targets={targets}
            />
          </View>

          {/* Page 2 — other nutrients */}
          <View style={{ width: PAGE_W, padding: space[4], paddingTop: space[2], gap: space[3] }}>
            <FsText variant="overline">Other nutrients</FsText>
            <NutrientBar label="Fiber" value={totals.fiber} target={targetFor('fiber', REF.fiber)} unit="g" color={colors.macroCarbs} />
            <NutrientBar label="Sugar" value={totals.sugar} target={targetFor('sugar', REF.sugar)} unit="g" color={colors.macroFat} />
            <NutrientBar label="Sat. fat" value={totals.saturatedFat} target={targetFor('saturatedFat', REF.saturatedFat)} unit="g" color={colors.macroProtein} />
            <NutrientBar label="Sodium" value={totals.sodium} target={targetFor('sodium', REF.sodium)} unit="mg" color={colors.warning} />
            <FsText variant="caption">≈ {(totals.sodium * 2.5 / 1000).toFixed(1)} g salt · references are general daily values</FsText>
          </View>
        </ScrollView>

        {/* page dots */}
        <View style={styles.dots}>
          {[0, 1].map((i) => <View key={i} style={[styles.dot, page === i && styles.dotOn]} />)}
        </View>
      </Card>

      {MEALS.map((meal) => {
        const items = logs.filter((l) => l.meal === meal.key);
        const logCals = (l: FoodLog) => (l.foodItem ? l.foodItem.calories : l.recipe?.nutrition?.perServingCalories ?? 0) * l.servingQty;
        const cals = items.reduce((s, l) => s + logCals(l), 0);
        const isOpen = open[meal.key];
        const MealIcon = meal.icon;
        return (
          <Card key={meal.key} style={{ marginBottom: space[3], padding: 0 }}>
            <Pressable style={styles.mealHead} onPress={() => setOpen((o) => ({ ...o, [meal.key]: !o[meal.key] }))}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <MealIcon color={colors.muted} size={16} />
                <FsText variant="bodyMedium">{meal.label}</FsText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <FsText variant="caption">{Math.round(cals)} kcal</FsText>
                <View style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}><ChevronDown color={colors.muted} size={16} /></View>
                <Pressable hitSlop={8} onPress={() => router.push({ pathname: '/add-food', params: { meal: meal.key, date } })} style={styles.addBtn}>
                  <Plus color={colors.primary} size={16} strokeWidth={2.4} />
                </Pressable>
              </View>
            </Pressable>
            {isOpen && items.length > 0 && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                {items.map((l) => {
                  const fi = l.foodItem;
                  const c = Math.round(logCals(l));
                  const name = fi?.name ?? l.recipe?.name ?? 'Item';
                  const sub = fi ? `${l.servingQty} × ${fi.servingSize}${fi.servingUnit}` : `${l.servingQty} serving${l.servingQty > 1 ? 's' : ''} · recipe`;
                  return (
                    <SwipeToDelete key={l.id} marginBottom={0} onDelete={() => remove(l.id)} confirmTitle="Remove item?" confirmMessage={`Remove ${name} from ${meal.label}?`}>
                      <Pressable style={styles.itemRow} onPress={() => openEdit(l)}>
                        <View style={{ flex: 1 }}>
                          <FsText variant="bodyMedium" numberOfLines={1}>{name}</FsText>
                          <FsText variant="caption">{sub}</FsText>
                        </View>
                        <FsText variant="body">{c} kcal</FsText>
                      </Pressable>
                    </SwipeToDelete>
                  );
                })}
              </View>
            )}
          </Card>
        );
      })}

      {/* Calendar modal */}
      <Modal visible={calOpen} transparent animationType="fade" onRequestClose={() => setCalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCalOpen(false)}>
          <Pressable style={styles.calCard} onPress={(e) => e.stopPropagation()}>
            <MonthCalendar
              month={calMonth}
              marked={marked}
              selected={date}
              allowAllDays
              onSelectDay={(picked) => { setDate(picked); setCalOpen(false); }}
              onMonthChange={(delta) => { const m = new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1); setCalMonth(m); loadMarks(m); }}
            />
            <Pressable style={styles.todayBtn} onPress={() => { setDate(todayIso); setCalOpen(false); }}>
              <FsText variant="bodyMedium" style={{ color: colors.white }}>Today</FsText>
            </Pressable>
            <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[2] }}>Dots mark days with logged food.</FsText>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit a logged item via the full add-food sheet (shared component) */}
      <FoodQuantitySheet
        food={editFood}
        date={date}
        initialServings={editing?.servingQty ?? 1}
        baselineQty={editing?.servingQty ?? 0}
        submitLabel="Save"
        favorite={editing ? { active: favActive, onToggle: toggleEditFav } : undefined}
        onSubmit={saveEdit}
        onClose={() => setEditing(null)}
        onDelete={() => { if (editing) remove(editing.id); setEditing(null); }}
      />
    </>
  );
}

function NutrientBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={{ gap: 5 }}>
      <View style={styles.barHead}>
        <FsText variant="caption">{label}</FsText>
        <FsText variant="caption" style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>
          {Math.round(value)} / {target}{unit}
        </FsText>
      </View>
      <View style={styles.track}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: color }} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[2] },
  arrow: { padding: 4 },
  dateCenter: { alignItems: 'center', gap: 2 },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: space[3] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.primary, width: 16 },
  mealHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space[3], paddingHorizontal: space[4] },
  addBtn: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: 'rgba(99,102,241,0.20)', alignItems: 'center', justifyContent: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space[2], paddingHorizontal: space[4], borderTopWidth: 1, borderTopColor: colors.border, gap: space[3] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[4] },
  calCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  todayBtn: { marginTop: space[3], backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
}));
