import { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Dumbbell } from 'lucide-react-native';

import { Card, FsText, Button, Badge } from '@/components/ui';
import { PRESET_TEMPLATES, resolvePresetExercises, addPresetTemplate, type PresetTemplate } from '@/lib/presetTemplates';
import { haptic } from '@/lib/haptics';
import { colors, radius, space, tintBg, themedStyles } from '@/theme/tokens';

export default function PresetTemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // How many times each preset has been added this visit (drives the "Added ✓" state).
  const [added, setAdded] = useState<Record<string, number>>({});

  // Resolve each preset's exercises against the seeded catalog once.
  const resolved = useMemo(
    () => PRESET_TEMPLATES.map((p) => ({ preset: p, items: resolvePresetExercises(p) })),
    []
  );

  // Group by label (folder) so the list reads as Full Body / PPL / Upper-Lower / Home.
  const groups = useMemo(() => {
    const map = new Map<string, typeof resolved>();
    for (const r of resolved) {
      const k = r.preset.label;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()];
  }, [resolved]);

  const onAdd = (preset: PresetTemplate) => {
    const id = addPresetTemplate(preset);
    if (!id) return;
    haptic.success();
    setAdded((a) => ({ ...a, [preset.id]: (a[preset.id] ?? 0) + 1 }));
  };

  const totalAdded = Object.values(added).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <FsText variant="h2">Pre-set templates</FsText>
          <FsText variant="caption">Ready-made workouts — add one and tweak it however you like.</FsText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
        showsVerticalScrollIndicator={false}
      >
        {groups.map(([label, list]) => (
          <View key={label} style={{ marginBottom: space[2] }}>
            <FsText variant="overline" style={{ marginTop: space[3], marginBottom: space[2], color: colors.muted }}>
              {label}
            </FsText>
            {list.map(({ preset, items }) => {
              const count = added[preset.id] ?? 0;
              return (
                <Card key={preset.id} style={{ marginBottom: space[3] }}>
                  <View style={styles.cardHead}>
                    <View style={styles.iconWrap}>
                      <Dumbbell color={colors.primary} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FsText variant="cardTitle">{preset.name}</FsText>
                      <FsText variant="caption">{items.length} exercises</FsText>
                    </View>
                    {count > 0 && <Badge label={count > 1 ? `Added ×${count}` : 'Added'} tone="success" />}
                  </View>

                  <FsText variant="caption" style={{ marginTop: space[2], color: colors.muted }}>
                    {preset.description}
                  </FsText>

                  <View style={styles.exList}>
                    {items.map(({ exercise, preset: pe }, i) => (
                      <View key={exercise.id + i} style={styles.exRow}>
                        <FsText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                          {exercise.name}
                        </FsText>
                        <FsText variant="caption" style={{ color: colors.muted }}>
                          {pe.sets} × {pe.reps ?? '—'}
                        </FsText>
                      </View>
                    ))}
                  </View>

                  <Button
                    title={count > 0 ? '＋ Add again' : '＋ Add to my templates'}
                    variant={count > 0 ? 'ghost' : 'primary'}
                    onPress={() => onAdd(preset)}
                    style={{ marginTop: space[3] }}
                  />
                </Card>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom || space[3] }]}>
        <Button
          title={totalAdded > 0 ? `Done — ${totalAdded} added` : 'Done'}
          variant={totalAdded > 0 ? 'primary' : 'ghost'}
          onPress={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space[2],
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: tintBg.primary, alignItems: 'center', justifyContent: 'center',
  },
  exList: { marginTop: space[3], gap: 2 },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.border,
  },
  footer: {
    paddingHorizontal: space[4], paddingTop: space[3],
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
}));
