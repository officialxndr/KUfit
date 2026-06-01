import { useMemo } from 'react'
import {
  ComposedChart, Area, Scatter, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'
import { toDisplayWeight, UNIT_LABELS } from '@/lib/units'
import type { WeightEntry, UnitSystem } from '@/types'

export type WeightRange = '7D' | '30D' | '90D' | '1Y'
export const RANGE_DAYS: Record<WeightRange, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }

function movingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

export function WeightChart({
  entries,
  goalWeightKg,
  unitSystem,
  range,
  onRangeChange,
}: {
  entries: WeightEntry[]
  goalWeightKg: number | null
  unitSystem: UnitSystem
  range: WeightRange
  onRangeChange: (r: WeightRange) => void
}) {
  const weightUnit = UNIT_LABELS[unitSystem].weight
  const goalVal = goalWeightKg != null ? toDisplayWeight(goalWeightKg, unitSystem) : null

  const { data, domain, trendColor } = useMemo(() => {
    const raws = entries.map((e) => toDisplayWeight(e.weightKg, unitSystem))
    const mas = movingAvg(raws, 7).map((v) => Math.round(v * 10) / 10)
    const data = entries.map((e, i) => ({
      date: format(new Date(e.date), 'MMM d'),
      raw: raws[i],
      ma: mas[i],
    }))

    // Y domain across raw, ma and the goal line, padded a little.
    const all = [...raws, ...mas, ...(goalVal != null ? [goalVal] : [])]
    const min = all.length ? Math.min(...all) : 0
    const max = all.length ? Math.max(...all) : 1
    const pad = Math.max(0.5, (max - min) * 0.1)
    const domain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)]

    // Trend direction relative to goal → green when moving toward, red when away.
    let trendColor = '#6366f1'
    if (goalVal != null && mas.length >= 2) {
      const change = mas[mas.length - 1] - mas[0]
      const toward = (goalVal < mas[0] && change < 0) || (goalVal > mas[0] && change > 0)
      trendColor = Math.abs(change) < 0.05 ? '#6366f1' : toward ? '#22c55e' : '#ef4444'
    }

    return { data, domain, trendColor }
  }, [entries, unitSystem, goalVal])

  return (
    <div className="bg-surface rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Weight Trend</p>
        <div className="flex gap-1">
          {(Object.keys(RANGE_DAYS) as WeightRange[]).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                range === r ? 'bg-primary text-white' : 'text-muted bg-surfaceHigh'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="text-center text-muted text-sm py-10">Not enough data in this range.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={data} margin={{ left: -10, right: 8, top: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={domain}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                width={36}
                tickFormatter={(v) => v.toFixed(0)}
              />
              <Tooltip
                contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#6b7280' }}
                formatter={(v: number, name) => [`${v} ${weightUnit}`, name === 'ma' ? '7d avg' : 'Weight']}
              />
              {/* Green/red progress band between the trend and the goal line */}
              {goalVal != null && (
                <Area
                  dataKey="ma"
                  baseValue={goalVal}
                  stroke="none"
                  fill={trendColor}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
              )}
              {goalVal != null && (
                <ReferenceLine y={goalVal} stroke="#6366f1" strokeDasharray="4 2" strokeOpacity={0.6} />
              )}
              <Scatter dataKey="raw" fill="#6b7280" opacity={0.45} />
              <Line
                dataKey="ma"
                type="monotone"
                stroke={trendColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: trendColor }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-muted opacity-50" />
              <span className="text-xs text-muted">Daily</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5" style={{ background: trendColor }} />
              <span className="text-xs text-muted">7d avg</span>
            </div>
            {goalVal != null && (
              <div className="flex items-center gap-1.5">
                <div className="w-4 border-t-2 border-dashed border-primary opacity-60" />
                <span className="text-xs text-muted">Goal</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
