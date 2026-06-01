import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ViewStyle, TextStyle, ActivityIndicator, PressableProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space, tintBg, PAGE_PADDING } from '@/theme/tokens';
import { type } from '@/theme/text';

// ── Screen — page wrapper with safe area + scroll ─────────────────────────────

export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
}) {
  const inner = (
    <View style={[padded && { paddingHorizontal: PAGE_PADDING }, contentStyle]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: space[8] * 2 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  outlined = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  outlined?: boolean;
}) {
  return <View style={[styles.card, outlined && styles.cardOutlined, style]}>{children}</View>;
}

// ── Typography helpers ─────────────────────────────────────────────────────────

type TextVariant = keyof typeof type;
export function FsText({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[type[variant], style]}>
      {children}
    </Text>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

export function Badge({
  label,
  tone = 'primary',
}: {
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const fg = colors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: tintBg[tone] }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  ...rest
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'success' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
} & PressableProps) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'success' ? colors.success : 'transparent';
  const fg = variant === 'ghost' ? colors.primary : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        (disabled || loading) && { opacity: 0.6 },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.h2}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space[4],
  },
  cardOutlined: { borderWidth: 1, borderColor: colors.border },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chip: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 13, lineHeight: 18, color: colors.text, fontWeight: '500' },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
  },
});
