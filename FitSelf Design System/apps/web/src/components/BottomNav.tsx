import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { Plus } from '@/components/icons'
import {
  SECTION_TABS, SECTION_ACTIONS, LAUNCHER_TABS, sectionForPath, type TabDef,
} from '@/lib/navConfig'
import { QuickActionSheet } from '@/components/QuickActionSheet'

function NavItem({ tab }: { tab: TabDef }) {
  const Icon = tab.Icon
  return (
    <NavLink
      to={tab.to}
      end={tab.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors min-w-0',
          isActive ? 'text-primary' : 'text-muted'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="w-6 h-6" strokeWidth={isActive ? 2.4 : 2} />
          <span className="truncate max-w-full px-0.5">{tab.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function BottomNav() {
  const location = useLocation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const section = sectionForPath(location.pathname)

  const sectionTabs = SECTION_TABS[section]
  const hasFab = SECTION_ACTIONS[section].length > 0
  // Sections with their own sub-pages show those; Dashboard/Settings show the
  // section launcher instead.
  const items = sectionTabs.length > 0 ? sectionTabs : LAUNCHER_TABS

  // Split the items into two equal halves so the centered FAB sits in the gap.
  const splitAt = Math.ceil(items.length / 2)
  const left = items.slice(0, splitAt)
  const right = items.slice(splitAt)

  return (
    <>
      <nav className="relative flex-shrink-0 bg-surface border-t border-border safe-bottom">
        {hasFab ? (
          <div className="flex items-stretch">
            <div className="flex-1 flex">
              {left.map((t) => <NavItem key={t.to} tab={t} />)}
            </div>
            <div className="w-16 shrink-0" aria-hidden />
            <div className="flex-1 flex">
              {right.map((t) => <NavItem key={t.to} tab={t} />)}
            </div>
          </div>
        ) : (
          <div className="flex items-stretch">
            {items.map((t) => <NavItem key={t.to} tab={t} />)}
          </div>
        )}

        {hasFab && (
          <button
            onClick={() => setSheetOpen(true)}
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform ring-4 ring-background"
            aria-label="Quick actions"
          >
            <Plus className="w-7 h-7" strokeWidth={2.5} />
          </button>
        )}
      </nav>

      {sheetOpen && (
        <QuickActionSheet section={section} onClose={() => setSheetOpen(false)} />
      )}
    </>
  )
}
