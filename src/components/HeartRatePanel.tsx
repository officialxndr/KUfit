import { View } from 'react-native';
import { HeartPulse } from 'lucide-react-native';

import { Card, FsText } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { maxHeartRate, zoneBreakdown } from '@/lib/heartRate';
import { colors, radius, space } from '@/theme/tokens';

/**
 * Heart-rate look-back for a finished workout: avg/min/max, an HR-over-time line,
 * and time-in-zone bars (zones from age-predicted max HR). Reused by the workout
 * summary and the history detail sheet.
 */
export function HeartRatePanel({
  avg,
  min,
  max,
  samples,
  age,
  style,
}: {
  avg: number;
  min: number | null;
  max: number | null;
  samples: number[] | null;
  age: number | null;
  style?: object;
}) {
  const zones = age != null && samples ? zoneBreakdown(samples, maxHeartRate(age)) : null;

  return (
    <Card style={{ gap: space[3], ...style }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <HeartPulse color={colors.danger} size={16} />
        <FsText variant="cardTitle">Heart Rate</FsText>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <HrStat label="Avg" value={avg} />
        <HrStat label="Max" value={max} />
        <HrStat label="Min" value={min} />
      </View>

      {samples && samples.length >= 2 && (
        <LineChart
          series={[{ points: samples, color: colors.danger }]}
          height={130}
          format={(n) => `${Math.round(n)}`}
        />
      )}

      {zones && (
        <View style={{ gap: space[2] }}>
          {zones.map((z) => (
            <View key={z.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <FsText variant="caption" style={{ width: 96 }}>{z.label}</FsText>
              <View style={{ flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(z.pct * 100)}%`, height: '100%', backgroundColor: z.color, borderRadius: radius.full }} />
              </View>
              <FsText variant="caption" style={{ width: 34, textAlign: 'right' }}>{Math.round(z.pct * 100)}%</FsText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function HrStat({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <FsText variant="stat">{value != null ? Math.round(value) : '—'}</FsText>
      <FsText variant="caption">{label} bpm</FsText>
    </View>
  );
}
