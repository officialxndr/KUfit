import { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, ScanText, Circle, Scale as ScaleIcon } from 'lucide-react-native';

import { FsText, Card, Button, SectionHeader } from '@/components/ui';
import { ScaleWeighBar } from '@/components/ScaleWeighBar';
import { useScale } from '@/lib/scales/useScale';
import { foodRepo } from '@/lib/repositories/FoodRepo';
import { type ParsedNutrition } from '@/lib/nutritionOcr';
import { scanLabel } from '@/lib/nutritionVision';
import { isVisionConfigured, resolveAiConfig } from '@/lib/llm/visionProviders';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radius, space, themedStyles } from '@/theme/tokens';
import type { MealType } from '@/types';

export default function CustomFood() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: MealType; date?: string }>();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [servingText, setServingText] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [sodium, setSodium] = useState('');

  // Weigh the serving size on a Bluetooth scale (live grams fill the serving-size field).
  const [weighing, setWeighing] = useState(false);
  const [sim, setSim] = useState(false);
  const scale = useScale({ simulate: sim });
  useEffect(() => {
    if (!weighing) return;
    scale.start();
    return () => scale.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighing, sim]);
  useEffect(() => {
    if (weighing && scale.reading) { setServingUnit('g'); setServingSize(String(scale.reading.grams)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighing, scale.reading]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [reading, setReading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // AI vision scanning: a configured backend (on-device model, or a remote endpoint) reads
  // the photo directly; otherwise scanLabel falls back to on-device OCR.
  const profile = useSettingsStore((s) => s.profile);
  const aiCfg = resolveAiConfig(profile);
  const visionReady = profile.aiProvider !== 'off' && isVisionConfigured(aiCfg);
  const isRemoteAi = profile.aiProvider === 'remote';
  // After a scan: which engine actually read the label (AI vs OCR) + any AI failure reason.
  const [scanNote, setScanNote] = useState<{ ok: boolean; text: string } | null>(null);
  // Processing overlay — the LLM runs after the camera closes, so show a blocking
  // indicator with an elapsed counter (on-device inference can take 15–40s).
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!processing) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [processing]);

  // Empty optional fields stay null (unknown) rather than collapsing to 0.
  const optional = (v: string) => (v.trim() === '' ? null : Number(v) || 0);

  /** Fill the form from a scanned label — only fields the OCR actually found. */
  const applyParsed = (p: ParsedNutrition) => {
    const set = (v: number | undefined, fn: (s: string) => void) => { if (v != null) fn(String(v)); };
    set(p.servingSize, setServingSize);
    if (p.servingUnit) setServingUnit(p.servingUnit);
    if (p.servingText) setServingText(p.servingText);
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
      setProcessing(true);
      const res = await scanLabel(shot.uri, aiCfg);
      const found = applyParsed(res.parsed);
      if (res.usedAi) {
        setScanNote({ ok: true, text: isRemoteAi ? '✓ Read by your AI endpoint.' : '✓ Read by on-device AI — the photo stayed on your phone.' });
      } else if (visionReady && res.aiError) {
        // We expected AI (model downloaded + enabled) but it fell back — show why,
        // and surface the full reason in an alert so it's easy to read/screenshot.
        setScanNote({ ok: false, text: `AI scan unavailable — used the basic scanner instead.\n${res.aiError}` });
        Alert.alert('AI scan failed', `Used the basic scanner instead.\n\nReason:\n${res.aiError}`);
      } else {
        setScanNote(null);
      }
      if (!found) {
        Alert.alert('Nothing found', "Couldn't read nutrition info from that photo. Fill the fields in manually, or try again with the label flat and well lit.");
      }
    } catch {
      setScanning(false);
      Alert.alert('Scan failed', 'Label scanning needs a dev build with the camera + text-recognition module. Enter values manually for now.');
    } finally {
      setReading(false);
      setProcessing(false);
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
      servingText: servingText.trim() || null,
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
            {reading
              ? (visionReady ? 'Reading the label with AI — this can take a few seconds…' : 'Reading the label…')
              : 'Fill the frame with the Nutrition Facts panel, hold steady, then tap to capture.'}
          </FsText>
          <Pressable onPress={captureLabel} disabled={reading} style={styles.shutter} hitSlop={10}>
            {reading ? <ActivityIndicator color="#000" /> : <Circle color="#000" size={34} fill="#000" />}
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={[]}>
      <View style={styles.header}>
        <FsText variant="h2">Custom Food</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 120 }}>
        <Pressable onPress={openScanner} style={styles.scanLabelBtn}>
          <ScanText color={colors.primary} size={20} />
          <View style={{ flex: 1 }}>
            <FsText variant="bodyMedium" style={{ color: colors.primary }}>Scan nutrition label</FsText>
            <FsText variant="caption">
              {visionReady
                ? (isRemoteAi ? 'Read by your AI endpoint — the photo is sent to it.' : 'Read by on-device AI — the photo never leaves your phone.')
                : 'Auto-fill the nutrition fields from a photo.'}
            </FsText>
          </View>
        </Pressable>

        {scanNote && (
          <FsText
            variant="caption"
            style={{ color: scanNote.ok ? colors.success : colors.warning, marginTop: -space[2], marginBottom: space[3] }}
          >
            {scanNote.text}
          </FsText>
        )}

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
          <Field label="Serving description (optional)" value={servingText} onChangeText={setServingText} placeholder={'e.g. "2 cookies"'} />
          <Pressable style={styles.weighToggle} onPress={() => setWeighing((w) => !w)}>
            <ScaleIcon color={colors.primary} size={16} />
            <FsText variant="caption" style={{ color: colors.primary }}>{weighing ? 'Hide scale' : 'Weigh on scale'}</FsText>
          </Pressable>
          {weighing && (
            <View style={{ marginTop: space[2] }}>
              <ScaleWeighBar scale={scale} onSimulate={() => setSim(true)} onClose={() => { setWeighing(false); setSim(false); }} />
            </View>
          )}
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

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <FsText variant="h2" style={{ color: '#fff', marginTop: space[3] }}>Reading label…</FsText>
          <FsText variant="bodyMedium" style={{ color: '#fff', textAlign: 'center', marginTop: space[2] }}>
            {visionReady
              ? (isRemoteAi ? 'Your AI endpoint is reading the label…' : 'On-device AI is reading the label — nothing leaves your phone.')
              : 'Scanning the label…'}
          </FsText>
          {visionReady && (
            <FsText variant="caption" style={{ color: colors.muted, marginTop: space[2] }}>{elapsed}s</FsText>
          )}
        </View>
      )}
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
  weighToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: space[2] },
  scanOverlay: { flex: 1, padding: space[4], alignItems: 'center' },
  processingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center', justifyContent: 'center', padding: space[6],
  },
  shutter: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
  },
}));
