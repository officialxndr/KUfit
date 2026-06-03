import { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, ScanText, Circle } from 'lucide-react-native';

import { FsText, Card, Button, SectionHeader } from '@/components/ui';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { recognizeNutritionLabel, type ParsedNutrition } from '@/lib/nutritionOcr';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { MealType } from '@/types';

export default function CustomFood() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sodium, setSodium] = useState('');

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [reading, setReading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Empty optional fields stay null (unknown) rather than collapsing to 0.
  const optional = (v: string) => (v.trim() === '' ? null : Number(v) || 0);

  /** Fill the form from a scanned label — only fields the OCR actually found. */
  const applyParsed = (p: ParsedNutrition) => {
    const set = (v: number | undefined, fn: (s: string) => void) => { if (v != null) fn(String(v)); };
    set(p.servingSize, setServingSize);
    if (p.servingUnit) setServingUnit(p.servingUnit);
    set(p.calories, setCalories);
    set(p.protein, setProtein);
    set(p.carbs, setCarbs);
    set(p.fat, setFat);
    set(p.fiber, setFiber);
    set(p.sugar, setSugar);
    set(p.saturatedFat, setSaturatedFat);
    set(p.sodium, setSodium);
    return Object.keys(p).length;
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert('Camera needed', 'Enable camera access to scan a label.'); return; }
    }
    setScanning(true);
  };

  const captureLabel = async () => {
    if (reading) return;
    setReading(true);
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 1, skipProcessing: true });
      setScanning(false);
      if (!shot?.uri) { Alert.alert('Scan failed', 'Could not capture the photo. Try again.'); return; }
      const parsed = await recognizeNutritionLabel(shot.uri);
      const found = applyParsed(parsed);
      if (!found) {
        Alert.alert('Nothing found', "Couldn't read nutrition info from that photo. Fill the fields in manually, or try again with the label flat and well lit.");
      }
    } catch {
      setScanning(false);
      Alert.alert('Scan failed', 'Label scanning needs a dev build with the camera + text-recognition module. Enter values manually for now.');
    } finally {
      setReading(false);
    }
  };

  const create = (thenLog: boolean) => {
    if (!name.trim() || !calories) {
      Alert.alert('Missing info', 'A name and calories are required.');
      return;
    }
    const localId = foodRepo.createCustomFoodItem({
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: null,
      servingSize: Number(servingSize) || 100,
      servingUnit: servingUnit || 'g',
      calories: Number(calories),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: optional(fiber),
      sugar: optional(sugar),
      sodium: optional(sodium),
      saturatedFat: optional(saturatedFat),
      source: 'MANUAL',
      isCustom: true,
    });
    if (thenLog && params.meal) {
      foodRepo.addLog({
        date: params.date ?? new Date().toISOString().slice(0, 10),
        meal: params.meal,
        foodItemLocalId: localId,
        servingQty: 1,
      });
    }
    router.back();
  };

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <SafeAreaView style={styles.scanOverlay} edges={['top', 'bottom']}>
          <Pressable onPress={() => setScanning(false)} style={{ alignSelf: 'flex-start' }} hitSlop={10}>
            <X color="#fff" size={26} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <FsText variant="bodyMedium" style={{ color: '#fff', textAlign: 'center', marginBottom: space[4] }}>
            Fill the frame with the Nutrition Facts panel, hold steady, then tap to capture.
          </FsText>
          <Pressable onPress={captureLabel} disabled={reading} style={styles.shutter} hitSlop={10}>
            {reading ? <ActivityIndicator color="#000" /> : <Circle color="#000" size={34} fill="#000" />}
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Custom Food</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        <Pressable onPress={openScanner} style={styles.scanLabelBtn}>
          <ScanText color={colors.primary} size={20} />
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium" style={{ color: colors.primary }}>Scan nutrition label</FsText>
            <FsText variant="caption">Auto-fill the nutrition fields from a photo (on-device).</FsText>
          </View>
        </Pressable>

        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="Details" />
          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mom's Granola" />
          <Field label="Brand (optional)" value={brand} onChangeText={setBrand} />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 2 }}>
              <Field label="Serving size" value={servingSize} onChangeText={setServingSize} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Unit" value={servingUnit} onChangeText={setServingUnit} />
            </View>
          </View>
        </Card>

        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="Nutrition (per serving)" />
          <Field label="Calories" value={calories} onChangeText={setCalories} keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Field label="Protein (g)" value={protein} onChangeText={setProtein} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Fat (g)" value={fat} onChangeText={setFat} keyboardType="decimal-pad" /></View>
          </View>
        </Card>

        <Card style={{ marginBottom: space[3] }}>
          <SectionHeader title="More nutrients (optional)" />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Field label="Fiber (g)" value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Sugar (g)" value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Field label="Sat. fat (g)" value={saturatedFat} onChangeText={setSaturatedFat} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Sodium (mg)" value={sodium} onChangeText={setSodium} keyboardType="decimal-pad" /></View>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <View style={{ flex: 1 }}><Button title="Save" variant="ghost" onPress={() => create(false)} /></View>
          {params.meal ? (
            <View style={{ flex: 2 }}><Button title="Save & Log" onPress={() => create(true)} /></View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default',
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={{ marginBottom: space[3] }}>
      <FsText variant="caption" style={{ marginBottom: 4 }}>{label}</FsText>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  input: {
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
  },
  scanLabelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: space[3],
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary,
    padding: space[3], marginBottom: space[3],
  },
  scanOverlay: { flex: 1, padding: space[4], alignItems: 'center' },
  shutter: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
  },
}));
