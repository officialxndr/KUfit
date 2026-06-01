import { useEffect, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * A number control with −/+ buttons and a **tappable, editable value** so the
 * user can type directly instead of stepping. Commits on blur / submit; the
 * buttons commit immediately. `value` is the source of truth (controlled).
 */
export function StepperField({
  value,
  onCommit,
  step = 1,
  min = 0,
  max = 100000,
  unit,
}: {
  value: number;
  onCommit: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => setText(String(Math.round(value))), [value]);

  const clamp = (n: number) => Math.min(Math.max(n, min), max);
  const commit = () => {
    const n = Number(text);
    onCommit(text.trim() !== '' && Number.isFinite(n) ? clamp(n) : value);
  };
  const bump = (d: number) => onCommit(clamp(value + d));

  return (
    <View style={styles.row}>
      <Pressable style={styles.btn} onPress={() => bump(-step)} hitSlop={6}>
        <Minus color={colors.text} size={16} />
      </Pressable>
      <View style={styles.valueWrap}>
        <TextInput
          value={text}
          onChangeText={setText}
          onEndEditing={commit}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numeric"
          selectTextOnFocus
          returnKeyType="done"
          style={styles.input}
        />
        {unit ? <FsText variant="caption" style={{ marginLeft: 4 }}>{unit}</FsText> : null}
      </View>
      <Pressable style={styles.btn} onPress={() => bump(step)} hitSlop={6}>
        <Plus color={colors.text} size={16} />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  btn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    minWidth: 76,
    height: 32,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 28,
    paddingVertical: 0,
  },
}));
