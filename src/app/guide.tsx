import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';

import { FsText, Card } from '@/components/ui';
import { TOUR_PAGES } from '@/lib/tourSteps';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

/**
 * Searchable feature reference. Reuses the guided-tour copy (TOUR_PAGES) — every feature
 * already has a short title + explanation there — grouped by app area, filterable as you type.
 * Opened from Settings → Help.
 */
export default function GuideScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const pages = useMemo(
    () =>
      TOUR_PAGES.map((p) => ({
        ...p,
        steps: query
          ? p.steps.filter((s) => `${s.title} ${s.body} ${p.label}`.toLowerCase().includes(query))
          : p.steps,
      })).filter((p) => p.steps.length > 0),
    [query]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <FsText variant="h2">Feature guide</FsText>
        <Pressable onPress={() => router.back()} hitSlop={10}><X color={colors.text} size={24} /></Pressable>
      </View>

      <View style={styles.searchField}>
        <Search color={colors.muted} size={18} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search features…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={8}><X color={colors.muted} size={16} /></Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {pages.length === 0 ? (
          <FsText variant="caption">No features match “{q}”.</FsText>
        ) : (
          pages.map((p) => (
            <View key={p.key} style={{ marginBottom: space[4] }}>
              <View style={styles.pageHead}>
                <p.icon color={colors.primary} size={16} />
                <FsText variant="overline" style={{ color: colors.primary }}>{p.label}</FsText>
              </View>
              <Card style={{ padding: 0 }}>
                {p.steps.map((s, i) => (
                  <View key={`${p.key}-${i}`} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.iconWrap}><s.icon color={colors.text} size={18} /></View>
                    <View style={{ flex: 1 }}>
                      <FsText variant="bodyMedium">{s.title}</FsText>
                      <FsText variant="caption" style={{ marginTop: 2 }}>{s.body}</FsText>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space[4], paddingVertical: space[3],
  },
  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md,
    paddingHorizontal: 14, marginHorizontal: space[4], marginBottom: space[2],
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 14 },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space[2], paddingHorizontal: space[1] },
  row: { flexDirection: 'row', gap: space[3], padding: space[3], alignItems: 'flex-start' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  iconWrap: { width: 28, alignItems: 'center', paddingTop: 1 },
}));
