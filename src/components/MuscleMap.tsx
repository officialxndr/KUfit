import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import { FsText } from '@/components/ui';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * Anatomical muscle heatmap (react-native-body-highlighter). Each muscle group's
 * weekly set count vs `target` (default 12) picks a green intensity — more sets →
 * deeper green. `counts` is keyed by lowercased Exercise.muscleGroup (body part).
 */

// Our catalog body-part groups → the library's muscle slugs.
const GROUP_TO_SLUGS: Record<string, Slug[]> = {
  chest: ['chest'],
  shoulders: ['deltoids'],
  'upper arms': ['biceps', 'triceps'],
  'lower arms': ['forearm'],
  waist: ['abs', 'obliques'],
  'upper legs': ['quadriceps', 'hamstring', 'gluteal', 'adductors'],
  'lower legs': ['calves'],
  neck: ['neck'],
  back: ['upper-back', 'lower-back', 'trapezius'],
};

/**
 * Opacity of the green fill for a muscle, as a non-linear function of progress
 * toward the weekly set target. Eased so a single set reads faint and color only
 * approaches full as you near the goal (not "done" after one set).
 */
function fillFor(sets: number, target: number): string | null {
  if (sets <= 0) return null;
  const ratio = Math.min(sets / target, 1);
  const eased = Math.pow(ratio, 1.6); // slow start, ramps toward the goal
  const alpha = 0.1 + 0.9 * eased; // keep a faint floor so 1 set is barely visible
  return `rgba(34,197,94,${alpha.toFixed(3)})`;
}

export function MuscleMap({ counts, target = 12 }: { counts: Record<string, number>; target?: number }) {
  const [side, setSide] = useState<'front' | 'back'>('front');

  const data: ExtendedBodyPart[] = [];
  for (const [group, slugs] of Object.entries(GROUP_TO_SLUGS)) {
    const color = fillFor(counts[group] ?? 0, target);
    if (!color) continue;
    for (const slug of slugs) data.push({ slug, color });
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.toggle}>
        {(['front', 'back'] as const).map((s) => {
          const on = side === s;
          return (
            <Pressable key={s} style={[styles.toggleBtn, on && styles.toggleOn]} onPress={() => setSide(s)}>
              <FsText variant="caption" style={{ color: on ? colors.white : colors.muted, fontWeight: '600' }}>
                {s === 'front' ? 'Front' : 'Back'}
              </FsText>
            </Pressable>
          );
        })}
      </View>

      <Body
        data={data}
        side={side}
        gender="male"
        scale={1.15}
        border={colors.border}
        defaultFill={colors.surfaceHigh}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: space[3],
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 20, borderRadius: radius.sm },
  toggleOn: { backgroundColor: colors.primary },
}));
