import { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { X, Minus, Plus, Trash2 } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { SavedMealItem } from '@/types';

/** Edit a saved meal (A5): rename, adjust each item's servings, or remove items. */
export default function SavedMealEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [items, setItems] = useState<SavedMealItem[]>([]);
  const [missing, setMissing] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    const meal = foodRepo.getSavedMeal(id);
    if (!meal) { setMissing(true); return; }
    setName(meal.name);
    setItems(foodRepo.getSavedMealItems(id));
  }, [id]);
  useFocusEffect(reload);

  const total = items.reduce((s, it) => s + it.calories * it.servingQty, 0);

  const commitName = () => {
    const n = name.trim();
    if (id && n) foodRepo.renameSavedMeal(id, n);
  };

  const setQty = (itemId: string, qty: number) => {
    const q = Math.max(1, Math.round(qty * 100) / 100);
    foodRepo.updateSavedMealItem(itemId, q);
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, servingQty: q } : it)));
  };

  const removeItem = (it: SavedMealItem) => {
    foodRepo.removeSavedMealItem(it.id);
    const next = items.filter((x) => x.id !== it.id);
    setItems(next);
    if (next.length === 0 && id) {
      // An empty saved meal is useless — offer to delete the whole thing.
      Alert.alert('Empty meal', 'This saved meal has no items left. Delete it?', [
        { text: 'Keep', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { foodRepo.deleteSavedMeal(id); router.back(); } },
      ]);
    }
  };

  if (missing) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <FsText variant="h2">Saved meal</FsText>
          <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
        </View>
        <FsText variant="caption" style={{ paddingHorizontal: space[4] }}>This saved meal no longer exists.</FsText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Edit meal</FsText>
        <Pressable onPress={() => { commitName(); router.back(); }} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[8] }} keyboardShouldPersistTaps="handled">
        <FsText variant="caption" style={{ marginBottom: 6 }}>Name</FsText>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={commitName}
          placeholder="My usual breakfast"
          placeholderTextColor={colors.muted}
          style={styles.nameInput}
          returnKeyType="done"
          onSubmitEditing={commitName}
        />

        <View style={styles.totalRow}>
          <FsText variant="overline">{items.length} item{items.length === 1 ? '' : 's'}</FsText>
          <FsText variant="bodyMedium">{Math.round(total)} kcal</FsText>
        </View>

        {items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{it.name}</FsText>
              <FsText variant="caption">{Math.round(it.calories * it.servingQty)} kcal</FsText>
            </View>
            <View style={styles.stepper}>
              <Pressable hitSlop={6} onPress={() => setQty(it.id, it.servingQty - 1)} style={styles.stepBtn}>
                <Minus color={colors.text} size={16} />
              </Pressable>
              <FsText variant="bodyMedium" style={styles.qty}>{it.servingQty % 1 === 0 ? it.servingQty : it.servingQty.toFixed(2)}</FsText>
              <Pressable hitSlop={6} onPress={() => setQty(it.id, it.servingQty + 1)} style={styles.stepBtn}>
                <Plus color={colors.text} size={16} />
              </Pressable>
            </View>
            <Pressable hitSlop={8} onPress={() => removeItem(it)} style={{ padding: 4 }}>
              <Trash2 color={colors.danger} size={18} />
            </Pressable>
          </View>
        ))}

        <FsText variant="caption" style={{ marginTop: space[3] }}>
          Add items by logging them, then "Save as meal" again — or add this meal to a day and tweak the logs.
        </FsText>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Done" onPress={() => { commitName(); router.back(); }} />
      </View>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[3] },
  nameInput: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space[4], marginBottom: space[2] },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: colors.border },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceHigh, borderRadius: radius.full },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  footer: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[4] },
}));
