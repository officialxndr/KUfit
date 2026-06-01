import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { FsText, Badge } from '@/components/ui';
import {
  formatNutriment, foodBadges, NUTRIENT_GROUP_ORDER, type NutrientGroup,
} from '@/lib/offNutrients';
import { colors, radius, space } from '@/theme/tokens';
import type { FoodDetails } from '@/types';

const COMPACT_COUNT = 6;

// Nutri-Score / Eco-Score letter → colour (a green … e red).
const GRADE_COLOR: Record<string, string> = {
  a: '#138f3e', b: '#85bb2f', c: '#f5c000', d: '#ee8100', e: '#e63e11',
};
// NOVA processing group → colour (1 unprocessed … 4 ultra-processed).
const NOVA_COLOR = ['#138f3e', '#85bb2f', '#ee8100', '#e63e11'];
const LEVEL_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  low: 'success', moderate: 'warning', high: 'danger',
};

/** Compact badges + score chips shown directly under the food name. */
export function FoodBadgeRow({ details }: { details?: FoodDetails | null }) {
  if (!details) return null;
  const badges = foodBadges(details);
  const hasScores = details.nutriScore || details.novaGroup || details.ecoScore;
  if (!badges.length && !hasScores) return null;

  return (
    <View style={styles.badgeRow}>
      {details.nutriScore && (
        <ScorePill label={`Nutri ${details.nutriScore.toUpperCase()}`} color={GRADE_COLOR[details.nutriScore]} />
      )}
      {details.novaGroup != null && (
        <ScorePill label={`NOVA ${details.novaGroup}`} color={NOVA_COLOR[details.novaGroup - 1] ?? colors.muted} />
      )}
      {details.ecoScore && (
        <ScorePill label={`Eco ${details.ecoScore.toUpperCase()}`} color={GRADE_COLOR[details.ecoScore]} />
      )}
      {badges.map((b, i) => <Badge key={i} label={b.label} tone={b.tone} />)}
    </View>
  );
}

/** The non-macro core nutrients (per serving) that live in dedicated columns. */
export interface CoreExtras {
  fiber?: number | null;
  sugar?: number | null;
  saturatedFat?: number | null;
  sodium?: number | null;
}

const fmt = (n: number) => (n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100);

/**
 * "Nutrients per amount" list (core extras + extended micros) + ingredients /
 * additives. Core extras (fiber/sugar/sat-fat/sodium) always head the list; the
 * extended micros are compact (6) with a "Show all" expansion. Scales with `qty`.
 */
export function FoodDetailSections({ core, details, qty }: { core?: CoreExtras; details?: FoodDetails | null; qty: number }) {
  const [showAll, setShowAll] = useState(false);

  const coreRows: { label: string; text: string }[] = [];
  if (core?.fiber != null) coreRows.push({ label: 'Fiber', text: `${fmt(core.fiber * qty)} g` });
  if (core?.sugar != null) coreRows.push({ label: 'Sugar', text: `${fmt(core.sugar * qty)} g` });
  if (core?.saturatedFat != null) coreRows.push({ label: 'Saturated fat', text: `${fmt(core.saturatedFat * qty)} g` });
  if (core?.sodium != null) coreRows.push({ label: 'Sodium', text: `${fmt(core.sodium * qty)} mg` });

  const rows = (details?.nutriments ?? [])
    .map((e) => formatNutriment(e, qty))
    .filter((r): r is NonNullable<typeof r> => r != null);
  const levels = details?.nutrientLevels ?? null;
  const additives = (details?.additives ?? []).map((t) => t.replace(/^[a-z]{2}:/, '').toUpperCase());
  const ingredients = details?.ingredientsText ?? null;

  const hasNutrients = coreRows.length > 0 || rows.length > 0;
  if (!hasNutrients && !levels && !ingredients && additives.length === 0) return null;

  const visibleMicros = showAll ? rows : rows.slice(0, COMPACT_COUNT);

  return (
    <View style={{ gap: space[3] }}>
      {levels && (
        <View style={styles.levelRow}>
          {Object.entries(levels).map(([k, v]) => (
            <Badge key={k} label={`${prettyLevelKey(k)} ${v}`} tone={LEVEL_TONE[v] ?? 'warning'} />
          ))}
        </View>
      )}

      {hasNutrients && (
        <View>
          <FsText variant="overline" style={{ marginBottom: space[2] }}>Nutrients per amount</FsText>
          {coreRows.map((r, i) => <NutrientRow key={'core' + i} label={r.label} text={r.text} />)}
          {showAll ? (
            // Extended micros, grouped.
            NUTRIENT_GROUP_ORDER.map((group) => {
              const groupRows = rows.filter((r) => r.group === group);
              if (!groupRows.length) return null;
              return (
                <View key={group} style={{ marginBottom: space[2] }}>
                  <FsText variant="caption" style={styles.groupHead}>{group}</FsText>
                  {groupRows.map((r, i) => <NutrientRow key={group + i} label={r.label} text={r.text} />)}
                </View>
              );
            })
          ) : (
            visibleMicros.map((r, i) => <NutrientRow key={i} label={r.label} text={r.text} />)
          )}
          {rows.length > COMPACT_COUNT && (
            <Pressable style={styles.expandBtn} onPress={() => setShowAll((s) => !s)} hitSlop={6}>
              <FsText variant="bodyMedium" style={{ color: colors.primary }}>
                {showAll ? 'Show less' : `Show all ${rows.length} nutrients`}
              </FsText>
              <View style={{ transform: [{ rotate: showAll ? '180deg' : '0deg' }] }}>
                <ChevronDown color={colors.primary} size={16} />
              </View>
            </Pressable>
          )}
        </View>
      )}

      {ingredients && (
        <View>
          <FsText variant="overline" style={{ marginBottom: space[1] }}>Ingredients</FsText>
          <FsText variant="caption" style={{ lineHeight: 18 }}>{ingredients}</FsText>
        </View>
      )}

      {additives.length > 0 && (
        <View>
          <FsText variant="overline" style={{ marginBottom: space[1] }}>Additives</FsText>
          <FsText variant="caption">{additives.join(' · ')}</FsText>
        </View>
      )}
    </View>
  );
}

function NutrientRow({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.nutrientRow}>
      <FsText variant="caption" style={{ color: colors.text }}>{label}</FsText>
      <FsText variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{text}</FsText>
    </View>
  );
}

function ScorePill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.scorePill, { backgroundColor: color }]}>
      <FsText variant="caption" style={{ color: colors.white, fontWeight: '700' }}>{label}</FsText>
    </View>
  );
}

const prettyLevelKey = (k: string) =>
  k === 'saturated-fat' ? 'Sat fat' : k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' ');

const styles = StyleSheet.create({
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  scorePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  groupHead: { color: colors.muted, marginBottom: 4, marginTop: 2 },
  nutrientRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: space[2], marginTop: 2 },
});
