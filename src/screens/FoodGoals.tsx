import { View, Pressable, StyleSheet } from 'react-native';
import { Lock, LockOpen } from 'lucide-react-native';

import { Card, FsText, Chip } from '@/components/ui';
import { StepperField } from '@/components/StepperField';
import { GoalWarning } from '@/components/GoalWarning';
import { resolveTargets, goalSafetyWarning } from '@/lib/targets';
import { MACRO_PRESETS, presetMacros, rescaleToCalories, rebalanceMacro, activePresetKey, type MacroKey } from '@/lib/macros';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/** Nutrition goals editor (Food section). Persists live to the calorie/macro engine. */
export function FoodGoals() {
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const targets = resolveTargets(profile);

  const calories = profile.calorieGoal ?? targets.calorieTarget ?? 2000;
  const protein = profile.proteinTarget ?? targets.proteinTarget ?? 150;
  const carbs = profile.carbsTarget ?? targets.carbsTarget ?? 200;
  const fat = profile.fatTarget ?? targets.fatTarget ?? 65;

  const macros = { protein, carbs, fat };
  const totalKcal = protein * 4 + carbs * 4 + fat * 9;
  const pPct = totalKcal ? Math.round((protein * 4) / totalKcal * 100) : 0;
  const cPct = totalKcal ? Math.round((carbs * 4) / totalKcal * 100) : 0;
  const fPct = Math.max(100 - pPct - cPct, 0);
  const activeKey = activePresetKey(macros);
  const locked = profile.lockedMacro;

  // Calorie-anchored coupling: calories rescales macros (keeping ratio); editing a
  // macro re-weights the other two; presets split the calorie goal. A locked macro
  // stays put while the other two flex. Always sums to goal.
  const setCalories = (n: number) => setProfile({ calorieGoal: n, ...toTargets(rescaleToCalories(n, macros, locked)) });
  const setMacro = (field: MacroKey, n: number) =>
    setProfile(toTargets(rebalanceMacro(calories, field, n, macros, locked)));
  const applyPreset = (r: typeof MACRO_PRESETS[number]) => setProfile(toTargets(presetMacros(calories, r, macros, locked)));
  const toggleLock = (field: MacroKey) => setProfile({ lockedMacro: locked === field ? null : field });

  return (
    <>
      {/* Macro split */}
      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="cardTitle" style={{ marginBottom: space[3] }}>Macro Split</FsText>
        <View style={styles.bar}>
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
        <FsText variant="overline" style={{ marginTop: space[4] }}>Quick Ratio Presets</FsText>
        <FsText variant="caption" style={{ marginTop: 2 }}>Split your calorie goal into a protein / carbs / fat balance.</FsText>
        <View style={styles.presetChips}>
          {MACRO_PRESETS.map((r) => (
            <Chip key={r.key} label={r.label} selected={activeKey === r.key} onPress={() => applyPreset(r)} style={styles.presetChip} />
          ))}
          <Chip label="Custom" selected={activeKey === null} onPress={() => {}} style={styles.presetChip} />
        </View>
      </Card>

      <StepperCard label="Daily Calories" value={calories} unit="kcal"
        onCommit={setCalories} step={50} min={1000} max={5000} />

      <GoalWarning message={goalSafetyWarning(profile, null)} />

      <StepperCard label="Protein" value={protein} unit="g/day"
        onCommit={(n) => setMacro('protein', n)} step={5} min={0} max={400}
        lock={{ active: locked === 'protein', onToggle: () => toggleLock('protein') }} />
      <StepperCard label="Carbohydrates" value={carbs} unit="g/day"
        onCommit={(n) => setMacro('carbs', n)} step={5} min={0} max={600}
        lock={{ active: locked === 'carbs', onToggle: () => toggleLock('carbs') }} />
      <StepperCard label="Fat" value={fat} unit="g/day"
        onCommit={(n) => setMacro('fat', n)} step={2} min={0} max={250}
        lock={{ active: locked === 'fat', onToggle: () => toggleLock('fat') }} />

      <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[1] }}>
        Macros total {totalKcal.toLocaleString()} kcal
      </FsText>
    </>
  );
}

const toTargets = (m: { protein: number; carbs: number; fat: number }) => ({
  proteinTarget: m.protein, carbsTarget: m.carbs, fatTarget: m.fat,
});

function StepperCard({
  label,
  value,
  unit,
  onCommit,
  step,
  min,
  max,
  lock,
}: {
  label: string;
  value: number;
  unit: string;
  onCommit: (n: number) => void;
  step: number;
  min: number;
  max: number;
  lock?: { active: boolean; onToggle: () => void };
}) {
  return (
    <Card style={{ ...styles.stepCard, ...(lock?.active ? styles.stepCardLocked : {}) }}>
      <View style={{ flex: 1 }}>
        <FsText variant="overline">{label}</FsText>
        <FsText variant="caption" style={{ marginTop: 2 }}>{lock?.active ? 'Locked · others adjust' : unit}</FsText>
      </View>
      {lock && (
        <Pressable onPress={lock.onToggle} hitSlop={8} style={styles.lockBtn}>
          {lock.active ? <Lock color={colors.primary} size={18} /> : <LockOpen color={colors.muted} size={18} />}
        </Pressable>
      )}
      <StepperField value={value} onCommit={onCommit} step={step} min={min} max={max} />
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
    gap: 2,
  },
  legend: { flexDirection: 'row', gap: space[4], marginTop: space[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginBottom: space[3],
  },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  presetChip: { flexGrow: 1, flexBasis: '46%', alignItems: 'center' },
  stepCardLocked: { borderWidth: 1, borderColor: colors.primary },
  lockBtn: { padding: 4 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
