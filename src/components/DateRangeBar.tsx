import { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarRange, CalendarClock } from 'lucide-react-native';

import { Chip, FsText } from '@/components/ui';
import { MonthCalendar } from '@/components/MonthCalendar';
import { PERIODS, type DateRange } from '@/lib/useDateRange';
import { colors, radius, space, themedStyles } from '@/theme/tokens';

type CalMode = 'jump' | 'start' | 'end';
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

/**
 * Shared date-window controls: a full-width segmented preset selector
 * (Week/Month/3 Mo/Year) + a navigator toolbar (‹ › paging, tappable range →
 * calendar jump, custom start→end range picker, Today). Driven by a `useDateRange`
 * value — the consuming screen just reads `range.fromIso`/`endIso`/`days`.
 */
export function DateRangeBar({ range }: { range: DateRange }) {
  const [calOpen, setCalOpen] = useState(false);
  const [calMode, setCalMode] = useState<CalMode>('jump');
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const openJump = () => { setCalMode('jump'); setCalMonth(parse(range.endIso)); setCalOpen(true); };
  const openCustom = () => { setPendingStart(null); setCalMode('start'); setCalMonth(parse(range.endIso)); setCalOpen(true); };
  const onCalSelect = (picked: string) => {
    if (calMode === 'jump') { range.jumpEnd(picked); setCalOpen(false); }
    else if (calMode === 'start') { setPendingStart(picked); setCalMode('end'); }
    else { range.setCustom(pendingStart ?? picked, picked); setCalOpen(false); }
  };
  const calTitle = calMode === 'start' ? 'Select start date' : calMode === 'end' ? 'Select end date' : 'Jump to date';

  return (
    <>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Chip key={p.key} label={p.label} selected={range.periodKey === p.key} onPress={() => range.selectPeriod(p.key)} style={styles.segChip} />
        ))}
      </View>

      <View style={styles.navRow}>
        <Pressable onPress={range.goBack} hitSlop={8} style={styles.navArrow}><ChevronLeft color={colors.muted} size={20} /></Pressable>
        <Pressable onPress={openJump} hitSlop={6} style={styles.rangeBtn}>
          <FsText variant="bodyMedium" numberOfLines={1}>{range.rangeLabel}</FsText>
          <FsText variant="caption" style={{ color: range.periodKey === 'custom' ? colors.primary : colors.muted }}>
            {range.periodKey === 'custom' ? `custom · ${range.days} days` : `${range.days} days`}
          </FsText>
        </Pressable>
        <Pressable onPress={range.goFwd} hitSlop={8} disabled={range.isCurrent} style={[styles.navArrow, range.isCurrent && { opacity: 0.3 }]}><ChevronRight color={colors.muted} size={20} /></Pressable>
        <Pressable onPress={openCustom} hitSlop={6} style={[styles.navArrow, range.periodKey === 'custom' && styles.navArrowOn]} accessibilityLabel="Custom range">
          <CalendarRange color={range.periodKey === 'custom' ? colors.white : colors.primary} size={18} />
        </Pressable>
        <Pressable onPress={range.jumpToday} hitSlop={6} disabled={range.isCurrent} style={[styles.navArrow, range.isCurrent && { opacity: 0.35 }]} accessibilityLabel="Jump to today">
          <CalendarClock color={colors.primary} size={18} />
        </Pressable>
      </View>

      <Modal visible={calOpen} transparent animationType="fade" onRequestClose={() => setCalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCalOpen(false)}>
          <Pressable style={styles.calCard} onPress={(e) => e.stopPropagation()}>
            <FsText variant="cardTitle" style={{ marginBottom: space[2] }}>{calTitle}</FsText>
            {calMode === 'end' && pendingStart && (
              <FsText variant="caption" style={{ marginBottom: space[2], color: colors.primary }}>From {range.fmt(pendingStart)} — pick the end date</FsText>
            )}
            <MonthCalendar
              month={calMonth}
              marked={new Set()}
              selected={calMode === 'end' && pendingStart ? pendingStart : range.endIso}
              allowAllDays
              onMonthChange={(delta) => setCalMonth((m) => addMonths(m, delta))}
              onSelectDay={onCalSelect}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  periodRow: { flexDirection: 'row', gap: space[1], marginBottom: space[2] },
  segChip: { flex: 1, alignItems: 'center', paddingHorizontal: space[2] },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] },
  navArrow: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  navArrowOn: { backgroundColor: colors.primary },
  rangeBtn: { flex: 1, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: space[4] },
  calCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space[4] },
}));
