import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { type } from '@/theme/text';

const MACRO_COLORS = {
  protein: colors.macroProtein,
  carbs: colors.macroCarbs,
  fat: colors.macroFat,
};

export function MacroBar({
  label,
  value,
  target,
  kind,
}: {
  label: string;
  value: number;
  target: number | null;
  kind: 'protein' | 'carbs' | 'fat';
}) {
  const pct = target && target > 0 ? Math.min(value / target, 1) : 0;
  const color = MACRO_COLORS[kind];
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={type.caption}>{label}</Text>
        <Text style={[type.caption, { color: colors.text }]}>
          {Math.round(value)}{target ? ` / ${target}g` : 'g'}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function MacroBars({
  protein,
  carbs,
  fat,
  proteinTarget,
  carbsTarget,
  fatTarget,
}: {
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
}) {
  return (
    <View style={{ gap: space[3] }}>
      <MacroBar label="Protein" value={protein} target={proteinTarget} kind="protein" />
      <MacroBar label="Carbs" value={carbs} target={carbsTarget} kind="carbs" />
      <MacroBar label="Fat" value={fat} target={fatTarget} kind="fat" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 5 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full },
});
