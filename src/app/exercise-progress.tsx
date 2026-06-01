import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { X, GitCompare } from 'lucide-react-native';

import { FsText, Card } from '@/components/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { LineChart, type Series } from '@/components/LineChart';
import { workoutRepo } from '@/lib/repositories/WorkoutRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/units';
import { colors, space } from '@/theme/tokens';

const COMPARE_COLOR = colors.macroFat;
const CHART_H = 80;
const fmtVol = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

export default function ExerciseProgress() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useSettingsStore((s) => s.profile.unitSystem);

  const [primaryName, setPrimaryName] = useState('Exercise');
  const [history, setHistory] = useState<ReturnType<typeof workoutRepo.getExerciseSessionHistory>>([]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareName, setCompareName] = useState('');
  const [compareHistory, setCompareHistory] = useState<ReturnType<typeof workoutRepo.getExerciseSessionHistory>>([]);
  const [picking, setPicking] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    setPrimaryName(workoutRepo.getExerciseById(id)?.name ?? 'Exercise');
    setHistory(workoutRepo.getExerciseSessionHistory(id));
  }, [id]);
  useFocusEffect(refresh);

  const others = useMemo(
    () => workoutRepo.getExercisesWithHistory().filter((e) => e.id !== id),
    [id]
  );

  const pickCompare = (cid: string, name: string) => {
    setCompareId(cid);
    setCompareName(name);
    setCompareHistory(workoutRepo.getExerciseSessionHistory(cid));
    setPicking(false);
  };
  const clearCompare = () => { setCompareId(null); setCompareName(''); setCompareHistory([]); };

  const best1RM = history.reduce((m, h) => Math.max(m, h.est1RM), 0);
  const latest = history[history.length - 1];
  const maxVol = Math.max(...history.map((h) => h.volume), 1);

  const oneRMSeries: Series[] = [{ points: history.map((h) => h.est1RM), color: colors.primary }];
  if (compareHistory.length) oneRMSeries.push({ points: compareHistory.map((h) => h.est1RM), color: COMPARE_COLOR });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        <FsText variant="cardTitle" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{primaryName}</FsText>
        <Pressable onPress={() => (compareId ? clearCompare() : setPicking(true))} hitSlop={10}>
          <GitCompare color={compareId ? colors.primary : colors.muted} size={22} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 60 }}>
        {history.length === 0 ? (
          <FsText variant="caption">No logged sets for this exercise yet.</FsText>
        ) : (
          <>
            <View style={styles.statRow}>
              <Stat label="Best 1RM" value={formatWeight(best1RM, unit)} />
              <Stat label="Latest 1RM" value={latest ? formatWeight(latest.est1RM, unit) : '—'} />
              <Stat label="Sessions" value={String(history.length)} />
            </View>

            <Card style={{ marginBottom: space[3] }}>
              <View style={styles.legendRow}>
                <FsText variant="cardTitle">Estimated 1RM</FsText>
                {compareId ? (
                  <View style={{ flexDirection: 'row', gap: space[3] }}>
                    <Legend color={colors.primary} label={primaryName} />
                    <Legend color={COMPARE_COLOR} label={compareName} />
                  </View>
                ) : null}
              </View>
              <LineChart series={oneRMSeries} height={150} format={(v) => formatWeight(v, unit)} />
            </Card>

            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space[3] }}>
                <FsText variant="cardTitle">Volume per session</FsText>
                <FsText variant="caption">kg · last {Math.min(history.length, 12)}</FsText>
              </View>
              <View style={styles.bars}>
                {history.slice(-12).map((h, i, arr) => (
                  <View key={i} style={styles.barCol}>
                    <FsText variant="caption" style={styles.barValue}>{fmtVol(h.volume)}</FsText>
                    <View
                      style={{
                        width: '100%', maxWidth: 18,
                        height: Math.max((h.volume / maxVol) * CHART_H, 3),
                        borderTopLeftRadius: 3, borderTopRightRadius: 3,
                        backgroundColor: colors.primary,
                        opacity: i === arr.length - 1 ? 1 : 0.55,
                      }}
                    />
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      <BottomSheet visible={picking} onClose={() => setPicking(false)}>
        <FsText variant="h2" style={{ textAlign: 'center', marginBottom: space[3] }}>Compare with…</FsText>
        <ScrollView style={{ maxHeight: 360 }}>
          {others.length === 0 ? (
            <FsText variant="caption">No other exercises with history yet.</FsText>
          ) : (
            others.map((e) => (
              <Pressable key={e.id} style={styles.pickRow} onPress={() => pickCompare(e.id, e.name)}>
                <FsText variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{e.name}</FsText>
                <FsText variant="caption">{e.sessions} sessions</FsText>
              </Pressable>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <FsText variant="overline">{label}</FsText>
      <FsText variant="cardTitle" style={{ marginTop: 4 }}>{value}</FsText>
    </Card>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <FsText variant="caption" numberOfLines={1} style={{ maxWidth: 120 }}>{label}</FsText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    paddingHorizontal: space[4], paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  statCard: { flex: 1, alignItems: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space[2] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 18, gap: 3 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barValue: { fontSize: 9, marginBottom: 2, fontVariant: ['tabular-nums'] },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    paddingVertical: space[3], borderTopWidth: 1, borderTopColor: colors.border,
  },
});
