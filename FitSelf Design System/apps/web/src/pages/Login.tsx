import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function Login() {
  const navigate = useNavigate()
  const { setUser, setAccessToken } = useAuthStore()
  const { setUnitSystem } = useSettingsStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setUser(data.user)
      setAccessToken(data.accessToken)
      if (data.user.profile?.unitSystem) setUnitSystem(data.user.profile.unitSystem)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">FitSelf</h1>
          <p className="text-muted text-sm mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
          />
          {error && <p className="text-danger text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-3 rounded-xl disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-medium">Register</Link>
        </p>
      </div>
    </div>
  )
}
