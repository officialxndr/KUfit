import { useEffect, useState, useCallback, useRef } from 'react'
import { useWorkoutStore, type LocalExercise, type LocalSet } from '@/stores/workoutStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { ExercisePicker } from '@/components/ExercisePicker'
import { Numpad } from '@/components/workout/Numpad'
import { toDisplayWeight, toKg, UNIT_LABELS } from '@/lib/units'
import { Check, X, StickyNote, Trophy, Timer, ArrowLeft, Plus } from '@/components/icons'
import type { Exercise, WorkoutSession, UnitSystem } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function useElapsedTimer(startedAt: Date | null) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const REST_PRESETS = [0, 60, 90, 120, 150, 180]

function playRestDoneBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const times = [0, 0.18, 0.36]
    times.forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.15)
    })
    setTimeout(() => ctx.close(), 700)
  } catch { /* ignore if audio not available */ }
}

type FocusedField = { exLocalId: string; setLocalId: string; field: 'weight' | 'reps' } | null
type ActiveRest = { setLocalId: string; total: number; remaining: number } | null

// ── Set Row ───────────────────────────────────────────────────────────────────

function SetRow({
  set,
  lastSet,
  unitSystem,
  focused,
  draft,
  onFocusField,
  onCheck,
  onRemove,
  showRemove,
}: {
  set: LocalSet
  lastSet?: { weightKg: number; reps: number }
  unitSystem: UnitSystem
  focused: FocusedField
  draft: string
  onFocusField: (field: 'weight' | 'reps') => void
  onCheck: () => void
  onRemove: () => void
  showRemove: boolean
}) {
  const prevText = lastSet
    ? `${toDisplayWeight(lastSet.weightKg, unitSystem)} × ${lastSet.reps}`
    : '—'

  const isFocused = (f: 'weight' | 'reps') => focused?.setLocalId === set.localId && focused.field === f
  const weightDisplay = isFocused('weight')
    ? draft
    : set.weightKg > 0 ? String(toDisplayWeight(set.weightKg, unitSystem)) : ''
  const repsDisplay = isFocused('reps') ? draft : set.reps > 0 ? String(set.reps) : ''

  const cell = (field: 'weight' | 'reps', value: string) => (
    <button
      onClick={() => onFocusField(field)}
      className={`w-16 py-1.5 rounded-lg text-center text-sm font-medium tabular-nums shrink-0 transition-colors ${
        isFocused(field) ? 'bg-surface ring-2 ring-primary' : 'bg-surfaceHigh'
      }`}
    >
      {value || <span className="text-muted">0</span>}
    </button>
  )

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors ${set.done ? 'bg-success/10' : ''}`}>
      <span className="text-muted text-sm w-5 text-center shrink-0">{set.setNumber}</span>
      <span className="text-muted text-xs w-16 text-center shrink-0 tabular-nums">{prevText}</span>
      {cell('weight', weightDisplay)}
      {cell('reps', repsDisplay)}
      <button
        onClick={onCheck}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
          set.done ? 'bg-success text-white' : 'bg-surfaceHigh text-muted'
        }`}
        aria-label="Complete set"
      >
        <Check className="w-4 h-4" />
      </button>
      {showRemove ? (
        <button
          onClick={onRemove}
          className="w-8 h-8 rounded-lg bg-surfaceHigh text-muted flex items-center justify-center shrink-0"
          aria-label="Remove set"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-8 shrink-0" />
      )}
    </div>
  )
}

// ── Rest Bar ────────────────────────────────────────────────────────────────

function RestBar({ rest, onSkip }: { rest: NonNullable<ActiveRest>; onSkip: () => void }) {
  const pct = rest.total > 0 ? (rest.remaining / rest.total) * 100 : 0
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-primary font-medium flex items-center gap-1">
          <Timer className="w-3.5 h-3.5" /> Rest {formatTime(rest.remaining)}
        </span>
        <button onClick={onSkip} className="text-xs text-muted">Skip</button>
      </div>
      <div className="h-1 rounded-full bg-surfaceHigh overflow-hidden">
        <div className="h-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  le,
  unitSystem,
  focused,
  draft,
  activeRest,
  onFocusField,
  onCheck,
  onSkipRest,
}: {
  le: LocalExercise
  unitSystem: UnitSystem
  focused: FocusedField
  draft: string
  activeRest: ActiveRest
  onFocusField: (exLocalId: string, setLocalId: string, field: 'weight' | 'reps') => void
  onCheck: (le: LocalExercise, set: LocalSet) => void
  onSkipRest: () => void
}) {
  const { addSet, removeSet, updateExerciseNotes, removeExerciseFromSession } = useWorkoutStore()
  const [showNotes, setShowNotes] = useState(false)
  const weightUnit = UNIT_LABELS[unitSystem].weight

  return (
    <div className="bg-surface rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold leading-tight truncate text-primary">{le.exercise.name}</h3>
          {le.exercise.muscleGroup && (
            <p className="text-xs text-muted mt-0.5">{le.exercise.muscleGroup}</p>
          )}
        </div>
        <div className="flex items-center gap-3 ml-2 shrink-0">
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={showNotes ? 'text-primary' : 'text-muted'}
            aria-label="Notes"
          >
            <StickyNote className="w-5 h-5" />
          </button>
          <button
            onClick={() => removeExerciseFromSession(le.localId)}
            className="text-muted"
            aria-label="Remove exercise"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showNotes && (
        <div className="px-4 py-2 border-b border-border">
          <textarea
            value={le.notes}
            onChange={(e) => updateExerciseNotes(le.localId, e.target.value)}
            placeholder="Notes for this exercise…"
            rows={2}
            className="w-full bg-surfaceHigh rounded-lg px-3 py-2 text-base resize-none outline-none placeholder:text-muted"
          />
        </div>
      )}

      <div className="py-1">
        <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-medium text-muted uppercase tracking-wide">
          <span className="w-5 text-center shrink-0">Set</span>
          <span className="w-16 text-center shrink-0">Previous</span>
          <span className="w-16 text-center shrink-0">{weightUnit}</span>
          <span className="w-16 text-center shrink-0">Reps</span>
          <span className="w-8 shrink-0" />
          <span className="w-4 shrink-0" />
        </div>

        {le.sets.map((set, i) => (
          <div key={set.localId}>
            <SetRow
              set={set}
              lastSet={le.lastSets[i]}
              unitSystem={unitSystem}
              focused={focused}
              draft={draft}
              onFocusField={(field) => onFocusField(le.localId, set.localId, field)}
              onCheck={() => onCheck(le, set)}
              onRemove={() => removeSet(le.localId, set.localId)}
              showRemove={i === le.sets.length - 1 && le.sets.length > 1}
            />
            {activeRest?.setLocalId === set.localId && (
              <RestBar rest={activeRest} onSkip={onSkipRest} />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => addSet(le.localId)}
        className="w-full text-sm text-primary py-2.5 hover:bg-primary/5 transition-colors font-medium flex items-center justify-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Set
        {le.restSeconds > 0 && <span className="text-muted">· rest {formatTime(le.restSeconds)}</span>}
      </button>
    </div>
  )
}

// ── Workout Summary ───────────────────────────────────────────────────────────

function WorkoutSummary({ session, elapsed, unitSystem, onDone }: { session: WorkoutSession; elapsed: number; unitSystem: UnitSystem; onDone: () => void }) {
  const prs = session.exercises.flatMap((e) => e.sets.filter((s) => s.isPersonalBest))
  const weightUnit = UNIT_LABELS[unitSystem].weight
  const duration = session.finishedAt
    ? Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : Math.round(elapsed / 60)

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end">
      <div className="w-full bg-surface rounded-t-3xl p-6 space-y-4">
        <h2 className="text-xl font-bold text-center">Workout Complete!</h2>
        <p className="text-muted text-center text-sm">{session.name}</p>

        <div className="flex justify-center gap-8 py-2">
          <div className="text-center">
            <p className="text-2xl font-bold">{duration}</p>
            <p className="text-xs text-muted">minutes</p>
          </div>
          {session.totalVolume != null && (
            <div className="text-center">
              <p className="text-2xl font-bold">{Math.round(session.totalVolume).toLocaleString()}</p>
              <p className="text-xs text-muted">kg volume</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-2xl font-bold">{session.exercises.length}</p>
            <p className="text-xs text-muted">exercises</p>
          </div>
        </div>

        {prs.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4">
            <p className="text-warning font-semibold text-sm mb-2 flex items-center gap-1.5">
              <Trophy className="w-4 h-4" /> {prs.length} Personal Best{prs.length > 1 ? 's' : ''}!
            </p>
            {prs.map((s) => (
              <p key={s.id} className="text-xs text-muted">
                {toDisplayWeight(s.weightKg, unitSystem)} {weightUnit} × {s.reps} reps
              </p>
            ))}
          </div>
        )}

        <button onClick={onDone} className="w-full bg-primary text-white font-semibold py-3 rounded-2xl">
          Done
        </button>
      </div>
    </div>
  )
}

// ── Active Session (main export) ──────────────────────────────────────────────

interface ActiveSessionProps {
  onFinish: () => void
}

export function ActiveSession({ onFinish }: ActiveSessionProps) {
  const {
    activeSession, sessionStartedAt, localExercises, finishSession, discardSession,
    addExerciseToSession, updateSet, updateExerciseRest,
  } = useWorkoutStore()
  const { unitSystem } = useSettingsStore()
  const elapsed = useElapsedTimer(sessionStartedAt)
  const [showPicker, setShowPicker] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null)
  const [focused, setFocused] = useState<FocusedField>(null)
  const [numpadVisible, setNumpadVisible] = useState(false)
  const [draft, setDraft] = useState('')
  const [activeRest, setActiveRest] = useState<ActiveRest>(null)
  const [restPreset, setRestPreset] = useState(120)

  const weightStep = unitSystem === 'IMPERIAL' ? 5 : 2.5

  // Rest-timer ticking
  const restRef = useRef<ActiveRest>(null)
  restRef.current = activeRest
  useEffect(() => {
    if (!activeRest) return
    const id = setInterval(() => {
      const r = restRef.current
      if (!r) return
      if (r.remaining <= 1) {
        setActiveRest(null)
        playRestDoneBeep()
      } else {
        setActiveRest({ ...r, remaining: r.remaining - 1 })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [activeRest?.setLocalId])

  // Commit the draft string to the store for the focused field.
  const commitDraft = useCallback((value: string, f: NonNullable<FocusedField>) => {
    if (f.field === 'weight') {
      updateSet(f.exLocalId, f.setLocalId, { weightKg: toKg(parseFloat(value) || 0, unitSystem) })
    } else {
      updateSet(f.exLocalId, f.setLocalId, { reps: parseInt(value) || 0 })
    }
  }, [updateSet, unitSystem])

  const focusField = (exLocalId: string, setLocalId: string, field: 'weight' | 'reps') => {
    const le = localExercises.find((e) => e.localId === exLocalId)
    const set = le?.sets.find((s) => s.localId === setLocalId)
    if (!set) return
    const initial = field === 'weight'
      ? (set.weightKg > 0 ? String(toDisplayWeight(set.weightKg, unitSystem)) : '')
      : (set.reps > 0 ? String(set.reps) : '')
    setDraft(initial)
    setFocused({ exLocalId, setLocalId, field })
    setNumpadVisible(true)
  }

  const handleKey = (key: string) => {
    if (!focused) return // Keys do nothing during rest (no field focused)
    let next = draft
    if (key === 'backspace') next = draft.slice(0, -1)
    else if (key === '.') { if (!draft.includes('.')) next = draft === '' ? '0.' : draft + '.' }
    else next = (draft === '0' ? '' : draft) + key
    setDraft(next)
    commitDraft(next, focused)
  }

  const handleStep = (dir: number) => {
    if (!focused) return
    const step = focused.field === 'weight' ? weightStep : 1
    const curr = parseFloat(draft) || 0
    const val = Math.max(0, Math.round((curr + dir * step) * 100) / 100)
    const next = String(val)
    setDraft(next)
    commitDraft(next, focused)
  }

  // Mark a set done and kick off its rest timer (shared by the ✓ button and Numpad).
  const markSetDone = (le: LocalExercise, set: LocalSet) => {
    updateSet(le.localId, set.localId, { done: true })
    if (le.restSeconds > 0) {
      setActiveRest({ setLocalId: set.localId, total: le.restSeconds, remaining: le.restSeconds })
    }
  }

  // Advance: weight → reps → mark set complete (start rest) → keep numpad for next set.
  const handleNext = () => {
    const exs = useWorkoutStore.getState().localExercises

    if (!focused) {
      // Numpad is showing but no field is focused (e.g. during rest) — advance to next undone set.
      for (const exercise of exs) {
        for (const s of exercise.sets) {
          if (!s.done) {
            focusField(exercise.localId, s.localId, 'weight')
            return
          }
        }
      }
      setNumpadVisible(false)
      return
    }

    if (focused.field === 'weight') {
      focusField(focused.exLocalId, focused.setLocalId, 'reps')
      return
    }

    // Reps field → mark set done, keep numpad visible for next set
    const le = exs.find((e) => e.localId === focused.exLocalId)
    const set = le?.sets.find((s) => s.localId === focused.setLocalId)
    if (le && set) markSetDone(le, set)
    setFocused(null)
    // Numpad stays visible (numpadVisible remains true) so user can tap Next to advance
  }

  const handleCheck = (le: LocalExercise, set: LocalSet) => {
    const becomingDone = !set.done
    updateSet(le.localId, set.localId, { done: becomingDone })
    if (becomingDone && le.restSeconds > 0) {
      setActiveRest({ setLocalId: set.localId, total: le.restSeconds, remaining: le.restSeconds })
    } else if (!becomingDone && activeRest?.setLocalId === set.localId) {
      setActiveRest(null)
    }
  }

  const cycleRestPreset = () => {
    const idx = REST_PRESETS.indexOf(restPreset)
    const next = REST_PRESETS[(idx + 1) % REST_PRESETS.length]
    setRestPreset(next)
    localExercises.forEach((le) => updateExerciseRest(le.localId, next))
  }

  const handleFinish = async () => {
    setFinishing(true)
    try {
      const session = await finishSession()
      setCompletedSession(session)
    } catch {
      setFinishing(false)
    }
  }

  const handleSummaryDone = () => {
    setCompletedSession(null)
    onFinish()
  }

  const handleAddExercise = (exercise: Exercise) => {
    addExerciseToSession(exercise)
    setShowPicker(false)
  }

  if (!activeSession) return null

  if (showPicker) {
    return (
      <div className="fixed inset-0 z-40 bg-background flex flex-col">
        <div className="bg-surface border-b border-border px-4 py-3 safe-top flex items-center gap-2">
          <button onClick={() => setShowPicker(false)} className="text-primary font-medium flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="font-semibold">Add Exercise</h2>
        </div>
        <ExercisePicker onSelect={handleAddExercise} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3 safe-top flex items-center justify-between shrink-0">
        <button
          onClick={cycleRestPreset}
          className="flex items-center gap-1.5 text-sm text-muted bg-surfaceHigh px-3 py-1.5 rounded-lg"
          aria-label="Rest timer length"
        >
          <Timer className="w-4 h-4" />
          {restPreset === 0 ? 'Off' : formatTime(restPreset)}
        </button>
        <div className="text-center">
          <h1 className="font-bold leading-tight">{activeSession.name}</h1>
          <p className="text-xs text-muted tabular-nums">{formatTime(elapsed)}</p>
        </div>
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="bg-success text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-60"
        >
          {finishing ? '…' : 'Finish'}
        </button>
      </div>

      {/* Exercise list */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${numpadVisible ? 'pb-80' : 'pb-8'}`}>
        {localExercises.length === 0 && (
          <p className="text-center text-muted text-sm py-10">No exercises added yet.</p>
        )}

        {localExercises.map((le) => (
          <ExerciseCard
            key={le.localId}
            le={le}
            unitSystem={unitSystem}
            focused={focused}
            draft={draft}
            activeRest={activeRest}
            onFocusField={focusField}
            onCheck={handleCheck}
            onSkipRest={() => setActiveRest(null)}
          />
        ))}

        <button
          onClick={() => setShowPicker(true)}
          className="w-full border-2 border-dashed border-border text-muted text-sm py-4 rounded-2xl hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Exercise
        </button>

        <button onClick={() => setShowDiscard(true)} className="w-full text-danger text-sm py-2">
          Discard Workout
        </button>
      </div>

      {/* Numpad — stays visible during rest timer so user can advance to next set */}
      {numpadVisible && (
        <Numpad
          onKey={handleKey}
          onStep={handleStep}
          onNext={handleNext}
          onDone={() => { setFocused(null); setNumpadVisible(false) }}
          allowDecimal={focused?.field === 'weight'}
          stepLabel={focused?.field === 'weight' ? String(weightStep) : '1'}
          nextLabel={focused?.field === 'weight' ? 'Next' : focused?.field === 'reps' ? 'Complete' : 'Next Set'}
        />
      )}

      {/* Discard confirmation */}
      {showDiscard && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full bg-surface rounded-t-2xl p-6 space-y-3">
            <h3 className="font-semibold text-center">Discard this workout?</h3>
            <p className="text-muted text-sm text-center">Your progress won't be saved.</p>
            <button
              onClick={() => { discardSession(); onFinish() }}
              className="w-full bg-danger text-white font-semibold py-3 rounded-xl"
            >
              Discard
            </button>
            <button onClick={() => setShowDiscard(false)} className="w-full text-muted py-2">
              Keep Going
            </button>
          </div>
        </div>
      )}

      {/* Workout summary */}
      {completedSession && (
        <WorkoutSummary session={completedSession} elapsed={elapsed} unitSystem={unitSystem} onDone={handleSummaryDone} />
      )}
    </div>
  )
}
