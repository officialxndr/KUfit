import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2, Plus } from 'lucide-react-native';

import { Screen, Card, FsText, SectionHeader } from '@/components/ui';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBar';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { resolveTargets } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space } from '@/theme/tokens';
import type { FoodLog, MealType } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);
const MEALS: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const MEAL_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snacks',
};

export default function FoodScreen() {
  const profile = useSettingsStore((s) => s.profile);
  const router = useRouter();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  const refresh = useCallback(() => {
    setLogs(foodRepo.getLogs(today()));
    setTotals(foodRepo.getDayTotals(today()));
  }, []);

  useFocusEffect(refresh);

  const targets = resolveTargets(profile);

  const remove = (id: string) => {
    foodRepo.deleteLog(id);
    refresh();
  };

  return (
    <Screen>
      <FsText variant="h1" style={{ paddingTop: space[2], marginBottom: space[4] }}>Food</FsText>

      <Card style={{ alignItems: 'center', marginBottom: space[3] }}>
        <CalorieRing eaten={totals.calories} goal={targets.calorieTarget ?? 0} />
        <View style={{ height: space[4] }} />
        <View style={{ width: '100%' }}>
          <MacroBars
            protein={totals.protein}
            carbs={totals.carbs}
            fat={totals.fat}
            proteinTarget={targets.proteinTarget}
            carbsTarget={targets.carbsTarget}
            fatTarget={targets.fatTarget}
          />
        </View>
      </Card>

      {MEALS.map((meal) => {
        const items = logs.filter((l) => l.meal === meal);
        return (
          <Card key={meal} style={{ marginBottom: space[3] }}>
            <SectionHeader
              title={MEAL_LABEL[meal]}
              action={
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push({ pathname: '/add-food', params: { meal, date: today() } })}
                >
                  <Plus color={colors.primary} size={20} strokeWidth={2.4} />
                </Pressable>
              }
            />
            {items.length === 0 ? (
              <FsText variant="caption">Nothing logged.</FsText>
            ) : (
              items.map((l) => {
                const fi = l.foodItem;
                const cals = fi ? Math.round(fi.calories * l.servingQty) : 0;
                return (
                  <View key={l.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <FsText variant="bodyMedium" numberOfLines={1}>{fi?.name ?? 'Item'}</FsText>
                      <FsText variant="caption">
                        {l.servingQty} × {fi?.servingSize}{fi?.servingUnit} · {cals} kcal
                      </FsText>
                    </View>
                    <Pressable onPress={() => remove(l.id)} hitSlop={10}>
                      <Trash2 color={colors.muted} size={18} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: space[3],
  },
});
