import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subDays, format, differenceInCalendarDays, parseISO } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import { api } from '@/lib/api'
import { formatWeight } from '@/lib/units'
import { CalorieRing } from '@/components/CalorieRing'
import { MacroBar } from '@/components/MacroBar'
import { Flame, Dumbbell, Ruler, Check, UserCircle, TrendingDown, TrendingUp, CheckCircle2, AlertTriangle, AlertCircle } from '@/components/icons'
import type { HealthStats, WeightEntry } from '@/types'

interface DailySummary {
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface DailyEntry {
  date: string
  calories: number
}

interface RecentSession {
  id: string
  name: string
  startedAt: string
  finishedAt: string | null
  template: { name: string } | null
}

// Build an array of the last N days as { date, label, calories } including days with no logs (0 cal)
function buildSparklineData(entries: DailyEntry[], days: number) {
  const today = new Date()
  const byDate = new Map(entries.map((e) => [e.date, e.calories]))
  return Array.from({ length: days }, (_, i) => {
    const d = subDays(today, days - 1 - i)
    const dateStr = format(d, 'yyyy-MM-dd')
    return {
      date: dateStr,
      label: format(d, 'EEE').slice(0, 2),
      calories: byDate.get(dateStr) ?? 0,
    }
  })
}

// Count consecutive days with any calories logged, going backwards from today
function computeStreak(entries: DailyEntry[]): number {
  const withCalories = new Set(entries.filter((e) => e.calories > 0).map((e) => e.date))
  let streak = 0
  const today = format(new Date(), 'yyyy-MM-dd')
  // If today has entries, include today; otherwise start checking from yesterday
  const startOffset = withCalories.has(today) ? 0 : 1
  for (let i = startOffset; i < 31; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (withCalories.has(d)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { unitSystem } = useSettingsStore()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [stats, setStats] = useState<HealthStats | null>(null)
  const [calorieGoal, setCalorieGoal] = useState(2000)
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([])
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const sevenDaysAgo = subDays(new Date(), 7).toISOString()

    Promise.all([
      api.get('/food/stats', { params: { from: today, to: today } }),
      api.get('/health/stats'),
      api.get('/auth/me'),
      api.get('/food/daily', { params: { from: thirtyDaysAgo, to: today } }),
      api.get('/workouts/sessions', { params: { limit: 3 } }),
      api.get('/health/weight', { params: { from: sevenDaysAgo, to: new Date().toISOString() } }),
    ])
      .then(([foodRes, healthRes, meRes, dailyRes, sessionsRes, weightRes]) => {
        setSummary(foodRes.data)
        setStats(healthRes.data)
        const profile = meRes.data?.profile
        if (profile?.calorieGoal) setCalorieGoal(profile.calorieGoal)
        setDailyEntries(dailyRes.data ?? [])
        const sessions: RecentSession[] = sessionsRes.data?.sessions ?? []
        setRecentSessions(sessions.filter((s) => s.finishedAt).slice(0, 3))
        setWeightEntries(weightRes.data ?? [])
      })
      .catch(() => {})
  }, [])

  const profile = user?.profile
  const caloriesEaten = summary?.calories ?? 0
  const activeSession = useWorkoutStore((s) => s.activeSession)

  const sparklineData = buildSparklineData(dailyEntries, 7)
  const streak = computeStreak(dailyEntries)

  const lastSession = recentSessions[0] ?? null
  const daysSinceLastSession = lastSession
    ? differenceInCalendarDays(new Date(), parseISO(lastSession.startedAt))
    : null

  // Weight sparkline data (last 7 days)
  const weightSparkData = weightEntries.map((e) => ({
    date: format(new Date(e.date), 'EEE').slice(0, 2),
    weight: Math.round(e.weightKg * 10) / 10,
  }))

  // Pace adjustment for dashboard
  const delta = stats?.dailyCalorieDelta
  const goalType = profile?.goalType ?? 'MAINTAIN'
  let paceStatusLabel = 'On Pace'
  let paceHeaderBg = 'bg-success/10'
  let paceIconColor = 'text-success'
  type IconComp = React.ComponentType<{ className?: string }>
  let PaceIcon: IconComp = CheckCircle2
  if (!stats?.onTrack && delta != null) {
    if (Math.abs(delta) < 150) {
      paceStatusLabel = 'Slightly Behind'
      paceHeaderBg = 'bg-warning/10'
      paceIconColor = 'text-warning'
      PaceIcon = AlertTriangle as IconComp
    } else {
      paceStatusLabel = 'Off Track'
      paceHeaderBg = 'bg-danger/10'
      paceIconColor = 'text-danger'
      PaceIcon = AlertCircle as IconComp
    }
  }

  const paceBodyMsg = (() => {
    if (!delta) return ''
    const abs = Math.round(Math.abs(delta))
    if (goalType === 'LOSE') return delta > 0 ? `Cut ~${abs} cal/day to stay on track` : `${abs} cal/day surplus — you're ahead`
    if (goalType === 'GAIN') return delta < 0 ? `Add ~${abs} cal/day to stay on track` : `You're on track for your bulk`
    return `Trending off by ~${abs} cal/day`
  })()

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-nav space-y-4">
      {/* Active session banner */}
      {activeSession && (
        <Link
          to="/workout"
          className="block bg-primary/20 border border-primary/40 rounded-2xl p-4"
        >
          <p className="text-xs text-primary font-medium mb-0.5">Session in progress</p>
          <div className="flex items-center justify-between">
            <p className="font-semibold">{activeSession.name}</p>
            <span className="text-primary text-sm font-medium">Continue →</span>
          </div>
        </Link>
      )}

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
          ) : (
            <UserCircle className="w-11 h-11 text-muted shrink-0" strokeWidth={1.25} />
          )}
          <div>
            <h1 className="text-xl font-bold">Good {getGreeting()}</h1>
            <p className="text-muted text-sm">{user?.name ?? user?.email}</p>
          </div>
        </div>
        <div className="text-right text-sm text-muted">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Calorie ring + macros */}
      <Link to="/food" className="block bg-surface rounded-2xl p-4">
        <div className="flex items-center gap-6">
          <CalorieRing eaten={Math.round(caloriesEaten)} goal={calorieGoal} />
          <div className="flex-1 space-y-3">
            <MacroBar
              label="Protein"
              value={summary?.protein ?? 0}
              target={profile?.proteinTarget ?? 150}
              color="#6366f1"
            />
            <MacroBar
              label="Carbs"
              value={summary?.carbs ?? 0}
              target={profile?.carbsTarget ?? 200}
              color="#f59e0b"
            />
            <MacroBar
              label="Fat"
              value={summary?.fat ?? 0}
              target={profile?.fatTarget ?? 65}
              color="#ec4899"
            />
          </div>
        </div>
        <p className="text-xs text-muted mt-3 text-center">Tap to log food →</p>
      </Link>

      {/* Weekly calories sparkline */}
      <div className="bg-surface rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">This Week</p>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 bg-warning/10 rounded-full px-3 py-1">
              <Flame className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold text-warning">{streak} day streak</span>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={sparklineData} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={calorieGoal} stroke="#6366f1" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Bar dataKey="calories" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {sparklineData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.calories > 0 ? '#6366f1' : 'var(--color-surface-high)'}
                  fillOpacity={entry.calories > 0 ? (entry.calories >= calorieGoal * 0.8 ? 1 : 0.6) : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weight card */}
      {stats?.current && (
        <Link to="/health" className="block bg-surface rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted mb-1">Current Weight</p>
              <p className="text-2xl font-bold">
                {formatWeight(stats.current.weightKg, unitSystem)}
              </p>
              {stats.weeklyChange !== null && (
                <p className={`text-sm ${stats.weeklyChange < 0 ? 'text-success' : stats.weeklyChange > 0 ? 'text-danger' : 'text-muted'}`}>
                  {stats.weeklyChange > 0 ? '+' : ''}{formatWeight(Math.abs(stats.weeklyChange), unitSystem)} this week
                </p>
              )}
            </div>
            <div className="text-right">
              {stats.goalEta && (
                <>
                  <p className="text-xs text-muted">Goal ETA</p>
                  <p className="text-sm font-medium">{stats.goalEta}</p>
                </>
              )}
              {stats.onTrack && (
                <span className="text-xs text-success inline-flex items-center gap-1">
                  On track <Check className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Pace adjustment — redesigned */}
      {stats && (stats.onTrack || (delta != null && delta !== 0)) && (
        <Link to="/health" className="block bg-surface rounded-2xl overflow-hidden border border-border">
          <div className={`px-4 py-3 flex items-center gap-2 ${paceHeaderBg}`}>
            <PaceIcon className={`w-4 h-4 shrink-0 ${paceIconColor}`} />
            <span className={`text-sm font-semibold ${paceIconColor}`}>{paceStatusLabel}</span>
            <span className="text-xs text-muted ml-auto">Pace →</span>
          </div>
          {!stats.onTrack && paceBodyMsg && (
            <div className="px-4 py-2.5">
              <p className="text-sm text-muted">{paceBodyMsg}</p>
            </div>
          )}
        </Link>
      )}

      {/* Weight sparkline */}
      {weightSparkData.length > 1 && (
        <Link to="/health" className="block bg-surface rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Weight (7 days)</p>
            {stats?.weeklyChange != null && (
              <div className={`flex items-center gap-1 text-xs font-medium ${
                stats.weeklyChange < 0 ? 'text-success' : stats.weeklyChange > 0 ? 'text-warning' : 'text-muted'
              }`}>
                {stats.weeklyChange < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                {stats.weeklyChange > 0 ? '+' : ''}{formatWeight(Math.abs(stats.weeklyChange), unitSystem)}/wk
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={weightSparkData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={['auto', 'auto']} hide />
              <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Link>
      )}

      {/* Recent workouts */}
      {recentSessions.length > 0 && (
        <div className="bg-surface rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Recent Workouts</p>
            <Link to="/workout/history" className="text-xs text-primary">See all →</Link>
          </div>
          <div className="space-y-2">
            {recentSessions.map((s) => {
              const daysAgo = differenceInCalendarDays(new Date(), parseISO(s.startedAt))
              return (
                <Link
                  key={s.id}
                  to="/workout/history"
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted">
                      {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
                    </p>
                  </div>
                  <Dumbbell className="w-4 h-4 text-muted" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Workout suggestion (if no active session and hasn't worked out recently) */}
      {!activeSession && !recentSessions.length && (
        <Link
          to="/workout"
          className="block bg-surface rounded-2xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-muted mb-0.5">No recent workouts</p>
            <p className="text-sm font-medium">Start a session →</p>
          </div>
          <Dumbbell className="w-8 h-8 text-primary" />
        </Link>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/workout" className="bg-surface rounded-2xl p-4 flex flex-col gap-2">
          <Dumbbell className="w-7 h-7 text-primary" />
          <span className="font-medium text-sm">Log Workout</span>
        </Link>
        <Link to="/health/measurements" className="bg-surface rounded-2xl p-4 flex flex-col gap-2">
          <Ruler className="w-7 h-7 text-primary" />
          <span className="font-medium text-sm">Measurements</span>
        </Link>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
