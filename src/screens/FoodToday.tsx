import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, Dimensions, TextInput, Alert, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, runOnJS, type SharedValue } from 'react-native-reanimated';
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
  Copy,
  BookmarkPlus,
  CheckSquare,
  Square,
  type LucideIcon,
} from 'lucide-react-native';

import { Card, FsText, Button } from '@/components/ui';
import { isoLocalDay, parseLocalDay, addDays, shortDate } from '@/lib/date';
import { KebabMenu, type KebabMenuItem } from '@/components/KebabMenu';
import { CalorieMacroCard } from '@/components/CalorieMacroCard';
import { MonthCalendar } from '@/components/MonthCalendar';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { FoodQuantitySheet, type SheetFood } from '@/components/FoodQuantitySheet';
import { useMotion } from '@/lib/useMotion';
import { haptic } from '@/lib/haptics';
import { usePullRefresh } from '@/stores/refreshStore';
import { DURATION } from '@/theme/motion';
import { foodRepo, type DayNutrients } from '@/lib/repositories/FoodRepo';
import { resolveBaseTargets, activeCaloriesForDisplay } from '@/lib/targets';
import { computeActiveCaloriesForRange } from '@/lib/activeCalories';
import { useSettingsStore } from '@/stores/settingsStore';
import { useActiveCaloriesStore } from '@/stores/activeCaloriesStore';
import { colors, radius, space, PAGE_PADDING, themedStyles } from '@/theme/tokens';
import type { FoodLog, MealType } from '@/types';

/** Normalize a logged item (food, recipe, or quick-add) into the shared quantity sheet's shape. */
function logToSheetFood(l: FoodLog): SheetFood | null {
  if (l.foodItem) return l.foodItem;
  if (l.custom) {
    return {
      name: l.custom.name,
      servingSize: 1,
      servingUnit: 'serving',
      calories: l.custom.calories,
      protein: l.custom.protein,
      carbs: l.custom.carbs,
      fat: l.custom.fat,
    };
  }
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
const isoDate = isoLocalDay;
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

/** A logged-item row that lifts on long-press and can be dragged onto another meal card.
 *  Wraps the row's existing swipe-to-delete + tap-to-edit; the drag only activates after a
 *  long press so a tap still edits and a horizontal swipe still deletes. */
function DraggableFoodRow({
  id, dragX, dragY, activeId, onLift, onUpdate, onDrop, onEnd, children,
}: {
  id: string;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  activeId: SharedValue<string>;
  onLift: (id: string) => void;
  onUpdate: (absY: number) => void;
  onDrop: (id: string, absY: number) => void;
  onEnd: () => void;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const active = activeId.value === id;
    return {
      transform: [
        { translateX: active ? dragX.value : 0 },
        { translateY: active ? dragY.value : 0 },
        { scale: active ? 1.03 : 1 },
      ],
      zIndex: active ? 50 : 0,
      opacity: active ? 0.97 : 1,
    };
  });
  const pan = Gesture.Pan()
    .activateAfterLongPress(250)
    // onStart = the long-press actually activated a drag (not a tap/swipe/scroll), so measure
    // drop zones + lift here rather than onBegin (which fires on every touch-down).
    .onStart(() => { activeId.value = id; runOnJS(onLift)(id); })
    .onUpdate((e) => { dragX.value = e.translationX; dragY.value = e.translationY; runOnJS(onUpdate)(e.absoluteY); })
    .onEnd((e) => { runOnJS(onDrop)(id, e.absoluteY); })
    .onFinalize(() => { dragX.value = 0; dragY.value = 0; activeId.value = ''; runOnJS(onEnd)(); });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

export function FoodToday() {
  const profile = useSettingsStore((s) => s.profile);
  const router = useRouter();
  const { animate } = useMotion();

  const [date, setDate] = useState(() => isoDate(new Date()));
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [totals, setTotals] = useState<DayNutrients>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, saturatedFat: 0 });
  const [open, setOpen] = useState<Record<MealType, boolean>>({ BREAKFAST: true, LUNCH: true, DINNER: false, SNACK: false });
  const [page, setPage] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => firstOfMonth(new Date()));
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [pastBurn, setPastBurn] = useState(0); // computed active-calorie burn for a non-today selected day

  // Subscribe so the budget re-renders when the async active-calorie value lands.
  useActiveCaloriesStore((s) => s.kcal);

  const refresh = useCallback(() => {
    setLogs(foodRepo.getLogs(date));
    setTotals(foodRepo.getDayTotals(date));
    useActiveCaloriesStore.getState().refresh(profile.activeCalorieSource);
  }, [date, profile.activeCalorieSource]);
  useFocusEffect(refresh);
  usePullRefresh(refresh);

  // Days with logged food in the visible calendar month (for dots).
  const loadMarks = useCallback((month: Date) => {
    const from = isoDate(new Date(month.getFullYear(), month.getMonth(), 1));
    const to = isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    setMarked(new Set(foodRepo.getDailyCalories(from, to).filter((r) => r.calories > 0).map((r) => r.date)));
  }, []);

  const openCalendar = () => { const m = firstOfMonth(parseLocalDay(date)); setCalMonth(m); loadMarks(m); setCalOpen(true); };
  const shiftDay = (delta: number) => setDate((d) => addDays(d, delta));

  // Per-day active-calorie burn: today's is live (recomputed each render); a past day is computed
  // async from THAT day's own workouts + Apple Health active energy (not today's value).
  const isToday = date === isoDate(new Date());
  useEffect(() => {
    if (isToday) return; // today handled inline below
    let cancelled = false;
    const start = parseLocalDay(date).toISOString();
    const end = parseLocalDay(addDays(date, 1)).toISOString();
    computeActiveCaloriesForRange(profile.activeCalorieSource, start, end)
      .then((v) => { if (!cancelled) setPastBurn(v); })
      .catch(() => { if (!cancelled) setPastBurn(0); });
    return () => { cancelled = true; };
  }, [date, isToday, profile.activeCalorieSource]);
  const burned = isToday ? activeCaloriesForDisplay(profile) : pastBurn;

  const targets = resolveBaseTargets(profile); // base target; the day's own burn is added below
  const goal = (targets.calorieTarget ?? 0) + burned;
  const remaining = goal - totals.calories;

  // Custom nutrient goals override the soft REF defaults on the "Other nutrients" page.
  const nutrientGoals = profile.nutrientGoals ?? [];
  const targetFor = (key: string, fallback: number) =>
    nutrientGoals.find((g) => g.key === key)?.target ?? fallback;

  const remove = (id: string) => { foodRepo.deleteLog(id); refresh(); };

  // ── Drag a logged item to another meal (long-press to lift, drop on a meal card) ──
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const activeId = useSharedValue('');
  const [dragTargetMeal, setDragTargetMeal] = useState<MealType | null>(null);
  // The dragged item's origin meal — its card wrapper is z-elevated so the lifted row paints
  // ABOVE later (opaque) meal cards when dragged downward.
  const [draggingMeal, setDraggingMeal] = useState<MealType | null>(null);
  const mealRefs = useRef<Partial<Record<MealType, View | null>>>({});
  const mealBounds = useRef<{ meal: MealType; top: number; bottom: number }[]>([]);
  const measureMeals = () => {
    const out: { meal: MealType; top: number; bottom: number }[] = [];
    MEALS.forEach((m) => mealRefs.current[m.key]?.measureInWindow((_x, y, _w, h) => { out.push({ meal: m.key, top: y, bottom: y + h }); }));
    mealBounds.current = out;
  };
  const mealAtY = (absY: number): MealType | null => mealBounds.current.find((b) => absY >= b.top && absY <= b.bottom)?.meal ?? null;
  const onLift = (id: string) => {
    measureMeals();
    const meal = logs.find((l) => l.id === id)?.meal ?? null;
    setDraggingMeal(meal);
    setDragTargetMeal(meal);
  };
  const onDragUpdate = (absY: number) => { const m = mealAtY(absY); setDragTargetMeal((prev) => (prev === m ? prev : m)); };
  const onDrop = (id: string, absY: number) => {
    const target = mealAtY(absY);
    const log = logs.find((l) => l.id === id);
    if (target && log && target !== log.meal) { foodRepo.updateLogMeal(id, target); haptic.success(); refresh(); }
  };
  const onDragEnd = () => { setDragTargetMeal(null); setDraggingMeal(null); };

  // Copy meal / day (A1): pick a source day from the calendar, then re-log into `date`.
  // `copyMode` is the target meal, or 'DAY' for the whole day.
  const [copyMode, setCopyMode] = useState<MealType | 'DAY' | null>(null);
  const startCopy = (mode: MealType | 'DAY') => { setCopyMode(mode); const m = firstOfMonth(parseLocalDay(date)); setCalMonth(m); loadMarks(m); setCalOpen(true); };
  // After picking a source day, choose which items to copy (all pre-selected).
  const [copySource, setCopySource] = useState<{ date: string; logs: FoodLog[] } | null>(null);
  const [copySel, setCopySel] = useState<Set<string>>(new Set());
  const onPickSourceDay = (picked: string) => {
    if (!copyMode) { setDate(picked); setCalOpen(false); return; }
    let srcLogs = foodRepo.getLogs(picked);
    if (copyMode !== 'DAY') srcLogs = srcLogs.filter((l) => l.meal === copyMode);
    setCalOpen(false);
    if (!srcLogs.length) {
      setCopyMode(null);
      Alert.alert('Nothing to copy', copyMode === 'DAY' ? 'That day has no logged items.' : 'That day has no items for this meal.');
      return;
    }
    setCopySource({ date: picked, logs: srcLogs });
    setCopySel(new Set(srcLogs.map((l) => l.id))); // everything checked by default
  };
  const toggleCopySel = (id: string) => setCopySel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allCopySelected = !!copySource && copySource.logs.every((l) => copySel.has(l.id));
  const toggleCopyAll = () => { if (copySource) setCopySel(allCopySelected ? new Set() : new Set(copySource.logs.map((l) => l.id))); };
  const closeCopy = () => { setCopySource(null); setCopyMode(null); setCopySel(new Set()); };
  const confirmCopy = () => {
    if (!copySource) return;
    const ids = copySource.logs.filter((l) => copySel.has(l.id)).map((l) => l.id);
    const forceMeal = copyMode && copyMode !== 'DAY' ? copyMode : null;
    const n = ids.length ? foodRepo.copyLogsByLocalIds(ids, date, forceMeal) : 0;
    closeCopy();
    if (n > 0) refresh();
  };

  // Save as meal (A5): name the current meal's items as a reusable saved meal.
  const [savingMeal, setSavingMeal] = useState<MealType | null>(null);
  const [mealName, setMealName] = useState('');
  const confirmSaveMeal = () => {
    if (!savingMeal) return;
    const id = foodRepo.saveMealFromLogs(mealName.trim() || 'My meal', date, savingMeal);
    setSavingMeal(null); setMealName('');
    if (id) Alert.alert('Saved', 'Add it any time from the "Add food" screen.');
  };

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

  const d = parseLocalDay(date);
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => shiftDay(1)} hitSlop={8} style={styles.arrow}><ChevronRight color={colors.muted} size={22} /></Pressable>
            <KebabMenu items={[{ icon: Copy, label: 'Copy entire day from…', onPress: () => startCopy('DAY') }]} size={18} />
          </View>
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
              burned={burned}
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
        const logCals = (l: FoodLog) => (l.foodItem ? l.foodItem.calories : l.custom ? l.custom.calories : l.recipe?.nutrition?.perServingCalories ?? 0) * l.servingQty;
        const cals = items.reduce((s, l) => s + logCals(l), 0);
        const isOpen = open[meal.key];
        const MealIcon = meal.icon;
        const mealMenu: KebabMenuItem[] = [
          { icon: Copy, label: 'Copy from another day', onPress: () => startCopy(meal.key) },
          ...(items.length > 0 ? [{ icon: BookmarkPlus, label: 'Save as meal', onPress: () => { setMealName(''); setSavingMeal(meal.key); } }] : []),
        ];
        return (
          <View key={meal.key} ref={(r) => { mealRefs.current[meal.key] = r; }} collapsable={false} style={{ marginBottom: space[3], zIndex: draggingMeal === meal.key ? 20 : 0 }}>
          <Card style={dragTargetMeal === meal.key ? { padding: 0, borderWidth: 2, borderColor: colors.primary } : { padding: 0 }}>
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
                <KebabMenu items={mealMenu} size={18} />
              </View>
            </Pressable>
            {isOpen && items.length > 0 && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                {items.map((l) => {
                  const fi = l.foodItem;
                  const c = Math.round(logCals(l));
                  const name = fi?.name ?? l.custom?.name ?? l.recipe?.name ?? 'Item';
                  const sub = fi
                    ? `${l.servingQty} × ${fi.servingSize}${fi.servingUnit}`
                    : l.custom
                      ? (l.servingQty > 1 ? `${l.servingQty} × · quick add` : 'Quick add')
                      : `${l.servingQty} serving${l.servingQty > 1 ? 's' : ''} · recipe`;
                  return (
                    <Animated.View
                      key={l.id}
                      entering={animate ? FadeInDown.duration(DURATION.base) : undefined}
                      exiting={animate ? FadeOut.duration(DURATION.fast) : undefined}
                      layout={animate ? LinearTransition.duration(DURATION.base) : undefined}
                    >
                      <DraggableFoodRow id={l.id} dragX={dragX} dragY={dragY} activeId={activeId} onLift={onLift} onUpdate={onDragUpdate} onDrop={onDrop} onEnd={onDragEnd}>
                        <SwipeToDelete marginBottom={0} onDelete={() => remove(l.id)} confirmTitle="Remove item?" confirmMessage={`Remove ${name} from ${meal.label}?`}>
                          <Pressable style={styles.itemRow} onPress={() => openEdit(l)}>
                            <View style={{ flex: 1 }}>
                              <FsText variant="bodyMedium" numberOfLines={1}>{name}</FsText>
                              <FsText variant="caption">{sub}</FsText>
                            </View>
                            <FsText variant="body">{c} kcal</FsText>
                          </Pressable>
                        </SwipeToDelete>
                      </DraggableFoodRow>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Card>
          </View>
        );
      })}

      {/* Calendar modal — also used to pick a source day when copying a meal/day. */}
      <Modal visible={calOpen} transparent animationType="fade" onRequestClose={() => { setCalOpen(false); setCopyMode(null); }}>
        <Pressable style={styles.backdrop} onPress={() => { setCalOpen(false); setCopyMode(null); }}>
          <Pressable style={styles.calCard} onPress={(e) => e.stopPropagation()}>
            {copyMode && (
              <FsText variant="bodyMedium" style={{ textAlign: 'center', marginBottom: space[2] }}>
                Copy {copyMode === 'DAY' ? 'a whole day' : 'a meal'} from…
              </FsText>
            )}
            <MonthCalendar
              month={calMonth}
              marked={marked}
              selected={date}
              allowAllDays
              onSelectDay={onPickSourceDay}
              onMonthChange={(delta) => { const m = new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1); setCalMonth(m); loadMarks(m); }}
            />
            {!copyMode && (
              <Pressable style={styles.todayBtn} onPress={() => { setDate(todayIso); setCalOpen(false); }}>
                <FsText variant="bodyMedium" style={{ color: colors.white }}>Today</FsText>
              </Pressable>
            )}
            <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[2] }}>
              {copyMode ? 'Dots mark days with logged food. Tap a day to choose what to copy.' : 'Dots mark days with logged food.'}
            </FsText>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Item-selection copy: pick which items from the source day to copy (A1). */}
      <Modal visible={!!copySource} transparent animationType="fade" onRequestClose={closeCopy}>
        <Pressable style={styles.backdrop} onPress={closeCopy}>
          <Pressable style={styles.calCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: 2 }}>Copy items</FsText>
            {copySource && (
              <FsText variant="caption" style={{ marginBottom: space[3] }}>
                From {shortDate(copySource.date)} into {shortDate(date)}{copyMode && copyMode !== 'DAY' ? ` · ${MEALS.find((x) => x.key === copyMode)?.label}` : ''}
              </FsText>
            )}
            <Pressable onPress={toggleCopyAll} style={styles.copyRow}>
              {allCopySelected ? <CheckSquare color={colors.primary} size={18} /> : <Square color={colors.muted} size={18} />}
              <FsText variant="bodyMedium">{allCopySelected ? 'Deselect all' : 'Select all'}</FsText>
            </Pressable>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {copySource?.logs.map((l) => {
                const sel = copySel.has(l.id);
                const nm = l.foodItem?.name ?? l.custom?.name ?? l.recipe?.name ?? 'Item';
                const kc = Math.round((l.foodItem ? l.foodItem.calories : l.custom ? l.custom.calories : l.recipe?.nutrition?.perServingCalories ?? 0) * l.servingQty);
                return (
                  <Pressable key={l.id} onPress={() => toggleCopySel(l.id)} style={styles.copyRow}>
                    {sel ? <CheckSquare color={colors.primary} size={18} /> : <Square color={colors.muted} size={18} />}
                    <View style={{ flex: 1 }}>
                      <FsText variant="bodyMedium" numberOfLines={1}>{nm}</FsText>
                      {copyMode === 'DAY' && <FsText variant="caption">{MEALS.find((x) => x.key === l.meal)?.label ?? l.meal}</FsText>}
                    </View>
                    <FsText variant="caption">{kc} kcal</FsText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={closeCopy} /></View>
              <View style={{ flex: 1 }}><Button title={`Copy ${copySel.size}`} onPress={confirmCopy} disabled={copySel.size === 0} /></View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Save-as-meal name prompt (A5) */}
      <Modal visible={!!savingMeal} transparent animationType="fade" onRequestClose={() => setSavingMeal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSavingMeal(null)}>
          <Pressable style={styles.calCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: 4 }}>Save as meal</FsText>
            <FsText variant="caption" style={{ marginBottom: space[3] }}>Re-log these items together in one tap later.</FsText>
            <TextInput
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g. My usual breakfast"
              placeholderTextColor={colors.muted}
              style={styles.nameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmSaveMeal}
            />
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => setSavingMeal(null)} /></View>
              <View style={{ flex: 1 }}><Button title="Save" onPress={confirmSaveMeal} /></View>
            </View>
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
        favorite={editing?.foodItem || editing?.recipe ? { active: favActive, onToggle: toggleEditFav } : undefined}
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
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  todayBtn: { marginTop: space[3], backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  nameInput: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
}));
