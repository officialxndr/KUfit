import { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';

import { FsText, Card } from '@/components/ui';
import { GUIDE, type GuideEntry } from '@/lib/guideContent';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const haystack = (e: GuideEntry, label: string) =>
  `${e.title} ${e.body} ${e.keywords ?? ''} ${(e.tips ?? []).join(' ')} ${label}`.toLowerCase();

/**
 * Searchable feature reference (Settings → Help → Feature guide). Detailed, hand-written
 * docs from `guideContent.ts`, grouped by app area and filtered live as you type.
 */
export default function GuideScreen() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const sections = useMemo(
    () =>
      GUIDE.map((s) => ({
        ...s,
        entries: query ? s.entries.filter((e) => haystack(e, s.label).includes(query)) : s.entries,
      })).filter((s) => s.entries.length > 0),
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
        {q ? <Pressable onPress={() => setQ('')} hitSlop={8}><X color={colors.muted} size={16} /></Pressable> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {sections.length === 0 ? (
          <FsText variant="caption">No features match “{q}”.</FsText>
        ) : (
          sections.map((s) => (
            <View key={s.key} style={{ marginBottom: space[4] }}>
              <View style={styles.sectionHead}>
                <s.icon color={colors.primary} size={16} />
                <FsText variant="overline" style={{ color: colors.primary }}>{s.label}</FsText>
              </View>
              {!query && <FsText variant="caption" style={styles.intro}>{s.intro}</FsText>}
              <Card style={{ padding: 0 }}>
                {s.entries.map((e, i) => (
                  <View key={`${s.key}-${i}`} style={[styles.entry, i > 0 && styles.divider]}>
                    <FsText variant="bodyMedium" style={{ marginBottom: 3 }}>{e.title}</FsText>
                    <FsText variant="body" style={{ color: colors.muted }}>{e.body}</FsText>
                    {e.tips?.map((t, j) => (
                      <View key={j} style={styles.tipRow}>
                        <FsText variant="caption" style={{ color: colors.primary }}>•</FsText>
                        <FsText variant="caption" style={{ flex: 1, color: colors.muted }}>{t}</FsText>
                      </View>
                    ))}
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space[1], paddingHorizontal: space[1] },
  intro: { color: colors.muted, marginBottom: space[2], paddingHorizontal: space[1] },
  entry: { padding: space[3] },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  tipRow: { flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'flex-start' },
}));
