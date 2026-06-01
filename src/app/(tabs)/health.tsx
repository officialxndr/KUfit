import { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Trash2, Calculator, Ruler } from 'lucide-react-native';

import { Screen, Card, FsText, Button, SectionHeader } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, toDisplay, formatWeight, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space } from '@/theme/tokens';
import type { HealthStats, WeightEntry } from '@/types';

const today = () => new Date().toISOString().slice(0, 10);

export default function HealthScreen() {
  const profile = useSettingsStore((s) => s.profile);
  const router = useRouter();
  const unit = profile.unitSystem;

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [stats, setStats] = useState<HealthStats | null>(null);

  const refresh = useCallback(() => {
    setStats(healthRepo.computeStats(profile.goalWeightKg, profile.goalDate));
  }, [profile.goalWeightKg, profile.goalDate]);

  useFocusEffect(refresh);

  const logWeight = () => {
    const val = Number(weight);
    if (!val || val <= 0) {
      Alert.alert('Enter a weight', 'Please enter a valid weight.');
      return;
    }
    healthRepo.upsertWeightEntry(today(), toKg(val, unit), bodyFat.trim() ? Number(bodyFat) : undefined);
    setWeight('');
    setBodyFat('');
    refresh();
  };

  const remove = (e: WeightEntry) => {
    healthRepo.deleteWeightEntry(e.id);
    refresh();
  };

  const entries = stats?.entries ?? [];
  const recent = [...entries].reverse().slice(0, 14);

  return (
    <Screen>
      <FsText variant="h1" style={{ paddingTop: space[2], marginBottom: space[4] }}>Health</FsText>

      <View style={{ flexDirection: 'row', gap: space[3], marginBottom: space[3] }}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/tdee')}>
          <Card outlined>
            <Calculator color={colors.primary} size={22} />
            <FsText variant="bodyMedium" style={{ marginTop: 6 }}>TDEE Calculator</FsText>
          </Card>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/measurements')}>
          <Card outlined>
            <Ruler color={colors.primary} size={22} />
            <FsText variant="bodyMedium" style={{ marginTop: 6 }}>Measurements</FsText>
          </Card>
        </Pressable>
      </View>

      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Log today's weight" />
        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[3] }}>
          <View style={[styles.fieldRow, { flex: 2 }]}>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="Weight"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <FsText variant="caption">{UNIT_LABELS[unit].weight}</FsText>
          </View>
          <View style={[styles.fieldRow, { flex: 1 }]}>
            <TextInput
              value={bodyFat}
              onChangeText={setBodyFat}
              placeholder="BF%"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>
        <Button title="Log Weight" onPress={logWeight} />
      </Card>

      {/* Stats */}
      <Card style={{ marginBottom: space[3] }}>
        <SectionHeader title="Trend" />
        <View style={styles.statGrid}>
          <Stat label="Current" value={stats?.current ? formatWeight(stats.current.weightKg, unit) : '—'} />
          <Stat
            label="7-day avg"
            value={stats?.avg7 != null ? formatWeight(stats.avg7, unit) : '—'}
          />
          <Stat
            label="Weekly change"
            value={
              stats?.weeklyChange != null
                ? `${stats.weeklyChange > 0 ? '+' : ''}${toDisplay(stats.weeklyChange, unit)} ${UNIT_LABELS[unit].weight}`
                : '—'
            }
            tone={stats?.weeklyChange != null ? (stats.weeklyChange < 0 ? colors.success : stats.weeklyChange > 0 ? colors.danger : colors.muted) : colors.muted}
          />
          <Stat label="Goal ETA" value={stats?.goalEta ?? '—'} />
        </View>
        {stats?.dailyCalorieDelta != null && !stats.onTrack && (
          <View style={{ marginTop: space[3] }}>
            <FsText variant="caption" style={{ color: colors.warning }}>
              {stats.dailyCalorieDelta > 0
                ? `You're behind pace. Cut ~${Math.abs(stats.dailyCalorieDelta)} kcal/day to reach your goal on time.`
                : `You're ahead of pace. You could eat ~${Math.abs(stats.dailyCalorieDelta)} more kcal/day.`}
            </FsText>
          </View>
        )}
      </Card>

      {/* Recent entries */}
      <Card>
        <SectionHeader title="Recent entries" />
        {recent.length === 0 ? (
          <FsText variant="caption">No entries yet.</FsText>
        ) : (
          recent.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <View>
                <FsText variant="bodyMedium">{formatWeight(e.weightKg, unit)}</FsText>
                <FsText variant="caption">{e.date}{e.bodyFat ? ` · ${e.bodyFat}% BF` : ''}</FsText>
              </View>
              <Pressable onPress={() => remove(e)} hitSlop={10}>
                <Trash2 color={colors.muted} size={18} />
              </Pressable>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.statCell}>
      <FsText variant="caption">{label}</FsText>
      <FsText variant="cardTitle" style={tone ? { color: tone } : undefined}>{value}</FsText>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: space[3], gap: 2 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
