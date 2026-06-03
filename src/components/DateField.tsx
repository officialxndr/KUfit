import { useState } from 'react';
import { View, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react-native';

import { FsText, Button } from '@/components/ui';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const parse = (iso: string) => new Date(iso + 'T00:00:00');
const fmt = (iso: string) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Tappable date input. Two layouts via `mode`:
 *  - `calendar` (default): a month grid with arrows + a tap-the-title year jump —
 *    best for near-term dates like goal targets.
 *  - `cascade`: a guided year → month → day flow — best for birth dates decades back.
 * JS-only (no native picker); works in Expo Go. `value`/`onChange` use YYYY-MM-DD (null = unset).
 */
export function DateField({
  value, onChange, placeholder = 'Select date', minYear, maxYear, clearable = false, mode = 'calendar',
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  clearable?: boolean;
  mode?: 'calendar' | 'cascade';
}) {
  const now = new Date();
  const cascade = mode === 'cascade';
  const [open, setOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [cstep, setCstep] = useState<'year' | 'month' | 'day'>('year');
  const [viewMonth, setViewMonth] = useState(() => (value ? parse(value) : now));

  const lo = minYear ?? now.getFullYear() - 100;
  const hi = maxYear ?? now.getFullYear() + 10;
  const years: number[] = [];
  for (let yr = hi; yr >= lo; yr--) years.push(yr);

  const openModal = () => { setViewMonth(value ? parse(value) : now); setYearOpen(false); setCstep('year'); setOpen(true); };
  const pick = (iso: string) => { onChange(iso); setOpen(false); };

  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayIso = now.toISOString().slice(0, 10);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const yearList = (
    <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingVertical: space[1] }}>
      {years.map((yr) => (
        <Pressable
          key={yr}
          style={styles.yearRow}
          onPress={() => { setViewMonth(new Date(yr, m, 1)); if (cascade) setCstep('month'); else setYearOpen(false); }}
        >
          <FsText variant="bodyMedium" style={{ textAlign: 'center', color: yr === y ? colors.primary : colors.text, fontWeight: yr === y ? '700' : '400' }}>
            {yr}
          </FsText>
        </Pressable>
      ))}
    </ScrollView>
  );

  const monthGrid = (
    <View style={styles.monthGrid}>
      {MONTHS.map((mo, i) => {
        const sel = i === m;
        return (
          <Pressable key={mo} style={styles.monthCell} onPress={() => { setViewMonth(new Date(y, i, 1)); setCstep('day'); }}>
            <View style={[styles.monthPill, sel && { backgroundColor: colors.primary }]}>
              <FsText variant="bodyMedium" style={{ color: sel ? colors.white : colors.text }}>{mo}</FsText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const dayGrid = (
    <>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => <FsText key={w} variant="overline" style={styles.weekCell}>{w}</FsText>)}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d == null) return <View key={`b${i}`} style={styles.cell} />;
          const ci = isoOf(y, m, d);
          const sel = ci === value;
          const isToday = ci === todayIso;
          return (
            <Pressable key={ci} style={styles.cell} onPress={() => pick(ci)}>
              <View style={[styles.day, sel && { backgroundColor: colors.primary }, !sel && isToday && styles.todayRing]}>
                <FsText variant="bodyMedium" style={{ color: sel ? colors.white : colors.text }}>{d}</FsText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  // Cascade header: a back chevron that steps year ← month ← day, plus a context title.
  const cascadeHeader = (
    <View style={styles.header}>
      {cstep !== 'year' ? (
        <Pressable onPress={() => setCstep(cstep === 'day' ? 'month' : 'year')} hitSlop={8} style={styles.arrow}>
          <ChevronLeft color={colors.muted} size={20} />
        </Pressable>
      ) : <View style={styles.arrow} />}
      <FsText variant="cardTitle">
        {cstep === 'year' ? 'Select year' : cstep === 'month' ? String(y) : viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </FsText>
      <View style={styles.arrow} />
    </View>
  );

  const calendarHeader = (
    <View style={styles.header}>
      <Pressable onPress={() => setViewMonth(addMonths(viewMonth, -1))} hitSlop={8} style={styles.arrow}>
        <ChevronLeft color={colors.muted} size={20} />
      </Pressable>
      <Pressable onPress={() => setYearOpen((o) => !o)} style={styles.titleBtn} hitSlop={6}>
        <FsText variant="cardTitle">{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</FsText>
        <ChevronDown color={colors.muted} size={16} />
      </Pressable>
      <Pressable onPress={() => setViewMonth(addMonths(viewMonth, 1))} hitSlop={8} style={styles.arrow}>
        <ChevronRight color={colors.muted} size={20} />
      </Pressable>
    </View>
  );

  return (
    <>
      <Pressable style={styles.field} onPress={openModal}>
        <FsText variant="bodyMedium" style={{ flex: 1, color: value ? colors.text : colors.muted }}>
          {value ? fmt(value) : placeholder}
        </FsText>
        <CalendarIcon color={colors.muted} size={18} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {cascade ? cascadeHeader : calendarHeader}

            {cascade
              ? (cstep === 'year' ? yearList : cstep === 'month' ? monthGrid : dayGrid)
              : (yearOpen ? yearList : dayGrid)}

            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3] }}>
              {clearable && value && (
                <View style={{ flex: 1 }}>
                  <Button title="Clear" variant="ghost" onPress={() => { onChange(null); setOpen(false); }} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Button title="Done" variant="ghost" onPress={() => setOpen(false)} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: space[2],
    backgroundColor: colors.surfaceHigh, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[6] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  arrow: { padding: 4, minWidth: 28 },
  titleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekRow: { flexDirection: 'row', marginBottom: space[1] },
  weekCell: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 1, borderColor: colors.border },
  yearRow: { paddingVertical: 10 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: space[1] },
  monthCell: { width: `${100 / 3}%`, paddingVertical: space[2], alignItems: 'center' },
  monthPill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, minWidth: 72, alignItems: 'center' },
}));
