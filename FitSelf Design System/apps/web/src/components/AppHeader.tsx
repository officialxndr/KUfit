import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ChevronDown, UserCircle } from '@/components/icons'
import { SECTIONS, sectionForPath } from '@/lib/navConfig'
import { useAuthStore } from '@/stores/authStore'

// Self-contained detail pages keep their own headers with back buttons, so the
// global header hides there.
const HIDE_PREFIXES = ['/tdee', '/exercises', '/apple-health']

export function AppHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const path = location.pathname

  const hidden = HIDE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
  if (hidden) return null

  const activeKey = sectionForPath(path)
  const section = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0]
  const SectionIcon = section.Icon

  return (
    <header className="bg-surface border-b border-border safe-top shrink-0 relative z-30">
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 font-bold text-lg active:opacity-70"
          aria-label="Switch section"
        >
          <SectionIcon className="w-5 h-5 text-primary" />
          {section.label}
          <ChevronDown className={clsx('w-4 h-4 text-muted transition-transform', open && 'rotate-180')} />
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="text-muted active:text-primary"
          aria-label="Profile and settings"
        >
          {user?.profile?.avatarUrl
            ? <img src={user.profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            : <UserCircle className="w-7 h-7" />
          }
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-4 top-full mt-1 z-40 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden min-w-[13rem]">
            {SECTIONS.map((s) => {
              const Icon = s.Icon
              const active = s.key === activeKey
              return (
                <button
                  key={s.key}
                  onClick={() => { setOpen(false); navigate(s.basePath) }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-surfaceHigh'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {s.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </header>
  )
}
