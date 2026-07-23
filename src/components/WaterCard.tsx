import { View, Pressable, StyleSheet } from 'react-native';
import { Droplet, Plus, Undo2 } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { UNIT_LABELS, mlToDisplay, FL_OZ_ML } from '@/lib/units';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { UnitSystem } from '@/types';

/** Quick-add increments per unit system (a glass/cup and a bottle), stored in ml. */
function increments(system: UnitSystem): { label: string; ml: number }[] {
  return system === 'IMPERIAL'
    ? [{ label: 'Cup', ml: 8 * FL_OZ_ML }, { label: 'Bottle', ml: 16 * FL_OZ_ML }]
    : [{ label: 'Glass', ml: 250 }, { label: 'Bottle', ml: 500 }];
}

/**
 * Daily water tracker for the Food → Today screen (only rendered when `profile.trackWater`).
 * Progress bar + quick-add pills + undo. Presentational — the parent owns the data (reads
 * `waterRepo.getWaterTotal(date)` on focus) and passes handlers.
 */
export function WaterCard({
  totalMl,
  goalMl,
  unitSystem,
  onAdd,
  onUndo,
}: {
  totalMl: number;
  goalMl: number;
  unitSystem: UnitSystem;
  onAdd: (ml: number) => void;
  onUndo: () => void;
}) {
  const label = UNIT_LABELS[unitSystem].volume;
  const pct = goalMl > 0 ? Math.min(totalMl / goalMl, 1) : 0;
  const reached = goalMl > 0 && totalMl >= goalMl;
  return (
    <Card style={{ marginBottom: space[3] }}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Droplet color={colors.primary} size={16} />
          <FsText variant="bodyMedium">Water</FsText>
        </View>
        <FsText variant="caption" style={{ color: colors.text, fontVariant: ['tabular-nums'] }}>
          {mlToDisplay(totalMl, unitSystem)} / {mlToDisplay(goalMl, unitSystem)} {label}
          {reached ? ' · goal reached' : ''}
        </FsText>
      </View>
      <View style={styles.track}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: reached ? colors.success : colors.primary }} />
      </View>
      <View style={styles.btnRow}>
        {increments(unitSystem).map((inc) => (
          <Pressable key={inc.label} style={styles.pill} onPress={() => onAdd(inc.ml)}>
            <Plus color={colors.primary} size={14} strokeWidth={2.6} />
            <FsText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
              {inc.label} · {mlToDisplay(inc.ml, unitSystem)} {label}
            </FsText>
          </Pressable>
        ))}
        <Pressable
          style={[styles.undo, totalMl <= 0 && { opacity: 0.4 }]}
          onPress={onUndo}
          disabled={totalMl <= 0}
          hitSlop={6}
        >
          <Undo2 color={colors.muted} size={16} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[3] },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.30)',
  },
  undo: {
    marginLeft: 'auto', width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
}));
