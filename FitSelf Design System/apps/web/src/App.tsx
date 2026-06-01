import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { api } from '@/lib/api'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Food } from '@/pages/Food'
import { FoodRecipes } from '@/pages/FoodRecipes'
import { FoodTrends } from '@/pages/FoodTrends'
import { FoodGoals } from '@/pages/FoodGoals'
import { Workout } from '@/pages/Workout'
import { WorkoutStats } from '@/pages/WorkoutStats'
import { Health } from '@/pages/Health'
import { Measurements } from '@/pages/Measurements'
import { Settings } from '@/pages/Settings'
import { TDEECalculator } from '@/pages/TDEECalculator'
import { ExerciseDetail } from '@/pages/ExerciseDetail'
import { AppleHealth } from '@/pages/AppleHealth'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  // Show onboarding wizard until the user has set their height (profile complete)
  if (!user.profile?.heightCm) return <OnboardingWizard />
  return <>{children}</>
}

function AppInit() {
  const { user, setUser } = useAuthStore()
  const { setUnitSystem, setCountActiveCalories, theme } = useSettingsStore()

  useEffect(() => {
    if (!user) return
    // Refresh user data and sync unit preference on mount
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data)
        if (data.profile?.unitSystem) setUnitSystem(data.profile.unitSystem)
        if (data.profile?.countActiveCalories !== undefined) setCountActiveCalories(data.profile.countActiveCalories)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const html = document.documentElement
    if (theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [theme])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInit />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="food" element={<Navigate to="/food/today" replace />} />
          <Route path="food/today" element={<Food />} />
          <Route path="food/recipes" element={<FoodRecipes />} />
          <Route path="food/trends" element={<FoodTrends />} />
          <Route path="food/goals" element={<FoodGoals />} />
          <Route path="workout" element={<Navigate to="/workout/templates" replace />} />
          <Route path="workout/templates" element={<Workout />} />
          <Route path="workout/history" element={<Workout />} />
          <Route path="workout/exercises" element={<Workout />} />
          <Route path="workout/stats" element={<WorkoutStats />} />
          <Route path="health" element={<Navigate to="/health/weight" replace />} />
          <Route path="health/weight" element={<Health />} />
          <Route path="health/goals" element={<Health />} />
          <Route path="health/composition" element={<Health />} />
          <Route path="health/measurements" element={<Measurements />} />
          <Route path="settings" element={<Settings />} />
          <Route path="tdee" element={<TDEECalculator />} />
          <Route path="exercises/:id" element={<ExerciseDetail />} />
          <Route path="apple-health" element={<AppleHealth />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
