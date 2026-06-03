import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

import { FsText } from '@/components/ui';
import { cmToFeetInches, feetInchesToCm } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { UnitSystem } from '@/types';

/**
 * Height input that respects the unit system: a single **cm** field in metric, or
 * separate **feet + inches** fields in imperial. Always stores/returns metric cm
 * (the app's canonical unit) via `onChange`. Re-derives the visible fields when the
 * unit system flips so the same stored height shows correctly either way.
 */
export function HeightField({ valueCm, onChange, system }: {
  valueCm: number | null;
  onChange: (cm: number | null) => void;
  system: UnitSystem;
}) {
  const fi = valueCm != null ? cmToFeetInches(valueCm) : null;
  const [feet, setFeet] = useState(fi ? String(fi.feet) : '');
  const [inches, setInches] = useState(fi ? String(fi.inches) : '');
  const [cm, setCm] = useState(valueCm != null ? String(valueCm) : '');

  useEffect(() => {
    const f = valueCm != null ? cmToFeetInches(valueCm) : null;
    setFeet(f ? String(f.feet) : '');
    setInches(f ? String(f.inches) : '');
    setCm(valueCm != null ? String(valueCm) : '');
    // Resync only when the unit system changes — keep local edits otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [system]);

  const commitImperial = (fStr: string, iStr: string) => {
    if (fStr.trim() === '' && iStr.trim() === '') { onChange(null); return; }
    const f = Math.max(0, Math.floor(Number(fStr) || 0));
    const i = Math.max(0, Number(iStr) || 0);
    onChange(feetInchesToCm(f, i));
  };

  if (system === 'IMPERIAL') {
    return (
      <View style={styles.row}>
        <View style={styles.fieldWrap}>
          <TextInput
            value={feet}
            onChangeText={(t) => { setFeet(t); commitImperial(t, inches); }}
            placeholder="5"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
          <FsText variant="caption" style={styles.suffix}>ft</FsText>
        </View>
        <View style={styles.fieldWrap}>
          <TextInput
            value={inches}
            onChangeText={(t) => { setInches(t); commitImperial(feet, t); }}
            placeholder="10"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={styles.input}
          />
          <FsText variant="caption" style={styles.suffix}>in</FsText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fieldWrap}>
      <TextInput
        value={cm}
        onChangeText={(t) => { setCm(t); onChange(t.trim() === '' ? null : Number(t)); }}
        placeholder="178"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        style={styles.input}
      />
      <FsText variant="caption" style={styles.suffix}>cm</FsText>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2] },
  fieldWrap: { flex: 1, justifyContent: 'center' },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, paddingRight: 38, color: colors.text, fontSize: 16,
  },
  suffix: { position: 'absolute', right: 14, color: colors.muted },
}));
