import { useEffect, useRef, useState } from 'react';
import {
  View, TextInput, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X, ScanLine, Search, Plus } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { searchFood, barcodeLookup, ensureFoodItem, type FoodCandidate } from '@/lib/foodSearch';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { colors, radius, space } from '@/theme/tokens';
import { type } from '@/theme/text';
import type { MealType } from '@/types';

export default function AddFoodModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();
  const meal = (params.meal ?? 'SNACK') as MealType;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [servings, setServings] = useState('1');
  const [permission, requestPermission] = useCameraPermissions();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults(foodRepo.getRecentFoodItems(10).map((fi) => ({
        ...fi, localId: fi.id, barcode: fi.barcode ?? null, brand: fi.brand ?? null,
        fiber: fi.fiber ?? null, sugar: fi.sugar ?? null, sodium: fi.sodium ?? null,
      })));
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      const r = await searchFood(q);
      setResults(r);
      setLoading(false);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera needed', 'Enable camera access to scan barcodes.');
        return;
      }
    }
    setScanning(true);
  };

  const onScanned = async (r: BarcodeScanningResult) => {
    setScanning(false);
    setLoading(true);
    const found = await barcodeLookup(r.data);
    setLoading(false);
    if (found) {
      setSelected(found);
      setServings('1');
    } else {
      Alert.alert('Not found', `No product found for barcode ${r.data}. Try searching by name.`);
    }
  };

  const logSelected = () => {
    if (!selected) return;
    const qty = Number(servings);
    if (!qty || qty <= 0) return;
    const foodItemLocalId = ensureFoodItem(selected);
    foodRepo.addLog({ date, meal, foodItemLocalId, servingQty: qty });
    router.back();
  };

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
          onBarcodeScanned={onScanned}
        />
        <SafeAreaView style={styles.scanOverlay} edges={['top']}>
          <Pressable onPress={() => setScanning(false)} style={styles.iconBtn} hitSlop={10}>
            <X color="#fff" size={26} />
          </Pressable>
          <FsText variant="bodyMedium" style={{ color: '#fff', textAlign: 'center' }}>
            Point at a barcode
          </FsText>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Add to {meal[0] + meal.slice(1).toLowerCase()}</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <X color={colors.text} size={24} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Search color={colors.muted} size={18} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search foods…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
            autoCorrect={false}
          />
        </View>
        <Pressable onPress={openScanner} style={styles.scanBtn}>
          <ScanLine color={colors.white} size={20} />
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: space[4] }} />}

      <FlatList
        data={results}
        keyExtractor={(item, i) => (item.localId ?? item.barcode ?? item.name) + i}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: 200 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ marginTop: space[4], gap: space[3] }}>
              <FsText variant="caption">
                {q.length < 2 ? 'Recent foods appear here. Search or scan to add.' : 'No matches.'}
              </FsText>
              <Button
                title="Create custom food"
                variant="ghost"
                onPress={() => router.push({ pathname: '/custom-food', params: { meal, date } })}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.resultRow}
            onPress={() => { setSelected(item); setServings('1'); }}
          >
            <View style={{ flex: 1 }}>
              <FsText variant="bodyMedium" numberOfLines={1}>{item.name}</FsText>
              <FsText variant="caption" numberOfLines={1}>
                {item.brand ? `${item.brand} · ` : ''}{Math.round(item.calories)} kcal / {item.servingSize}{item.servingUnit}
                {item.isCustom ? ' · custom' : ''}
              </FsText>
            </View>
            <Plus color={colors.primary} size={20} strokeWidth={2.4} />
          </Pressable>
        )}
      />

      {/* Quantity sheet */}
      {selected && (
        <View style={styles.sheet}>
          <FsText variant="cardTitle" numberOfLines={1}>{selected.name}</FsText>
          <FsText variant="caption" style={{ marginBottom: space[3] }}>
            {Math.round(selected.calories)} kcal per {selected.servingSize}{selected.servingUnit} serving
          </FsText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[3] }}>
            <FsText variant="body">Servings</FsText>
            <View style={styles.qtyField}>
              <TextInput
                value={servings}
                onChangeText={setServings}
                keyboardType="decimal-pad"
                style={[styles.input, { textAlign: 'center' }]}
                selectTextOnFocus
              />
            </View>
            <FsText variant="caption">
              = {Math.round(selected.calories * (Number(servings) || 0))} kcal
            </FsText>
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="ghost" onPress={() => setSelected(null)} />
            </View>
            <View style={{ flex: 2 }}>
              <Button title="Add to Log" onPress={logSelected} />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  searchRow: { flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], marginBottom: space[3] },
  searchField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14,
  },
  scanBtn: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.md,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: space[4], borderTopWidth: 1, borderColor: colors.border,
  },
  qtyField: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, width: 80, paddingHorizontal: 8,
  },
  scanOverlay: { padding: space[4], gap: space[4] },
  iconBtn: { alignSelf: 'flex-start' },
});
