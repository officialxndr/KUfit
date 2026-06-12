import { useEffect, useRef, useState } from 'react';
import {
  View, TextInput, StyleSheet, Pressable, Modal, ScrollView, Dimensions,
  Platform, Animated, PanResponder, Keyboard,
} from 'react-native';
import { ChevronDown, Star, Scale as ScaleIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FsText, Button } from '@/components/ui';
import { MacroBars } from '@/components/MacroBar';
import { FoodBadgeRow, FoodDetailSections } from '@/components/FoodDetails';
import { ScaleWeighBar } from '@/components/ScaleWeighBar';
import { useScale } from '@/lib/scales/useScale';
import type { ScaleDisplayUnit } from '@/lib/scales/types';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { resolveTargets } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, shadow, themedStyles } from '@/theme/tokens';
import type { FoodDetails } from '@/types';

const SCREEN_H = Dimensions.get('window').height;

/** Minimal nutrition shape the sheet needs — satisfied by FoodCandidate, FoodItem, or a recipe serving. */
export interface SheetFood {
  name: string;
  brand?: string | null;
  servingSize: number;
  servingUnit: string;
  /** Household serving descriptor, e.g. "2 cookies" — shown alongside the gram serving. */
  servingText?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  saturatedFat?: number | null;
  details?: FoodDetails | null;
  /** Last amount + unit this item was logged at — prefills the quantity field (add mode only). */
  lastAmount?: number | null;
  lastUnit?: string | null;
}

// Conversions to a canonical base (grams for mass, ml for volume).
const UNIT_TO_CANONICAL: Record<string, number> = {
  g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
  ml: 1, l: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, 'fl oz': 29.5735,
};
const MASS_UNITS = ['g', 'kg', 'oz', 'lb'];
const VOLUME_UNITS = ['ml', 'l', 'tsp', 'tbsp', 'cup', 'fl oz'];

// Selected food unit → the scale's display unit, so its LCD follows the picker (g→g, oz→oz).
// Units the scale can't show (serving/tsp/tbsp/cup/kg/lb/l) fall back to grams.
const SCALE_DISPLAY_UNIT: Record<string, ScaleDisplayUnit> = { g: 'g', oz: 'oz', ml: 'ml', 'fl oz': 'floz' };

/** Units offered for a food, based on whether its serving is a mass or volume. */
function unitsFor(servingUnit: string | undefined): string[] {
  const u = (servingUnit ?? '').toLowerCase();
  if (MASS_UNITS.includes(u)) return ['serving', 'g', 'oz'];
  if (VOLUME_UNITS.includes(u)) return ['serving', 'ml', 'tsp', 'tbsp', 'cup', 'fl oz'];
  return ['serving'];
}
const unitLabel = (u: string) => (u === 'serving' ? 'serving' : u);

/** Convert an amount (in `unit`) to a servings multiplier for the given food. */
function amountToServings(food: SheetFood, amt: number, unit: string): number {
  if (unit === 'serving') return amt;
  const baseCanon = food.servingSize * (UNIT_TO_CANONICAL[(food.servingUnit ?? '').toLowerCase()] ?? 1);
  const unitCanon = UNIT_TO_CANONICAL[unit] ?? 1;
  return baseCanon > 0 ? (amt * unitCanon) / baseCanon : amt;
}
function servingsToAmount(food: SheetFood, servings: number, unit: string): number {
  if (unit === 'serving') return servings;
  const baseCanon = food.servingSize * (UNIT_TO_CANONICAL[(food.servingUnit ?? '').toLowerCase()] ?? 1);
  const unitCanon = UNIT_TO_CANONICAL[unit] ?? 1;
  return unitCanon > 0 ? (servings * baseCanon) / unitCanon : servings;
}

interface Props {
  /** The food to log/edit; `null` keeps the sheet closed. */
  food: SheetFood | null;
  /** Day the log belongs to — drives the "after" projection against day totals. */
  date: string;
  /** Servings the sheet opens at (defaults to 1). */
  initialServings?: number;
  /** Servings of this item already counted in the day's totals (edit mode) so the
   *  projection replaces rather than stacks on the existing entry. */
  baselineQty?: number;
  /** Primary action label (e.g. "Add to Log" / "Save"). */
  submitLabel?: string;
  /** `servings` is the canonical multiplier; `entry` is the raw amount + unit the
   *  user typed (so callers can remember it for next time). */
  onSubmit: (servings: number, entry: { amount: number; unit: string }) => void;
  onClose: () => void;
  /** When provided, a Delete button appears alongside Cancel. */
  onDelete?: () => void;
  /** When provided, a favorite star toggle appears next to the name. */
  favorite?: { active: boolean; onToggle: () => void };
}

/**
 * Bottom-sheet quantity editor with a live nutrition + day-progress summary.
 * Shared by the add-food flow (mode add) and the Today log editor (mode edit,
 * via `baselineQty` + `onDelete`).
 */
export function FoodQuantitySheet({
  food, date, initialServings = 1, baselineQty = 0, submitLabel = 'Add to Log', onSubmit, onClose, onDelete, favorite,
}: Props) {
  const profile = useSettingsStore((s) => s.profile);
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(String(initialServings));
  const [unit, setUnit] = useState('serving');
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Live weighing (Bluetooth scale): while on, the scale's grams drive the amount field,
  // so the macro + day-projection display below updates as you add/remove food. `sim`
  // runs the simulator (no hardware / works in Expo Go).
  const [weighing, setWeighing] = useState(false);
  const [sim, setSim] = useState(false);
  const scale = useScale({ simulate: sim });

  // Track keyboard height so the sheet can shrink to stay fully on-screen while
  // typing. The KeyboardAvoidingView lifts the sheet above the keyboard; without
  // also capping the height, a tall sheet (lots of food details) gets pushed off
  // the top and hides the amount field being edited.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Cap the whole sheet so its top edge stays a clear gap below the notch/camera
  // cutout (and above the keyboard when open), then bound the inner ScrollView
  // (absolute points) so it reliably scrolls. Reserving chrome (grabber + title +
  // pinned actions + paddings) keeps the action buttons pinned and tall content
  // scrollable.
  const sheetMaxHeight = SCREEN_H - insets.top - 24 - kbHeight;
  const scrollMaxHeight = sheetMaxHeight - (kbHeight > 0 ? 0 : insets.bottom) - 180;

  // Drag-to-dismiss: the sheet rides a translateY driver. The handle region owns a
  // PanResponder for the swipe-down gesture; the content ScrollView (no longer
  // wrapped in a Pressable) scrolls independently.
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const scrollRef = useRef<ScrollView>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Full-screen dim fades in as the sheet slides up (and lightens as you drag down).
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SCREEN_H],
    outputRange: [0.55, 0],
    extrapolate: 'clamp',
  });

  // Reset + slide in whenever a new food is selected. In add mode (no baseline),
  // prefill the last amount + unit this item was logged at, if we have one and it's
  // valid for this food; otherwise fall back to the default serving entry.
  useEffect(() => {
    if (food) {
      const validUnits = unitsFor(food.servingUnit);
      const remembered = baselineQty === 0 && food.lastAmount != null && food.lastUnit && validUnits.includes(food.lastUnit);
      if (remembered) {
        setAmount(String(food.lastAmount));
        setUnit(food.lastUnit!);
      } else {
        setAmount(String(initialServings));
        setUnit('serving');
      }
      setUnitMenuOpen(false);
      translateY.setValue(SCREEN_H);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }).start();
    }
  }, [food, initialServings, baselineQty, translateY]);

  // Don't carry weigh mode across foods (or into a closed sheet).
  useEffect(() => { setWeighing(false); setSim(false); }, [food]);

  // Connect/disconnect the scale with weigh mode (restart when toggling the simulator).
  useEffect(() => {
    if (!weighing) return;
    scale.start();
    return () => scale.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighing, sim]);

  // Default to grams when weigh mode turns on (the scale's native unit).
  useEffect(() => { if (weighing) { setUnit('g'); setUnitMenuOpen(false); } }, [weighing]);

  // Mirror the selected unit onto the scale's own display so its LCD follows the picker
  // (g→g, oz→oz); units the scale can't show fall back to grams. No-op until connected.
  useEffect(() => {
    if (weighing && scale.status === 'connected') scale.setUnit(SCALE_DISPLAY_UNIT[unit] ?? 'g');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighing, unit, scale.status]);

  // Live grams drive the amount field, shown in the currently-selected unit. Macros resolve the
  // amount back to grams (the unit factor cancels), so they stay correct regardless of display unit.
  useEffect(() => {
    if (!weighing || !scale.reading || !food) return;
    const g = scale.reading.grams;
    if (unit === 'serving') { setAmount(String(Math.round(amountToServings(food, g, 'g') * 100) / 100)); return; }
    const canon = UNIT_TO_CANONICAL[unit];
    setAmount(String(canon ? Math.round((g / canon) * 100) / 100 : g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighing, scale.reading, unit]);

  const animateClose = () => {
    Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true })
      .start(() => closeRef.current());
  };

  const handlePan = useRef(
    PanResponder.create({
      // The grab strip has no tappable children, so claim the touch immediately —
      // press the bar and drag down to dismiss; a short drag springs back.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: SCREEN_H, duration: 200, useNativeDriver: true })
            .start(() => closeRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    })
  ).current;

  const selectUnit = (u: string) => {
    setUnitMenuOpen(false);
    if (!food || u === unit) return;
    // Keep the same physical quantity when switching units.
    const servings = amountToServings(food, Number(amount) || 0, unit);
    setAmount(String(Math.round(servingsToAmount(food, servings, u) * 100) / 100));
    setUnit(u);
  };

  const submit = () => {
    if (!food) return;
    const amt = Number(amount) || 0;
    const qty = amountToServings(food, amt, unit);
    if (!qty || qty <= 0) return;
    onSubmit(qty, { amount: amt, unit });
  };

  return (
    <Modal visible={!!food} transparent animationType="none" statusBarTranslucent onRequestClose={animateClose}>
      <View style={{ flex: 1 }}>
        {/* Dim backdrop (fades with the sheet's travel) + transparent tap layer. */}
        <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]} pointerEvents="none" />
        <Pressable style={styles.backdropTouch} onPress={animateClose} />
        <View style={[styles.sheetWrap, { paddingBottom: kbHeight }]} pointerEvents="box-none">
            <Animated.View style={[styles.sheet, { maxHeight: sheetMaxHeight, paddingBottom: (kbHeight > 0 ? space[4] : insets.bottom + space[4]), transform: [{ translateY }] }]}>
              {food && (() => {
              const availableUnits = unitsFor(food.servingUnit);
              const qty = amountToServings(food, Number(amount) || 0, unit);
              const add = {
                cal: food.calories * qty,
                p: food.protein * qty,
                c: food.carbs * qty,
                f: food.fat * qty,
              };
              const targets = resolveTargets(profile);
              const totals = foodRepo.getDayTotals(date);
              // Strip the existing entry's contribution so edits replace it.
              const baseCal = totals.calories - food.calories * baselineQty;
              const baseP = totals.protein - food.protein * baselineQty;
              const baseC = totals.carbs - food.carbs * baselineQty;
              const baseF = totals.fat - food.fat * baselineQty;
              const goal = targets.calorieTarget ?? 0;
              const after = baseCal + add.cal;
              const remaining = goal - after;
              const calPct = goal > 0 ? Math.min(after / goal, 1) : 0;
              const over = goal > 0 && after > goal;
              return (
                <>
                  {/* Drag strip — grab the bar and swipe down to dismiss. */}
                  <View style={styles.grabStrip} {...handlePan.panHandlers}>
                    <View style={styles.grabber} />
                  </View>
                  <View style={styles.handleText}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <FsText variant="cardTitle" numberOfLines={1} style={{ flex: 1 }}>{food.name}</FsText>
                      {favorite && (
                        <Pressable onPress={favorite.onToggle} hitSlop={10}>
                          <Star color={favorite.active ? colors.warning : colors.muted} size={22} fill={favorite.active ? colors.warning : 'transparent'} />
                        </Pressable>
                      )}
                    </View>
                    <FsText variant="caption" style={{ marginTop: 2 }}>
                      {food.brand ? `${food.brand} · ` : ''}{Math.round(food.calories)} kcal per {food.servingSize}{food.servingUnit}{food.servingText ? ` · ${food.servingText}` : ''}
                    </FsText>
                  </View>

                  <ScrollView
                    ref={scrollRef}
                    style={{ maxHeight: scrollMaxHeight }}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingTop: space[3], paddingBottom: space[2] }}
                  >
                  <FoodBadgeRow details={food.details} />

                  <View style={styles.qtyRow}>
                    <View style={styles.qtyField}>
                      <TextInput
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        style={[styles.input, { textAlign: 'center' }]}
                        selectTextOnFocus
                        onFocus={() => requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }))}
                      />
                    </View>
                    {availableUnits.length > 1 ? (
                      <View style={{ flex: 1 }}>
                        <Pressable style={styles.unitSelect} onPress={() => setUnitMenuOpen((o) => !o)}>
                          <FsText variant="bodyMedium">{unitLabel(unit)}{unit === 'serving' && qty !== 1 ? 's' : ''}</FsText>
                          <ChevronDown color={colors.muted} size={16} />
                        </Pressable>
                        {unitMenuOpen && (
                          <View style={styles.unitMenu}>
                            {availableUnits.map((u) => (
                              <Pressable key={u} style={styles.unitMenuItem} onPress={() => selectUnit(u)}>
                                <FsText variant="bodyMedium" style={{ color: u === unit ? colors.primary : colors.text }}>
                                  {unitLabel(u)}
                                </FsText>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    ) : (
                      <FsText variant="caption" style={{ flex: 1 }}>serving{qty !== 1 ? 's' : ''}</FsText>
                    )}
                    {availableUnits.includes('g') && (
                      <Pressable
                        style={[styles.scaleBtn, weighing && styles.scaleBtnOn]}
                        onPress={() => setWeighing((w) => !w)}
                        accessibilityLabel="Weigh on Bluetooth scale"
                      >
                        <ScaleIcon color={weighing ? colors.white : colors.primary} size={18} />
                      </Pressable>
                    )}
                  </View>

                  {/* Live weigh bar — Bluetooth scale drives the grams above (macros update live). */}
                  {weighing && (
                    <View style={{ marginBottom: space[3] }}>
                      <ScaleWeighBar scale={scale} onSimulate={() => setSim(true)} onClose={() => { setWeighing(false); setSim(false); }} />
                    </View>
                  )}

                  {/* Quick portions — USDA household sizes (discrete base foods). Tap to fill grams. */}
                  {food.details?.portions?.length && availableUnits.includes('g') ? (
                    <View style={styles.portionWrap}>
                      <FsText variant="overline" style={{ marginBottom: space[2] }}>Quick portions</FsText>
                      <View style={styles.portionRow}>
                        {food.details.portions.map((p) => {
                          const active = unit === 'g' && Number(amount) === p.grams;
                          return (
                            <Pressable
                              key={p.label}
                              style={[styles.portionChip, active && styles.portionChipActive]}
                              onPress={() => { setUnitMenuOpen(false); setUnit('g'); setAmount(String(p.grams)); }}
                            >
                              <FsText variant="caption" style={{ color: active ? '#fff' : colors.text }}>
                                {p.label} {p.grams}g
                              </FsText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {/* Nutrition summary */}
                  <View style={styles.summary}>
                    <View style={styles.summaryTop}>
                      <View>
                        <FsText variant="overline">This food adds</FsText>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <FsText variant="stat">{Math.round(add.cal)}</FsText>
                          <FsText variant="caption"> kcal</FsText>
                        </View>
                      </View>
                      <View style={styles.macroRow}>
                        <Macro label="P" v={add.p} c={colors.macroProtein} />
                        <Macro label="C" v={add.c} c={colors.macroCarbs} />
                        <Macro label="F" v={add.f} c={colors.macroFat} />
                      </View>
                    </View>

                    {goal > 0 && (
                      <View style={{ marginTop: space[3] }}>
                        <View style={styles.barHead}>
                          <FsText variant="caption">Calories</FsText>
                          <FsText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
                            {Math.round(after)} / {goal} · {remaining < 0 ? `${Math.abs(Math.round(remaining))} over` : `${Math.round(remaining)} left`}
                          </FsText>
                        </View>
                        <View style={styles.track}>
                          <View style={{ width: `${calPct * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: over ? colors.danger : colors.success }} />
                        </View>
                      </View>
                    )}

                    <View style={{ marginTop: space[3] }}>
                      <FsText variant="caption" style={{ marginBottom: space[2] }}>Macros</FsText>
                      <MacroBars
                        protein={baseP + add.p}
                        carbs={baseC + add.c}
                        fat={baseF + add.f}
                        proteinTarget={targets.proteinTarget}
                        carbsTarget={targets.carbsTarget}
                        fatTarget={targets.fatTarget}
                      />
                    </View>
                  </View>

                  <FoodDetailSections
                    core={{ fiber: food.fiber, sugar: food.sugar, saturatedFat: food.saturatedFat, sodium: food.sodium }}
                    details={food.details}
                    qty={qty}
                  />
                  </ScrollView>

                  <View style={[styles.actions, { flexDirection: 'row', gap: space[2] }]}>
                    {onDelete ? (
                      <View style={{ flex: 1 }}>
                        <Button title="Delete" variant="ghost" onPress={onDelete} />
                      </View>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Button title="Cancel" variant="ghost" onPress={animateClose} />
                      </View>
                    )}
                    <View style={{ flex: 2 }}>
                      <Button title={submitLabel} onPress={submit} />
                    </View>
                  </View>
                </>
              );
            })()}
            </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function Macro({ label, v, c }: { label: string; v: number; c: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: c }} />
      <FsText variant="caption">{label} {Math.round(v)}g</FsText>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  unitSelect: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11,
  },
  unitMenu: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    overflow: 'hidden', zIndex: 20, ...shadow.pop,
  },
  unitMenuItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  summary: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: space[3],
    marginBottom: space[3], gap: space[2],
  },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline' },
  macroRow: { flexDirection: 'row', gap: space[3], marginLeft: 'auto', alignItems: 'center' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: space[4], paddingBottom: space[8],
  },
  // Generous hit area so the grabber is easy to grab and pull down.
  grabStrip: { alignItems: 'center', paddingTop: space[1], paddingBottom: space[3] },
  handleText: { paddingBottom: space[1] },
  grabber: {
    width: 44, height: 5, borderRadius: radius.full, backgroundColor: colors.border,
  },
  actions: { paddingTop: space[2] },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] },
  portionWrap: { marginBottom: space[3] },
  portionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  portionChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border,
  },
  portionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  qtyField: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, width: 80, paddingHorizontal: 8,
  },
  scaleBtn: {
    width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border,
  },
  scaleBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  barHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[1] },
  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
}));
