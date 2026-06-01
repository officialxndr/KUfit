interface CalorieRingProps {
  eaten: number
  goal: number
  size?: number
  strokeWidth?: number
}

export function CalorieRing({ eaten, goal, size = 144, strokeWidth = 10 }: CalorieRingProps) {
  const r = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(eaten / goal, 1) : 0
  const dash = pct * circ
  const color = pct < 0.75 ? '#22c55e' : pct < 0.95 ? '#f59e0b' : '#ef4444'
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2a2a" strokeWidth={strokeWidth} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold">{Math.round(eaten)}</div>
        <div className="text-xs text-muted">/ {goal} kcal</div>
      </div>
    </div>
  )
}
