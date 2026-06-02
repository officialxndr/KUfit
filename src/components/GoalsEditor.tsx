import { useCallback, useEffect, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  UtensilsCrossed, HeartPulse, Dumbbell, CalendarRange, Plus, X, ChevronRight, Lock, LockOpen,
  type LucideIcon,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, FsText, Chip } from '@/components/ui';
import { StepperField } from '@/components/StepperField';
import { DateField } from '@/components/DateField';
import { GoalWarning } from '@/components/GoalWarning';
import { GoalPhasesPanel } from '@/components/GoalPhasesPanel';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveTargets, goalSafetyWarning } from '@/lib/targets';
import { safeRateWarning } from '@/lib/tdee';
import { MACRO_PRESETS, presetMacros, rescaleToCalories, rebalanceMacro, activePresetKey, type MacroKey } from '@/lib/macros';
import { useSettingsStore, type NutrientGoal } from '@/stores/settingsStore';
import { NUTRIENT_DEFS } from '@/lib/offNutrients';
import { toDisplay, toKg, formatWeight, UNIT_LABELS } from '@/lib/units';
import { colors, space, radius, themedStyles } from '@/theme/tokens';
import type { GoalPhase, GoalType, TrainingFocus } from '@/types';

const GOAL_TYPES: { key: GoalType; label: string }[] = [
  { key: 'LOSE', label: 'Lose' },
  { key: 'MAINTAIN', label: 'Maintain' },
  { key: 'GAIN', label: 'Gain' },
];
const FOCUSES: { key: TrainingFocus; label: string }[] = [
  { key: 'CUT', label: 'Cut' },
  { key: 'MAINTAIN', label: 'Maintain' },
  { key: 'BULK', label: 'Bulk' },
  { key: 'RECOMP', label: 'Recomp' },
];

// Nutrients the user can add as a custom goal: the four core extras + the OFF catalog.
const CORE_NUTRIENTS = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];
const ALL_NUTRIENTS = [
  ...CORE_NUTRIENTS,
  ...Object.entries(NUTRIENT_DEFS).map(([key, d]) => ({ key, label: d.label, unit: d.unit })),
];
const nutrientMeta = (key: string) => ALL_NUTRIENTS.find((n) => n.key === key);

const LIMIT_KEYS = new Set(['sugar', 'saturatedFat', 'sodium', 'trans-fat', 'cholesterol', 'added-sugars', 'alcohol']);
const DEFAULT_TARGET: Record<string, number> = {
  fiber: 30, sugar: 50, saturatedFat: 20, sodium: 2300, cholesterol: 300, 'added-sugars': 25, 'trans-fat': 2,
  potassium: 3500, calcium: 1000, iron: 18, magnesium: 400, zinc: 11, 'vitamin-c': 90, 'vitamin-d': 20,
};
const defaultGoalFor = (key: string): NutrientGoal => ({
  key,
  target: DEFAULT_TARGET[key] ?? 0,
  direction: LIMIT_KEYS.has(key) ? 'limit' : 'goal',
});

/**
 * The single master goals editor (Nutrition / Health / Training), rendered both
 * inline on Dashboard → Goals and inside `GoalsEditorModal` (header gear button).
 * All edits persist live to the settings profile, which drives the calorie/macro
 * engine and the Food "Other nutrients" bars.
 */
export function GoalsEditor({ focusSection, onOpenPhases }: { focusSection?: string; onOpenPhases?: () => void }) {
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const router = useRouter();
  // When hosted in a modal, navigating to /goal-phases must close that modal first
  // (an RN Modal left mounted over a pushed route eats touches). The host passes a
  // handler that does the close-then-navigate dance; inline usage just pushes.
  const openPhases = onOpenPhases ?? (() => router.push('/goal-phases'));
  const unit = profile.unitSystem;
  const targets = resolveTargets(profile);

  const [currentKg, setCurrentKg] = useState<number | null>(null);
  const [phase, setPhase] = useState<GoalPhase | null>(null);
  const refresh = useCallback(() => {
    setCurrentKg(healthRepo.getLatestWeightEntry()?.weightKg ?? null);
    setPhase(healthRepo.getActiveGoalPhase());
  }, []);
  useFocusEffect(refresh);

  const cal = profile.calorieGoal ?? targets.calorieTarget ?? 2000;
  const protein = profile.proteinTarget ?? targets.proteinTarget ?? 150;
  const carbs = profile.carbsTarget ?? targets.carbsTarget ?? 200;
  const fat = profile.fatTarget ?? targets.fatTarget ?? 65;
  const macros = { protein, carbs, fat };
  const locked = profile.lockedMacro;
  const toTargets = (m: { protein: number; carbs: number; fat: number }) => ({ proteinTarget: m.protein, carbsTarget: m.carbs, fatTarget: m.fat });
  // Calorie-anchored: calories rescales macros; editing a macro re-weights the others; presets
  // split the goal; a locked macro stays put while the other two flex.
  const setCalories = (n: number) => setProfile({ calorieGoal: n, ...toTargets(rescaleToCalories(n, macros, locked)) });
  const setMacro = (field: MacroKey, n: number) => setProfile(toTargets(rebalanceMacro(cal, field, n, macros, locked)));
  const applyPreset = (r: typeof MACRO_PRESETS[number]) => setProfile(toTargets(presetMacros(cal, r, macros, locked)));
  const toggleLock = (field: MacroKey) => setProfile({ lockedMacro: locked === field ? null : field });

  const totalKcal = protein * 4 + carbs * 4 + fat * 9;
  const pPct = totalKcal ? Math.round((protein * 4) / totalKcal * 100) : 0;
  const cPct = totalKcal ? Math.round((carbs * 4) / totalKcal * 100) : 0;
  const fPct = Math.max(100 - pPct - cPct, 0);
  const activeKey = activePresetKey(macros);

  const goalDisplay = profile.goalWeightKg != null
    ? toDisplay(profile.goalWeightKg, unit)
    : currentKg != null ? toDisplay(currentKg, unit) : unit === 'IMPERIAL' ? 170 : 77;
  const toLoseKg = profile.goalWeightKg != null && currentKg != null ? currentKg - profile.goalWeightKg : null;

  const weeklySessions = profile.weeklySessionTarget ?? 4;
  const isMaintain = profile.goalType === 'MAINTAIN';
  const rangeDisplay = profile.goalRangeKg != null ? toDisplay(profile.goalRangeKg, unit) : 0;

  // ── Custom nutrient goals ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const goals = profile.nutrientGoals ?? [];
  const addGoal = (key: string) => {
    setPickerOpen(false);
    if (goals.some((g) => g.key === key)) return;
    setProfile({ nutrientGoals: [...goals, defaultGoalFor(key)] });
  };
  const patchGoal = (key: string, patch: Partial<NutrientGoal>) =>
    setProfile({ nutrientGoals: goals.map((g) => (g.key === key ? { ...g, ...patch } : g)) });
  const removeGoal = (key: string) =>
    setProfile({ nutrientGoals: goals.filter((g) => g.key !== key) });
  const available = ALL_NUTRIENTS.filter((n) => !goals.some((g) => g.key === n.key));

  const nutritionGroup = (
    <View key="food">
      {/* ── Nutrition (Food) ── */}
      <GroupHeader icon={UtensilsCrossed} label="Nutrition" section="Food" />
      <Card style={{ marginBottom: space[2], padding: 0 }}>
        <View style={styles.macroBlock}>
          <View style={styles.macroBar}>
            <View style={{ flex: pPct, backgroundColor: colors.macroProtein }} />
            <View style={{ flex: cPct, backgroundColor: colors.macroCarbs }} />
            <View style={{ flex: fPct, backgroundColor: colors.macroFat }} />
          </View>
          <View style={styles.legend}>
            {([['Protein', pPct, colors.macroProtein], ['Carbs', cPct, colors.macroCarbs], ['Fat', fPct, colors.macroFat]] as const).map(
              ([l, v, c]) => (
                <View key={l} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: c }]} />
                  <FsText variant="caption">
                    {l} <FsText variant="caption" style={{ color: colors.text, fontWeight: '600' }}>{v}%</FsText>
                  </FsText>
                </View>
              )
            )}
          </View>
          <FsText variant="overline" style={{ marginTop: space[3] }}>Quick Ratio Presets</FsText>
          <FsText variant="caption" style={{ marginTop: 2 }}>Split the calorie goal into a P / C / F balance.</FsText>
          <View style={styles.presetChips}>
            {MACRO_PRESETS.map((r) => (
              <Chip key={r.key} label={r.label} selected={activeKey === r.key} onPress={() => applyPreset(r)} style={styles.presetChip} />
            ))}
            <Chip label="Custom" selected={activeKey === null} onPress={() => {}} style={styles.presetChip} />
          </View>
        </View>
        <Stepper first label="Daily Calories" value={cal} unit="kcal"
          onCommit={setCalories} step={50} min={1000} max={5000} />
        <Stepper label="Protein" value={protein} unit="g" note={locked === 'protein' ? 'Locked · others adjust' : `${protein * 4} kcal · ${pPct}%`}
          onCommit={(n) => setMacro('protein', n)} step={5} min={0} max={400}
          lock={{ active: locked === 'protein', onToggle: () => toggleLock('protein') }} />
        <Stepper label="Carbohydrates" value={carbs} unit="g" note={locked === 'carbs' ? 'Locked · others adjust' : `${carbs * 4} kcal · ${cPct}%`}
          onCommit={(n) => setMacro('carbs', n)} step={5} min={0} max={600}
          lock={{ active: locked === 'carbs', onToggle: () => toggleLock('carbs') }} />
        <Stepper label="Fat" value={fat} unit="g" note={locked === 'fat' ? 'Locked · others adjust' : `${fat * 9} kcal · ${fPct}%`}
          onCommit={(n) => setMacro('fat', n)} step={2} min={0} max={250}
          lock={{ active: locked === 'fat', onToggle: () => toggleLock('fat') }} />
      </Card>

      <GoalWarning message={goalSafetyWarning(profile, null)} />

      {/* Custom nutrient goals */}
      {goals.length > 0 && (
        <Card style={{ marginBottom: space[2], padding: 0 }}>
          {goals.map((g, i) => {
            const meta = nutrientMeta(g.key);
            return (
              <View key={g.key} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <FsText variant="bodyMedium">{meta?.label ?? g.key}</FsText>
                  <Pressable onPress={() => patchGoal(g.key, { direction: g.direction === 'limit' ? 'goal' : 'limit' })} hitSlop={6}>
                    <FsText variant="caption" style={{ marginTop: 2, color: colors.primary }}>
                      {g.direction === 'limit' ? 'Limit · stay under' : 'Goal · reach at least'}
                    </FsText>
                  </Pressable>
                </View>
                <StepperField value={g.target} onCommit={(n) => patchGoal(g.key, { target: n })}
                  step={meta?.unit === 'mg' ? 50 : meta?.unit === 'µg' ? 10 : 1} min={0} max={100000} unit={meta?.unit ?? ''} />
                <Pressable onPress={() => removeGoal(g.key)} hitSlop={8} style={{ marginLeft: space[2] }}>
                  <X color={colors.muted} size={16} />
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
      <Pressable onPress={() => setPickerOpen(true)} style={styles.addNutrient}>
        <Plus color={colors.primary} size={16} />
        <FsText variant="bodyMedium" style={{ color: colors.primary }}>Track other nutrient</FsText>
      </Pressable>
    </View>
  );

  const healthGroup = (
    <View key="health">
      {/* ── Health (Weight) ── */}
      <GroupHeader icon={HeartPulse} label="Health" section="Health" />
      {phase ? (
        <Card style={{ marginBottom: space[2], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <CalendarRange color={colors.primary} size={22} />
          <View style={{ flex: 1 }}>
            <FsText variant="cardTitle">Cycle active: {phase.name}</FsText>
            <FsText variant="caption">This phase overrides your weight & calorie targets until it ends.</FsText>
          </View>
          <Pressable onPress={openPhases} hitSlop={8}>
            <ChevronRight color={colors.muted} size={20} />
          </Pressable>
        </Card>
      ) : (
        <Card style={{ marginBottom: space[2], padding: 0 }}>
          <View style={styles.rowPad}>
            <Segmented options={GOAL_TYPES} value={profile.goalType} onSelect={(g) => setProfile({ goalType: g })} />
          </View>
          <Stepper
            label="Goal Weight"
            value={goalDisplay}
            unit={UNIT_LABELS[unit].weight}
            note={isMaintain && profile.goalRangeKg
              ? `Range ${formatWeight((profile.goalWeightKg ?? toKg(goalDisplay, unit)) - profile.goalRangeKg, unit)} – ${formatWeight((profile.goalWeightKg ?? toKg(goalDisplay, unit)) + profile.goalRangeKg, unit)}`
              : toLoseKg != null && Math.abs(toLoseKg) >= 0.05
                ? `${toLoseKg > 0 ? '−' : '+'}${formatWeight(Math.abs(toLoseKg), unit)} to ${toLoseKg > 0 ? 'lose' : 'gain'}`
                : undefined}
            onCommit={(n) => setProfile({ goalWeightKg: toKg(n, unit) })}
            step={1} min={50} max={600}
          />
          {isMaintain ? (
            <Stepper
              label="Maintain Range"
              value={rangeDisplay}
              unit={`± ${UNIT_LABELS[unit].weight}`}
              note="Buffer you're happy to stay within"
              onCommit={(n) => setProfile({ goalRangeKg: n > 0 ? toKg(n, unit) : null })}
              step={1} min={0} max={50}
            />
          ) : (
            <View style={[styles.rowPad, styles.rowDivider, { gap: space[2] }]}>
              <FsText variant="bodyMedium">Goal Date</FsText>
              <FsText variant="caption" style={{ marginTop: 2, marginBottom: space[2] }}>Target date to reach it</FsText>
              <DateField
                value={profile.goalDate ?? null}
                onChange={(v) => setProfile({ goalDate: v })}
                placeholder="Pick a target date"
                minYear={new Date().getFullYear()}
                clearable
              />
            </View>
          )}
        </Card>
      )}

      <GoalWarning message={safeRateWarning(currentKg, profile.goalWeightKg, profile.goalDate, unit)} />

      {/* Goal Phases & Cycles — always reachable so a cycle can be created/edited. */}
      <Pressable onPress={openPhases} style={{ marginBottom: space[2] }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <CalendarRange color={colors.primary} size={20} />
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium">Goal Phases &amp; Cycles</FsText>
            <FsText variant="caption">Plan dated cut/bulk/maintenance blocks with their own targets</FsText>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Card>
      </Pressable>
    </View>
  );

  const trainingGroup = (
    <View key="workout">
      {/* ── Training (Workout) ── */}
      <GroupHeader icon={Dumbbell} label="Training" section="Workout" />
      <Card style={{ marginBottom: space[3], padding: 0 }}>
        <Stepper first label="Weekly Sessions" value={weeklySessions} unit="/wk"
          note={`${weeklySessions} workout${weeklySessions === 1 ? '' : 's'} per week`}
          onCommit={(n) => setProfile({ weeklySessionTarget: n })} step={1} min={1} max={7} />
        <View style={[styles.rowPad, styles.rowDivider]}>
          <FsText variant="caption" style={{ marginBottom: space[2] }}>Primary focus</FsText>
          <Segmented options={FOCUSES} value={profile.trainingFocus} onSelect={(f) => setProfile({ trainingFocus: f })} />
        </View>
      </Card>
    </View>
  );

  // Float the current section's group to the top — it's the most relevant here.
  const order =
    focusSection === 'workout' ? [trainingGroup, nutritionGroup, healthGroup]
      : focusSection === 'health' ? [healthGroup, nutritionGroup, trainingGroup]
        : [nutritionGroup, healthGroup, trainingGroup];

  return (
    <>
      {order}

      <FsText variant="caption" style={{ textAlign: 'center', marginBottom: space[4] }}>
        Changes save automatically.
      </FsText>

      {/* Nutrient picker */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Track a nutrient</FsText>
            <ScrollView style={{ maxHeight: 360 }}>
              {available.map((n) => (
                <Pressable key={n.key} style={styles.pickerRow} onPress={() => addGoal(n.key)}>
                  <FsText variant="bodyMedium">{n.label}</FsText>
                  <FsText variant="caption">{n.unit}</FsText>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Full-screen modal wrapper for the header gear button. */
export function GoalsEditorModal({ visible, onClose, focusSection }: {
  visible: boolean; onClose: () => void; focusSection?: string;
}) {
  // Goal Phases & Cycles renders as a sub-page *inside* this modal (not a pushed
  // route), so the back arrow returns here and the app header is never blocked.
  const [view, setView] = useState<'goals' | 'phases'>('goals');
  useEffect(() => { if (visible) setView('goals'); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="formSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        {view === 'phases' ? (
          <GoalPhasesPanel onBack={() => setView('goals')} />
        ) : (
          <>
            <View style={styles.modalHeader}>
              <FsText variant="h2">Goals</FsText>
              <Pressable onPress={onClose} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }} keyboardShouldPersistTaps="handled">
              <GoalsEditor focusSection={focusSection} onOpenPhases={() => setView('phases')} />
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function GroupHeader({ icon: Icon, label, section }: { icon: LucideIcon; label: string; section: string }) {
  return (
    <View style={styles.groupHeader}>
      <Icon color={colors.primary} size={16} />
      <FsText variant="overline" style={{ color: colors.muted }}>{label}</FsText>
      <FsText variant="overline" style={{ color: colors.border, marginLeft: 'auto' }}>{section}</FsText>
    </View>
  );
}

function Stepper({ label, value, unit, note, onCommit, step, min, max, first, lock }: {
  label: string; value: number; unit: string; note?: string;
  onCommit: (n: number) => void; step: number; min: number; max: number; first?: boolean;
  lock?: { active: boolean; onToggle: () => void };
}) {
  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <FsText variant="bodyMedium">{label}</FsText>
        {note ? <FsText variant="caption" style={lock?.active ? { marginTop: 2, color: colors.primary } : { marginTop: 2 }}>{note}</FsText> : null}
      </View>
      {lock && (
        <Pressable onPress={lock.onToggle} hitSlop={8} style={{ padding: 4, marginRight: space[1] }}>
          {lock.active ? <Lock color={colors.primary} size={16} /> : <LockOpen color={colors.muted} size={16} />}
        </Pressable>
      )}
      <StepperField value={value} onCommit={onCommit} step={step} min={min} max={max} unit={unit} />
    </View>
  );
}

function Segmented<T extends string>({ options, value, onSelect }: {
  options: { key: T; label: string }[]; value: T | null; onSelect: (key: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} style={[styles.segment, active && styles.segmentActive]} onPress={() => onSelect(o.key)}>
            <FsText variant="caption" style={{ color: active ? colors.white : colors.muted, fontWeight: '600' }}>{o.label}</FsText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    marginTop: space[3], marginBottom: space[2], paddingHorizontal: space[1],
  },
  macroBlock: { padding: space[4], paddingBottom: space[3] },
  macroBar: { flexDirection: 'row', height: 8, borderRadius: radius.full, overflow: 'hidden', gap: 2, marginBottom: space[2] },
  legend: { flexDirection: 'row', gap: space[4] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 2 },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[3] },
  presetChip: { flexGrow: 1, flexBasis: '46%', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  rowPad: { paddingHorizontal: space[4], paddingVertical: space[3] },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  dateInput: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8,
    color: colors.text, fontSize: 14, minWidth: 130, textAlign: 'right',
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceHigh, borderRadius: radius.md, padding: 3, gap: 2 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  addNutrient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: space[3], marginBottom: space[2],
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[4] },
  pickerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
}));
