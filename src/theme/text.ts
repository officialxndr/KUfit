import { StyleSheet, TextStyle } from 'react-native';
import { colors } from './tokens';

/**
 * Semantic type scale ported from the design system (.fs-* classes).
 * Use as: <Text style={type.h1}>…</Text>. System font only (no webfonts) —
 * RN defaults to SF Pro on iOS, Roboto on Android.
 */
export const type = StyleSheet.create({
  display: {
    fontSize: 30,
    lineHeight: 33,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
  },
  stat: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  h1: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.text,
  },
  h2: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: colors.text,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: colors.text,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    color: colors.muted,
  },
  nav: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
  },
  overline: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.muted,
  },
} as Record<string, TextStyle>);
