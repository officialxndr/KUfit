import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { subWeeks, subMonths, format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useWorkoutStore } from '@/stores/workoutStore'
import { ExercisePicker } from '@/components/ExercisePicker'
import { TemplateBuilder } from '@/components/workout/TemplateBuilder'
import { ActiveSession } from '@/components/workout/ActiveSession'
import { SessionDetail } from '@/components/workout/SessionDetail'
import { api } from '@/lib/api'
import { useSwipeReveal } from '@/hooks/useSwipeReveal'
import type { WorkoutSession, WorkoutTemplate } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { Trophy, Clock, MoreHorizontal } from '@/components/icons'
import { MuscleMap } from '@/components/MuscleMap'

// ── Volume chart ──────────────────────────────────────────────────────────────

type Period = '4w' | '3m' | '6m' | '1y'

function periodToFrom(p: Period): string {
  const now = new Date()
  switch (p) {
    case '4w':  return subWeeks(now, 4).toISOString()
    case '3m':  return subMonths(now, 3).toISOString()
    case '6m':  return subMonths(now, 6).toISOString()
    case '1y':  return subMonths(now, 12).toISOString()
  }
}

function VolumeChart() {
  const [period, setPeriod] = useState<Period>('4w')
  const [data, setData] = useState<{ date: string; volume: number }[]>([])

  useEffect(() => {
    api.get('/workouts/volume', {
      params: { from: periodToFrom(period), to: new Date().toISOString() },
    })
      .then(({ data: sessions }) => {
        setData(
          sessions.map((s: { startedAt: string; totalVolume: number | null }) => ({
            date: format(new Date(s.startedAt), 'MMM d'),
            volume: Math.round(s.totalVolume ?? 0),
          }))
        )
      })
      .catch(() => {})
  }, [period])

  return (
    <div className="bg-surface rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Volume</h3>
        <div className="flex gap-1">
          {(['4w', '3m', '6m', '1y'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                period === p ? 'bg-primary text-white' : 'text-muted bg-surfaceHigh'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-center text-muted text-sm py-6">No workout data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{ background: '#1c1c1e', border: 'none', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v.toLocaleString()} kg`, 'Volume']}
            />
            <Line
              type="monotone"
              dataKey="volume"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────

function muscleSummary(template: WorkoutTemplate): string {
  const groups = Array.from(
    new Set(
      template.exercises
        .map((e) => e.exercise.muscleGroup)
        .filter((m): m is string => !!m)
        .map((m) => m.charAt(0) + m.slice(1).toLowerCase())
    )
  )
  if (groups.length > 0) return groups.slice(0, 3).join(' · ')
  const n = template.exercises.length
  return n > 0 ? `${n} exercise${n > 1 ? 's' : ''}` : 'No exercises'
}

function TemplateCard({
  template,
  onStart,
  onEdit,
  onDelete,
}: {
  template: WorkoutTemplate
  onStart: (t: WorkoutTemplate) => void
  onEdit: (t: WorkoutTemplate) => void
  onDelete: (t: WorkoutTemplate) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const last = template.lastPerformedAt
    ? `${formatDistanceToNow(new Date(template.lastPerformedAt))} ago`
    : 'Never'

  return (
    <button
      onClick={() => onStart(template)}
      className="relative text-left bg-surface rounded-2xl p-4 flex flex-col gap-2 min-h-[7.5rem] active:bg-surfaceHigh transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{template.name}</h3>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className="shrink-0 -mr-1 -mt-1 p-1 text-muted hover:text-white rounded-lg"
          aria-label="Template options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </span>
      </div>

      <p className="text-xs text-muted">{muscleSummary(template)}</p>

      <div className="flex items-center gap-1.5 text-xs text-muted mt-auto pt-1">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Last performed {last}</span>
      </div>

      {menuOpen && (
        <>
          <span
            className="fixed inset-0 z-10"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
          />
          <span className="absolute right-3 top-10 z-20 bg-surfaceHigh border border-border rounded-xl overflow-hidden flex flex-col min-w-[7rem] shadow-lg">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(template) }}
              className="px-4 py-2.5 text-sm text-left hover:bg-surface"
            >
              Edit
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(template) }}
              className="px-4 py-2.5 text-sm text-left text-danger hover:bg-surface"
            >
              Delete
            </span>
          </span>
        </>
      )}
    </button>
  )
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onTap,
  onDelete,
}: {
  session: WorkoutSession
  onTap: () => void
  onDelete: () => void
}) {
  const { revealed, offsetX, close, handlers } = useSwipeReveal({ revealWidth: 88 })
  const duration = session.finishedAt
    ? Math.round(
        (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
      )
    : null
  const prs = session.exercises.flatMap(e => e.sets.filter(s => s.isPersonalBest)).length

  return (
    <div className="relative overflow-hidden rounded-2xl" {...handlers}>
      {/* Delete zone */}
      <div className="absolute right-0 top-0 bottom-0 w-[88px] bg-danger flex items-center justify-center">
        <button
          onClick={() => { onDelete(); close() }}
          className="text-white text-xs font-semibold px-2 py-1"
        >
          Delete
        </button>
      </div>
      {/* Main card */}
      <button
        onClick={revealed ? close : onTap}
        className="w-full text-left bg-surface p-4 transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: revealed ? 'transform 0.2s ease' : undefined,
        }}
      >
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold">{session.name}</h3>
          <span className="text-xs text-muted shrink-0 ml-2">
            {formatDistanceToNow(new Date(session.startedAt))} ago
          </span>
        </div>
        <div className="flex gap-4 text-sm text-muted">
          {duration != null && <span>{duration} min</span>}
          {session.totalVolume != null && (
            <span>{Math.round(session.totalVolume).toLocaleString()} kg vol</span>
          )}
          <span>{session.exercises.length} exercises</span>
          {prs > 0 && (
            <span className="text-warning flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> {prs} PR{prs > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}

// ── Main Workout Page ─────────────────────────────────────────────────────────

export function Workout() {
  const { templates, activeSession, loadTemplates, startSession } = useWorkoutStore()
  const location = useLocation()
  const navigate = useNavigate()
  const tab: 'templates' | 'history' | 'exercises' =
    location.pathname.endsWith('/history') ? 'history'
    : location.pathname.endsWith('/exercises') ? 'exercises'
    : 'templates'
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | undefined>()
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null)

  const fetchSessions = () => {
    api
      .get('/workouts/sessions', { params: { limit: 20 } })
      .then(({ data }) => setSessions((data.sessions ?? []).filter((s: WorkoutSession) => s.finishedAt)))
      .catch(() => {})
  }

  useEffect(() => {
    loadTemplates()
    fetchSessions()
  }, [])

  const handleStart = async (template: WorkoutTemplate) => {
    setLoading(true)
    try {
      await startSession(template.name, template.id)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickStart = async () => {
    setLoading(true)
    try {
      await startSession('Quick Workout')
    } finally {
      setLoading(false)
    }
  }

  const handleSessionFinish = () => {
    fetchSessions()
    navigate('/workout/history')
  }

  const handleDeleteTemplate = async (template: WorkoutTemplate) => {
    if (!confirm(`Delete template "${template.name}"?`)) return
    try {
      await api.delete(`/workouts/templates/${template.id}`)
      loadTemplates()
    } catch { /* silent */ }
  }

  const handleTemplateSaved = (saved: WorkoutTemplate) => {
    loadTemplates()
    setShowBuilder(false)
    setEditingTemplate(undefined)
    // If no exercises and user wants to start, stay on templates tab
    void saved
  }

  // Active session overlay takes over the screen
  if (activeSession) {
    return <ActiveSession onFinish={handleSessionFinish} />
  }

  // Template builder overlay
  if (showBuilder || editingTemplate) {
    return (
      <TemplateBuilder
        template={editingTemplate}
        onSave={handleTemplateSaved}
        onClose={() => { setShowBuilder(false); setEditingTemplate(undefined) }}
      />
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Exercises tab uses ExercisePicker full-height */}
      {tab === 'exercises' ? (
        <ExercisePicker />
      ) : (
        <div className="flex-1 overflow-y-auto p-4 pb-nav space-y-3">
          {/* Templates tab */}
          {tab === 'templates' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Templates</h2>
                <button
                  onClick={() => setShowBuilder(true)}
                  className="text-primary font-medium text-sm"
                >
                  + New
                </button>
              </div>

              <MuscleMap />

              <button
                onClick={handleQuickStart}
                disabled={loading}
                className="w-full bg-primary text-white font-semibold py-3 rounded-2xl disabled:opacity-60"
              >
                {loading ? 'Starting…' : 'Quick Start'}
              </button>

              {templates.length === 0 ? (
                <div className="text-center text-muted text-sm py-10 space-y-2">
                  <p>No templates yet.</p>
                  <button
                    onClick={() => setShowBuilder(true)}
                    className="text-primary font-medium"
                  >
                    Create your first template →
                  </button>
                </div>
              ) : (
                (() => {
                  // Group templates by label; unlabelled → null group at the end
                  const labeledMap = new Map<string, WorkoutTemplate[]>()
                  const unlabeled: WorkoutTemplate[] = []
                  for (const t of templates) {
                    const key = t.label?.trim() || ''
                    if (key) {
                      const arr = labeledMap.get(key) ?? []
                      arr.push(t)
                      labeledMap.set(key, arr)
                    } else {
                      unlabeled.push(t)
                    }
                  }
                  const groups: { label: string | null; items: WorkoutTemplate[] }[] = [
                    ...Array.from(labeledMap.entries()).map(([label, items]) => ({ label, items })),
                    ...(unlabeled.length > 0 ? [{ label: null, items: unlabeled }] : []),
                  ]

                  return (
                    <div className="space-y-4">
                      {groups.map(({ label, items }) => (
                        <div key={label ?? '__none__'}>
                          {label && (
                            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 px-1">
                              {label}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            {items.map(t => (
                              <TemplateCard
                                key={t.id}
                                template={t}
                                onStart={handleStart}
                                onEdit={tmpl => { setEditingTemplate(tmpl) }}
                                onDelete={handleDeleteTemplate}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
            </>
          )}

          {/* History tab */}
          {tab === 'history' && (
            <>
              <VolumeChart />

              {sessions.length === 0 ? (
                <p className="text-center text-muted text-sm py-8">No workout history yet.</p>
              ) : (
                sessions.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onTap={() => setSelectedSession(s)}
                    onDelete={() => {
                      api.delete(`/workouts/sessions/${s.id}`)
                        .then(() => setSessions(prev => prev.filter(x => x.id !== s.id)))
                        .catch(() => {})
                    }}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <SessionDetail session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  )
}
