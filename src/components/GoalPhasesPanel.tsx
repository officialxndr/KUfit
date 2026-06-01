import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { ChevronLeft, Trash2, Plus, Target } from 'lucide-react-native';

import { FsText, Button, Card, Chip, Badge } from '@/components/ui';
import { healthRepo } from '@/lib/repositories/HealthRepo';
import { useSettingsStore } from '@/stores/settingsStore';
import { toKg, formatWeight, UNIT_LABELS } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { GoalPhase, GoalType } from '@/types';

const GOALS: GoalType[] = ['LOSE', 'MAINTAIN', 'GAIN'];
const todayIso = () => new Date().toISOString().slice(0, 10);
const isActive = (p: GoalPhase) => {
  const t = todayIso();
  return p.startDate <= t && p.endDate >= t;
};

/**
 * Goal Phases / Cycles editor body. Rendered both as a standalone route
 * (`app/goal-phases.tsx`) and as a sub-page **inside** the Goals modal — so the
 * back arrow returns to wherever it was opened from (`onBack`).
 */
export function GoalPhasesPanel({ onBack }: { onBack: () => void }) {
  const unit = useSettingsStore((s) => s.profile.unitSystem);
  const [phases, setPhases] = useState<GoalPhase[]>([]);
  const [creating, setCreating] = useState(false);

  // form state
  const [name, setName] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('LOSE');
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [calorie, setCalorie] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const refresh = () => setPhases(healthRepo.getGoalPhases());
  useEffect(() => { refresh(); }, []);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const resetForm = () => {
    setName(''); setGoalType('LOSE'); setStart(todayIso()); setEnd('');
    setTargetWeight(''); setCalorie(''); setProtein(''); setCarbs(''); setFat('');
  };

  const save = () => {
    if (!name.trim()) return Alert.alert('Name required', 'Give the phase a name.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return Alert.alert('Dates required', 'Enter start and end dates as YYYY-MM-DD.');
    }
    if (end < start) return Alert.alert('Invalid range', 'End date must be after the start date.');
    healthRepo.saveGoalPhase({
      name: name.trim(),
      goalType,
      startDate: start,
      endDate: end,
      targetWeightKg: targetWeight.trim() ? toKg(Number(targetWeight), unit) : null,
      targetBodyFat: null,
      weeklyRateKg: null,
      calorieTarget: num(calorie),
      proteinTarget: num(protein),
      carbsTarget: num(carbs),
      fatTarget: num(fat),
      cycleId: null,
    });
    resetForm();
    setCreating(false);
    refresh();
  };

  const remove = (p: GoalPhase) =>
    Alert.alert('Delete phase?', `Remove "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { healthRepo.deleteGoalPhase(p.id); refresh(); } },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft color={colors.text} size={24} />
          <FsText variant="bodyMedium">Goals</FsText>
        </Pressable>
        <FsText variant="cardTitle">Goal Phases</FsText>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }} keyboardShouldPersistTaps="handled">
        <FsText variant="caption" style={{ marginBottom: space[3] }}>
          Phases are dated training/diet blocks. Whichever phase covers today automatically drives your
          calorie & macro targets (overriding the profile defaults).
        </FsText>

        {phases.length === 0 && !creating && (
          <Card style={{ alignItems: 'center', gap: space[2], paddingVertical: space[6], marginBottom: space[3] }}>
            <View style={styles.iconWrap}><Target color={colors.primary} size={24} /></View>
            <FsText variant="cardTitle" style={{ color: colors.muted }}>No phases yet</FsText>
            <FsText variant="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
              Plan a cut, bulk, or maintenance block with its own targets and dates.
            </FsText>
          </Card>
        )}

        {phases.map((p) => (
          <Card key={p.id} style={{ marginBottom: space[3] }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <FsText variant="cardTitle">{p.name}</FsText>
                  {isActive(p) && <Badge label="Active" tone="success" />}
                </View>
                <FsText variant="caption" style={{ marginTop: 2 }}>
                  {p.goalType[0] + p.goalType.slice(1).toLowerCase()} · {p.startDate} → {p.endDate}
                </FsText>
                <FsText variant="caption" style={{ marginTop: 2 }}>
                  {p.targetWeightKg != null ? `Target ${formatWeight(p.targetWeightKg, unit)}` : 'No target weight'}
                  {p.calorieTarget != null ? ` · ${p.calorieTarget} kcal` : ''}
                </FsText>
              </View>
              <Pressable onPress={() => remove(p)} hitSlop={8}><Trash2 color={colors.muted} size={16} /></Pressable>
            </View>
          </Card>
        ))}

        {creating ? (
          <Card outlined style={{ borderColor: colors.primary, gap: space[3] }}>
            <FsText variant="bodyMedium" style={{ color: colors.primary }}>New Phase</FsText>
            <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Spring Cut" />
            <View>
              <FsText variant="caption" style={{ marginBottom: 6 }}>Goal type</FsText>
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                {GOALS.map((g) => (
                  <Chip key={g} label={g[0] + g.slice(1).toLowerCase()} selected={goalType === g} onPress={() => setGoalType(g)} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <View style={{ flex: 1 }}><Input label="Start (YYYY-MM-DD)" value={start} onChangeText={setStart} placeholder="2026-06-01" /></View>
              <View style={{ flex: 1 }}><Input label="End (YYYY-MM-DD)" value={end} onChangeText={setEnd} placeholder="2026-08-01" /></View>
            </View>
            <Input label={`Target weight (${UNIT_LABELS[unit].weight})`} value={targetWeight} onChangeText={setTargetWeight} keyboardType="decimal-pad" placeholder="optional" />
            <FsText variant="overline">Target overrides (optional)</FsText>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <View style={{ flex: 1 }}><Input label="Calories" value={calorie} onChangeText={setCalorie} keyboardType="numeric" placeholder="auto" /></View>
              <View style={{ flex: 1 }}><Input label="Protein g" value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="—" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <View style={{ flex: 1 }}><Input label="Carbs g" value={carbs} onChangeText={setCarbs} keyboardType="numeric" placeholder="—" /></View>
              <View style={{ flex: 1 }}><Input label="Fat g" value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="—" /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => { setCreating(false); resetForm(); }} /></View>
              <View style={{ flex: 1 }}><Button title="Save Phase" onPress={save} /></View>
            </View>
          </Card>
        ) : (
          <Pressable onPress={() => setCreating(true)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2] }}>
              <Plus color={colors.primary} size={18} />
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>New Phase</FsText>
            </Card>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Input({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <View>
      <FsText variant="caption" style={{ marginBottom: 6 }}>{label}</FsText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 60 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 14,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
}));
