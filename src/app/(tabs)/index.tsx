import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react-native';

import { Screen, Card, FsText, Button, SectionHeader, Badge } from '@/components/ui';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBar';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { resolveTargets } from '@/lib/targets';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { colors, space } from '@/theme/tokens';
import type { WeightEntry } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const profile = useSettingsStore((s) => s.profile);
  const router = useRouter();

  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [latest, setLatest] = useState<WeightEntry | null>(null);
  const [weeklyChange, setWeeklyChange] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setTotals(foodRepo.getDayTotals(today()));
    setLatest(healthRepo.getLatestWeightEntry());
    const stats = healthRepo.computeStats(profile.goalWeightKg, profile.goalDate);
    setWeeklyChange(stats.weeklyChange);
  }, [profile.goalWeightKg, profile.goalDate]);

  useFocusEffect(refresh);

  const targets = resolveTargets(profile);
  const greeting = profile.name ? `Hi, ${profile.name}` : 'Today';

  const changeKg = weeklyChange ?? 0;
  const ChangeIcon = changeKg < -0.05 ? TrendingDown : changeKg > 0.05 ? TrendingUp : Minus;
  const changeColor = changeKg < -0.05 ? colors.success : changeKg > 0.05 ? colors.danger : colors.muted;

  return (
    <Screen>
      <View style={{ paddingTop: space[2], marginBottom: space[4] }}>
        <FsText variant="h1">{greeting}</FsText>
        {!!targets.source && targets.calorieTarget != null && (
          <View style={{ marginTop: 6 }}>
            <Badge label={targets.source} tone="primary" />
          </View>
        )}
      </View>

      {/* Calorie ring + macros */}
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

      {targets.warning && (
        <Card outlined style={{ marginBottom: space[3] }}>
          <FsText variant="caption" style={{ color: colors.warning }}>{targets.warning}</FsText>
        </Card>
      )}

      {/* Weight card */}
      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Weight" />
        {latest ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <FsText variant="stat">{formatWeight(latest.weightKg, profile.unitSystem)}</FsText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ChangeIcon color={changeColor} size={16} strokeWidth={2.4} />
              <FsText variant="caption" style={{ color: changeColor }}>
                {weeklyChange != null
                  ? `${formatWeight(Math.abs(weeklyChange), profile.unitSystem)}/wk`
                  : 'Need more data'}
              </FsText>
            </View>
          </View>
        ) : (
          <FsText variant="caption">No weight logged yet.</FsText>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Button title="Log Food" onPress={() => router.push('/food')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Log Weight" variant="ghost" onPress={() => router.push('/health')} />
        </View>
      </View>
    </Screen>
  );
}
