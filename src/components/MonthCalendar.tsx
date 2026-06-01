import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { FsText } from '@/components/ui';
import { colors, radius, space } from '@/theme/tokens';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Month grid. `marked` is a set of YYYY-MM-DD strings to dot; `selected` is the
 * active day. Tapping a day calls onSelectDay; arrows call onMonthChange(±1).
 */
export function MonthCalendar({
  month,
  marked,
  selected,
  onSelectDay,
  onMonthChange,
  allowAllDays = false,
}: {
  month: Date;
  marked: Set<string>;
  selected: string | null;
  onSelectDay: (isoDate: string) => void;
  onMonthChange: (delta: number) => void;
  allowAllDays?: boolean;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const todayIso = iso(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={() => onMonthChange(-1)} hitSlop={8} style={styles.arrow}>
          <ChevronLeft color={colors.muted} size={20} />
        </Pressable>
        <FsText variant="cardTitle">
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </FsText>
        <Pressable onPress={() => onMonthChange(1)} hitSlop={8} style={styles.arrow}>
          <ChevronRight color={colors.muted} size={20} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <FsText key={w} variant="overline" style={styles.weekCell}>{w}</FsText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d == null) return <View key={`b${i}`} style={styles.cell} />;
          const cellIso = iso(new Date(year, m, d));
          const isMarked = marked.has(cellIso);
          const isSelected = selected === cellIso;
          const isToday = cellIso === todayIso;
          return (
            <Pressable
              key={cellIso}
              style={styles.cell}
              onPress={() => onSelectDay(cellIso)}
              disabled={!allowAllDays && !isMarked}
            >
              <View style={[styles.day, isSelected && { backgroundColor: colors.primary }, !isSelected && isToday && styles.todayRing]}>
                <FsText
                  variant="bodyMedium"
                  style={{ color: isSelected ? colors.white : isMarked ? colors.text : colors.muted, opacity: allowAllDays || isMarked || isSelected ? 1 : 0.4 }}
                >
                  {d}
                </FsText>
              </View>
              {isMarked && !isSelected && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] },
  arrow: { padding: 4 },
  weekRow: { flexDirection: 'row', marginBottom: space[1] },
  weekCell: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  todayRing: { borderWidth: 1, borderColor: colors.border },
  dot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
});
