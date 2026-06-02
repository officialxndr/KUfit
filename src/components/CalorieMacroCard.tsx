import { View, StyleSheet } from 'react-native';

import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBar';
import { space, themedStyles } from '@/theme/tokens';

/**
 * The shared "calories + macros" summary block — a circular calorie ring beside
 * the macro bars. Used by both Dashboard → Overview and Food → Today so the two
 * stay visually identical.
 */
export function CalorieMacroCard({
  calories, protein, carbs, fat, targets, burned = 0, ringSize = 124,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targets: { calorieTarget: number | null; proteinTarget: number | null; carbsTarget: number | null; fatTarget: number | null };
  /** Active-calorie burn already folded into `targets.calorieTarget`, shown as a flame line. */
  burned?: number;
  ringSize?: number;
}) {
  return (
    <View style={styles.row}>
      <CalorieRing eaten={calories} goal={targets.calorieTarget ?? 0} burned={burned} size={ringSize} strokeWidth={12} />
      <View style={{ flex: 1 }}>
        <MacroBars
          protein={protein}
          carbs={carbs}
          fat={fat}
          proteinTarget={targets.proteinTarget}
          carbsTarget={targets.carbsTarget}
          fatTarget={targets.fatTarget}
        />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[6] },
}));
