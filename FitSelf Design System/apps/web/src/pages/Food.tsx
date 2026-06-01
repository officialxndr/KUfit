import { useEffect, useRef, useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { useFoodStore } from '@/stores/foodStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { CalorieRing } from '@/components/CalorieRing'
import { MacroBar } from '@/components/MacroBar'
import { AddFoodModal } from '@/components/AddFoodModal'
import { Coffee, Sun, Moon, Cookie, Plus, ChevronLeft, ChevronRight, Calendar } from '@/components/icons'
import { useSwipeReveal } from '@/hooks/useSwipeReveal'
import { CalendarDatePicker } from '@/components/CalendarDatePicker'
import { isGramUnit } from '@/lib/units'
import type { LucideIcon } from 'lucide-react'
import type { FoodLog, MealType } from '@/types'

const MEALS: { key: MealType; label: string; Icon: LucideIcon }[] = [
  { key: 'BREAKFAST', label: 'Breakfast', Icon: Coffee },
  { key: 'LUNCH', label: 'Lunch', Icon: Sun },
  { key: 'DINNER', label: 'Dinner', Icon: Moon },
  { key: 'SNACK', label: 'Snacks', Icon: Cookie },
]

// Best-guess meal for FAB-initiated logging based on the time of day.
function mealForNow(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'BREAKFAST'
  if (h < 15) return 'LUNCH'
  if (h < 21) return 'DINNER'
  return 'SNACK'
}

function logNutrition(log: FoodLog) {
  if (log.foodItem) {
    return {
      calories: log.foodItem.calories * log.servingQty,
      protein: log.foodItem.protein * log.servingQty,
      carbs: log.foodItem.carbs * log.servingQty,
      fat: log.foodItem.fat * log.servingQty,
    }
  }
  const n = log.recipe?.nutrition
  return {
    calories: (n?.perServingCalories ?? 0) * log.servingQty,
    protein: (n?.perServingProtein ?? 0) * log.servingQty,
    carbs: (n?.perServingCarbs ?? 0) * log.servingQty,
    fat: (n?.perServingFat ?? 0) * log.servingQty,
  }
}

function EditServingInline({
  log,
  onSave,
  onCancel,
}: {
  log: FoodLog
  onSave: (qty: number) => void
  onCancel: () => void
}) {
  const food = log.foodItem
  const gramUnit = !!food && isGramUnit(food.servingUnit)
  const [mode, setMode] = useState<'servings' | 'grams'>(gramUnit ? 'grams' : 'servings')
  const [val, setVal] = useState(
    gramUnit
      ? String(Math.round(log.servingQty * food!.servingSize))
      : String(log.servingQty)
  )

  const switchMode = (next: 'servings' | 'grams') => {
    if (next === mode || !food) return
    const num = parseFloat(val) || 0
    if (next === 'grams') setVal(String(Math.round(num * food.servingSize)))
    else setVal(String(Math.round((num / food.servingSize) * 100) / 100))
    setMode(next)
  }

  const commit = () => {
    const num = parseFloat(val)
    if (!num || num <= 0) { onCancel(); return }
    const qty = mode === 'grams' && food ? num / food.servingSize : num
    onSave(qty)
  }

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {gramUnit && (
        <div className="flex bg-surfaceHigh rounded-lg p-0.5 text-xs">
          {(['servings', 'grams'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-2 py-0.5 rounded-md capitalize ${mode === m ? 'bg-primary text-white' : 'text-muted'}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      <input
        autoFocus
        className="w-20 bg-surfaceHigh rounded-lg px-2 py-1 text-base text-center outline-none"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        inputMode="decimal"
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      {gramUnit && <span className="text-xs text-muted">{mode === 'grams' ? food!.servingUnit : 'srv'}</span>}
      <button className="text-xs text-primary" onClick={commit}>Save</button>
      <button className="text-xs text-muted" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function SwipeableLogRow({
  log,
  editing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  log: FoodLog
  editing: boolean
  onStartEdit: () => void
  onSaveEdit: (qty: number) => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  const { revealed, offsetX, close, handlers } = useSwipeReveal({ revealWidth: 80 })
  const name = log.foodItem?.name ?? log.recipe?.name ?? '—'
  const { calories } = logNutrition(log)
  const servingLabel = log.foodItem
    ? (isGramUnit(log.foodItem.servingUnit)
        ? `${Math.round(log.servingQty * log.foodItem.servingSize)} ${log.foodItem.servingUnit}`
        : `${log.servingQty} × ${log.foodItem.servingSize}${log.foodItem.servingUnit}`)
    : `${log.servingQty} serving${log.servingQty !== 1 ? 's' : ''}`

  return (
    <div className="relative overflow-hidden" {...handlers}>
      {/* Delete zone revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-danger flex items-center justify-center">
        <button
          onClick={() => { onDelete(); close() }}
          className="text-white text-xs font-semibold px-2 py-1"
        >
          Delete
        </button>
      </div>
      {/* Main row content */}
      <div
        className="relative bg-surface px-4 py-2.5 transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: revealed ? 'transform 0.2s ease' : undefined,
        }}
        onClick={revealed ? close : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            {editing ? (
              <EditServingInline
                log={log}
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
              />
            ) : (
              <button
                className="text-xs text-muted hover:text-primary transition-colors"
                onClick={onStartEdit}
              >
                {servingLabel}
              </button>
            )}
          </div>
          <span className="text-sm shrink-0">{Math.round(calories)} kcal</span>
        </div>
      </div>
    </div>
  )
}

function MealSection({
  meal,
  logs,
  onAdd,
  onDelete,
  onUpdateServing,
}: {
  meal: { key: MealType; label: string; Icon: LucideIcon }
  logs: FoodLog[]
  onAdd: (meal: MealType) => void
  onDelete: (id: string) => void
  onUpdateServing: (id: string, qty: number) => void
}) {
  const mealLogs = logs.filter((l) => l.meal === meal.key)
  const [editingId, setEditingId] = useState<string | null>(null)
  const totalCals = mealLogs.reduce((sum, l) => sum + logNutrition(l).calories, 0)
  const MealIcon = meal.Icon

  return (
    <div className="bg-surface rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MealIcon className="w-4 h-4 text-muted" />
          <span className="font-medium">{meal.label}</span>
        </div>
        <div className="flex items-center gap-3">
          {mealLogs.length > 0 && (
            <span className="text-sm text-muted">{Math.round(totalCals)} kcal</span>
          )}
          <button
            onClick={() => onAdd(meal.key)}
            className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center"
            aria-label={`Add to ${meal.label}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {mealLogs.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {mealLogs.map((log) => (
            <SwipeableLogRow
              key={log.id}
              log={log}
              editing={editingId === log.id}
              onStartEdit={() => setEditingId(log.id)}
              onSaveEdit={(qty) => { onUpdateServing(log.id, qty); setEditingId(null) }}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => onDelete(log.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Food() {
  const { logs, date, setDate, fetchLogs, deleteLog, updateLog } = useFoodStore()
  const user = useAuthStore((s) => s.user)
  const [showAddModal, setShowAddModal] = useState<MealType | null>(null)
  const [addInit, setAddInit] = useState<{ tab?: 'search' | 'recipes' | 'recent' | 'custom'; scanner?: boolean }>({})
  const [showCalendar, setShowCalendar] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const quickAction = useUiStore((s) => s.quickAction)
  const clearQuickAction = useUiStore((s) => s.clearQuickAction)

  useEffect(() => {
    fetchLogs()
  }, [])

  // Consume FAB quick-actions targeting the food log (not recipe creation).
  useEffect(() => {
    if (quickAction !== 'food.search' && quickAction !== 'food.scan' && quickAction !== 'food.quickAdd') return
    if (quickAction === 'food.scan') setAddInit({ scanner: true })
    else if (quickAction === 'food.quickAdd') setAddInit({ tab: 'recent' })
    else setAddInit({}) // food.search
    setShowAddModal(mealForNow())
    clearQuickAction()
  }, [quickAction, clearQuickAction])

  const openAdd = (meal: MealType) => { setAddInit({}); setShowAddModal(meal) }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // Only trigger if horizontal movement dominates and exceeds threshold
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
      if (dx < 0) setDate(addDays(date, 1))
      else setDate(subDays(date, 1))
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  const totals = logs.reduce(
    (acc, l) => {
      const n = logNutrition(l)
      return {
        calories: acc.calories + n.calories,
        protein: acc.protein + n.protein,
        carbs: acc.carbs + n.carbs,
        fat: acc.fat + n.fat,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  const profile = user?.profile
  const calorieGoal = profile?.calorieGoal ?? 2000
  const proteinTarget = profile?.proteinTarget ?? 150
  const carbsTarget = profile?.carbsTarget ?? 200
  const fatTarget = profile?.fatTarget ?? 65

  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header: date nav + calorie/macro summary — swipe left/right to change day */}
      <div
        className="bg-surface border-b border-border shrink-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setDate(subDays(date, 1))}
            className="w-9 h-9 flex items-center justify-center text-muted hover:text-white"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className="flex flex-col items-center gap-0.5 group"
          >
            <div className="flex items-center gap-1.5">
              <p className="font-semibold">{isToday ? 'Today' : format(date, 'EEEE')}</p>
              <Calendar className="w-3.5 h-3.5 text-muted group-active:text-primary" />
            </div>
            <p className="text-xs text-muted">{format(date, 'MMM d, yyyy')}</p>
          </button>
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="w-9 h-9 flex items-center justify-center text-muted hover:text-white"
            aria-label="Next day"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Calorie ring + macros */}
        <div className="flex items-center gap-4 px-4 pb-4">
          <CalorieRing eaten={Math.round(totals.calories)} goal={calorieGoal} size={120} strokeWidth={9} />
          <div className="flex-1 space-y-2.5">
            <MacroBar label="Protein" value={totals.protein} target={proteinTarget} color="#6366f1" />
            <MacroBar label="Carbs" value={totals.carbs} target={carbsTarget} color="#f59e0b" />
            <MacroBar label="Fat" value={totals.fat} target={fatTarget} color="#ec4899" />
          </div>
        </div>

        {/* Remaining calories banner */}
        {(() => {
          const remaining = calorieGoal - Math.round(totals.calories)
          const over = remaining < 0
          return (
            <div className={`text-center text-xs py-1.5 border-t border-border ${over ? 'text-danger' : 'text-muted'}`}>
              {over
                ? `${Math.abs(remaining)} kcal over goal`
                : `${remaining} kcal remaining`}
            </div>
          )
        })()}
      </div>

      {/* Meal sections */}
      <div className="flex-1 overflow-y-auto p-4 pb-nav space-y-3">
        {MEALS.map((meal) => (
          <MealSection
            key={meal.key}
            meal={meal}
            logs={logs}
            onAdd={openAdd}
            onDelete={deleteLog}
            onUpdateServing={updateLog}
          />
        ))}
      </div>

      {/* Add food modal */}
      {showAddModal && (
        <AddFoodModal
          meal={showAddModal}
          initialTab={addInit.tab}
          initialScanner={addInit.scanner}
          onClose={() => setShowAddModal(null)}
        />
      )}

      {/* Calendar date picker */}
      {showCalendar && (
        <CalendarDatePicker
          selectedDate={date}
          onSelect={(d) => setDate(d)}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  )
}
