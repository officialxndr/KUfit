import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/stores/uiStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import { SECTION_ACTIONS, type SectionKey } from '@/lib/navConfig'

// Bottom-sheet of the active section's quick actions, opened by the center FAB.
// Each action either navigates + arms a `quickAction` for the target sub-page to
// consume, or performs the action directly (e.g. starting an empty workout).
export function QuickActionSheet({ section, onClose }: { section: SectionKey; onClose: () => void }) {
  const navigate = useNavigate()
  const setQuickAction = useUiStore((s) => s.setQuickAction)
  const startSession = useWorkoutStore((s) => s.startSession)
  const actions = SECTION_ACTIONS[section]

  const run = async (id: string) => {
    onClose()
    switch (id) {
      case 'food.search':
        navigate('/food/today'); setQuickAction('food.search'); break
      case 'food.scan':
        navigate('/food/today'); setQuickAction('food.scan'); break
      case 'food.quickAdd':
        navigate('/food/today'); setQuickAction('food.quickAdd'); break
      case 'food.recipe.new':
        navigate('/food/recipes'); setQuickAction('food.recipe.new'); break
      case 'workout.empty':
        navigate('/workout/templates'); await startSession('Quick Workout'); break
      case 'workout.template':
        navigate('/workout/templates'); break
      case 'health.weight':
        navigate('/health/weight'); setQuickAction('health.weight'); break
      case 'health.measurement':
        navigate('/health/measurements'); setQuickAction('health.measurement'); break
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full bg-surface rounded-t-3xl p-4 pb-6 safe-bottom space-y-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-surfaceHigh" />
        {actions.map((a) => {
          const Icon = a.Icon
          return (
            <button
              key={a.id}
              onClick={() => run(a.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-surfaceHigh active:bg-primary/15 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <span className="font-medium">{a.label}</span>
            </button>
          )
        })}
        <button onClick={onClose} className="w-full text-muted text-sm py-3">
          Cancel
        </button>
      </div>
    </div>
  )
}
