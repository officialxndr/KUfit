import { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Target, CalendarRange, ChevronRight } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { StepperField } from '@/components/StepperField';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { toDisplay, toKg, formatWeight, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, tintBg, themedStyles } from '@/theme/tokens';

const DAY_MS = 86_400_000;

/** Weight-goal editor (Health). Goal weight + rate of loss → persists goalWeightKg & goalDate. */
export function HealthGoals() {
  const router = useRouter();
  const profile = useSettingsStore((s) => s.profile);
  const setProfile = useSettingsStore((s) => s.setProfile);
  const unit = profile.unitSystem;

  const [currentKg, setCurrentKg] = useState<number | null>(null);
  const [rate, setRate] = useState(unit === 'IMPERIAL' ? 1.0 : 0.5);

  const refresh = useCallback(() => {
    setCurrentKg(healthRepo.getLatestWeightEntry()?.weightKg ?? null);
  }, []);
  useFocusEffect(refresh);

  const goalDisplay = profile.goalWeightKg != null
    ? toDisplay(profile.goalWeightKg, unit)
    : currentKg != null ? Math.round(toDisplay(currentKg, unit)) : unit === 'IMPERIAL' ? 170 : 77;

  const currentDisplay = currentKg != null ? toDisplay(currentKg, unit) : null;
  const toLose = currentDisplay != null ? Math.max(currentDisplay - goalDisplay, 0) : 0;
  const weeksNeeded = rate > 0 ? toLose / rate : 0;
  const eta = new Date(Date.now() + Math.round(weeksNeeded * 7) * DAY_MS);
  const etaStr = eta.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const calPerDay = Math.round(rate * (unit === 'IMPERIAL' ? 500 : 1100));

  const weightLabel = UNIT_LABELS[unit].weight;
  const RATES = unit === 'IMPERIAL' ? [0.5, 1.0, 1.5, 2.0] : [0.25, 0.5, 0.75, 1.0];


  const applyRate = (r: number) => {
    setRate(r);
    if (currentDisplay != null && profile.goalWeightKg != null) {
      const weeks = r > 0 ? Math.max(currentDisplay - goalDisplay, 0) / r : 0;
      const d = new Date(Date.now() + Math.round(weeks * 7) * DAY_MS);
      setProfile({ goalDate: d.toISOString().slice(0, 10) });
    }
  };

  const rateNote =
    rate <= (unit === 'IMPERIAL' ? 0.5 : 0.25) ? 'Conservative · very sustainable'
      : rate <= (unit === 'IMPERIAL' ? 1.0 : 0.5) ? 'Moderate · recommended'
        : rate <= (unit === 'IMPERIAL' ? 1.5 : 0.75) ? 'Aggressive · challenging'
          : 'Very aggressive · hard to sustain';

  return (
    <>
      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="caption">Current Weight</FsText>
        <FsText variant="display" style={{ marginTop: 2 }}>
          {currentKg != null ? formatWeight(currentKg, unit) : '—'}
        </FsText>
      </Card>

      <Card style={{ marginBottom: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <FsText variant="overline">Goal Weight</FsText>
          {toLose > 0 && (
            <FsText variant="caption" style={{ marginTop: 2 }}>
              {toLose.toFixed(1)} {weightLabel} to lose
            </FsText>
          )}
        </View>
        <StepperField
          value={goalDisplay}
          onCommit={(n) => setProfile({ goalWeightKg: toKg(n, unit) })}
          step={1}
          min={50}
          max={600}
          unit={weightLabel}
        />
      </Card>

      <Card style={{ marginBottom: space[3] }}>
        <FsText variant="overline" style={{ marginBottom: space[3] }}>Weekly Rate of Loss</FsText>
        <View style={styles.rateRow}>
          {RATES.map((r) => {
            const active = Math.abs(r - rate) < 0.001;
            return (
              <Pressable key={r} style={[styles.rateBtn, active && styles.rateActive]} onPress={() => applyRate(r)}>
                <FsText variant="bodyMedium" style={{ color: active ? colors.white : colors.muted }}>{r} {weightLabel}</FsText>
              </Pressable>
            );
          })}
        </View>
        <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[3] }}>{rateNote}</FsText>
      </Card>

      <Card style={{ backgroundColor: tintBg.primary, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <FsText variant="overline" style={{ color: colors.primary }}>Estimated Reach</FsText>
          <FsText variant="stat" style={{ marginTop: 2 }}>{toLose > 0 ? etaStr : '—'}</FsText>
          {toLose > 0 && (
            <FsText variant="caption" style={{ marginTop: 3 }}>
              {Math.round(weeksNeeded)} weeks · ~{calPerDay} cal/day deficit
            </FsText>
          )}
        </View>
        <Target color={colors.primary} size={36} strokeWidth={1.5} />
      </Card>

      <Pressable onPress={() => router.push('/goal-phases')} style={{ marginTop: space[3] }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <CalendarRange color={colors.primary} size={22} />
          <View style={{ flex: 1 }}>
            <FsText variant="cardTitle">Goal Phases &amp; Cycles</FsText>
            <FsText variant="caption">Plan dated cut/bulk/maintenance blocks with their own targets</FsText>
          </View>
          <ChevronRight color={colors.muted} size={20} />
        </Card>
      </Pressable>

      <FsText variant="caption" style={{ textAlign: 'center', marginTop: space[3] }}>
        Changes save automatically. An active phase overrides these targets.
      </FsText>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  stepBtn: {
    width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  rateRow: { flexDirection: 'row', gap: space[2] },
  rateBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center', backgroundColor: colors.surfaceHigh },
  rateActive: { backgroundColor: colors.primary },
}));
