interface MacroBarProps {
  label: string
  value: number
  target: number
  color: string
}

export function MacroBar({ label, value, target, color }: MacroBarProps) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span>{Math.round(value)}g / {target}g</span>
      </div>
      <div className="h-1.5 bg-surfaceHigh rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
