import { useState } from 'react';
import { View, Pressable, Modal, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { StepperField } from '@/components/StepperField';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * Tappable time input that opens a small popup with hour/minute steppers.
 * JS-only (no native picker — consistent with `DateField`), so it works in
 * Expo Go. `hour` is 0–23, `minute` 0–59; the field displays 12-hour AM/PM.
 */
export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

export function TimeField({
  hour, minute, onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  const openPicker = () => { setH(hour); setM(minute); setOpen(true); };
  const done = () => { onChange(h, m); setOpen(false); };

  return (
    <>
      <Pressable onPress={openPicker} style={styles.field}>
        <Clock color={colors.muted} size={16} />
        <FsText variant="bodyMedium">{formatTime(hour, minute)}</FsText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <FsText variant="cardTitle" style={{ marginBottom: space[4] }}>Reminder time</FsText>
            <View style={styles.row}>
              <View style={styles.col}>
                <FsText variant="caption" style={{ marginBottom: 6 }}>Hour</FsText>
                <StepperField value={h} onCommit={setH} min={0} max={23} />
              </View>
              <View style={styles.col}>
                <FsText variant="caption" style={{ marginBottom: 6 }}>Minute</FsText>
                <StepperField value={m} onCommit={setM} step={5} min={0} max={59} />
              </View>
            </View>
            <FsText variant="caption" style={{ marginTop: space[3] }}>{formatTime(h, m)}</FsText>
            <Button title="Done" onPress={done} style={{ marginTop: space[4] }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[4] },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[6] },
  row: { flexDirection: 'row', gap: space[4] },
  col: { flex: 1 },
}));
