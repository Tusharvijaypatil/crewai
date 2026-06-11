import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Inbox,
  LayoutDashboard,
  Menu,
  PlusCircle,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Logo } from '@/components/brand'
import { USE_MOCKS } from '@/lib/api'
import { useEscalations, useHealth } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Badge } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

function useNav(): NavItem[] {
  const { data: queue } = useEscalations('PENDING_REVIEW')
  const pending = queue?.length ?? 0
  return [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/app/submit', label: 'Submit ticket', icon: PlusCircle },
    { to: '/app/queue', label: 'Review queue', icon: Inbox, badge: pending },
    { to: '/app/health', label: 'Health & KB', icon: Activity },
  ]
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  const { data: health } = useHealth()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <NavLink to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </NavLink>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'text-fg' : 'text-fg-muted hover:text-fg hover:bg-ink-800',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-[var(--radius-md)] border border-line bg-ink-800"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <Badge tone="amber" className="px-1.5 py-0 text-[11px]">
                    {item.badge}
                  </Badge>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-fg-dim">Pipeline</span>
          <span className="flex items-center gap-1.5 text-fg-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {health?.status === 'ok' ? 'Operational' : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-fg-dim">Mode</span>
          <Badge tone={USE_MOCKS ? 'iris' : 'emerald'} className="py-0 text-[11px]">
            {USE_MOCKS ? 'Demo · mock' : 'Live · API'}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-ink-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-ink-850/60 backdrop-blur-xl lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink-900/80 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] border border-line text-fg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink-950/70 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-line bg-ink-850 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            >
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-md text-fg-muted"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
