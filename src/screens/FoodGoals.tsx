import { View, StyleSheet } from 'react-native';

import { Card, FsText } from '@/components/ui';
import { StepperField } from '@/components/StepperField';
import { resolveTargets } from '@/lib/targets';
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

  const macroKcal = protein * 4 + carbs * 4 + fat * 9;
  const pPct = macroKcal ? Math.round((protein * 4) / macroKcal * 100) : 0;
  const cPct = macroKcal ? Math.round((carbs * 4) / macroKcal * 100) : 0;
  const fPct = Math.max(100 - pPct - cPct, 0);
  const diff = macroKcal - calories;

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
      </Card>

      <StepperCard label="Daily Calories" value={calories} unit="kcal"
        onCommit={(n) => setProfile({ calorieGoal: n })} step={50} min={1000} max={5000} />
      <StepperCard label="Protein" value={protein} unit="g/day"
        onCommit={(n) => setProfile({ proteinTarget: n })} step={5} min={50} max={300} />
      <StepperCard label="Carbohydrates" value={carbs} unit="g/day"
        onCommit={(n) => setProfile({ carbsTarget: n })} step={5} min={50} max={500} />
      <StepperCard label="Fat" value={fat} unit="g/day"
        onCommit={(n) => setProfile({ fatTarget: n })} step={2} min={20} max={200} />

      <FsText
        variant="caption"
        style={{ textAlign: 'center', marginTop: space[1], color: diff === 0 ? colors.success : colors.warning }}
      >
        {macroKcal.toLocaleString()} kcal from macros · {Math.abs(diff)} kcal {diff > 0 ? 'over' : 'under'} goal
      </FsText>
    </>
  );
}

function StepperCard({
  label,
  value,
  unit,
  onCommit,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  unit: string;
  onCommit: (n: number) => void;
  step: number;
  min: number;
  max: number;
}) {
  return (
    <Card style={styles.stepCard}>
      <View style={{ flex: 1 }}>
        <FsText variant="overline">{label}</FsText>
        <FsText variant="caption" style={{ marginTop: 2 }}>{unit}</FsText>
      </View>
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
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
