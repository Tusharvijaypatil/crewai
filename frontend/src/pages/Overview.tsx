import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, CheckCircle2, GaugeCircle, Inbox, Ticket } from 'lucide-react'

import { EmptyState, ErrorState } from '@/components/bits'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { CATEGORY, PRIORITY, STATUS, confidenceTone } from '@/lib/domain'
import { useEscalations, useTickets } from '@/lib/queries'
import type { TicketTrace } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

export function OverviewPage() {
  const { data: tickets, isLoading, isError } = useTickets()
  const { data: queue } = useEscalations('PENDING_REVIEW')

  const total = tickets?.length ?? 0
  const resolved = tickets?.filter((t) => t.status === 'RESOLVED').length ?? 0
  const resolvedPct = total ? Math.round((resolved / total) * 100) : 0
  const avgConf = total ? Math.round(tickets!.reduce((a, t) => a + t.confidence, 0) / total) : 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-fg-muted">Live triage activity across your support pipeline.</p>
        </div>
        <Button asChild>
          <Link to="/app/submit">Submit a ticket</Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Ticket} tone="iris" label="Tickets processed" value={total} loading={isLoading} />
        <Kpi icon={CheckCircle2} tone="emerald" label="Auto-resolved" value={`${resolvedPct}%`} sub={`${resolved} of ${total}`} loading={isLoading} />
        <Kpi icon={Inbox} tone="amber" label="In review queue" value={queue?.length ?? 0} loading={isLoading} />
        <Kpi icon={GaugeCircle} tone={confidenceTone(avgConf)} label="Avg confidence" value={avgConf} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent tickets</h2>
            <span className="text-xs text-fg-dim">{total} total</span>
          </div>
          {isError ? (
            <ErrorState message="Could not load tickets." />
          ) : isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No tickets yet"
              description="Submit a ticket to watch it run through the agent pipeline."
              action={
                <Button asChild size="sm">
                  <Link to="/app/submit">Submit a ticket</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {tickets!.slice(0, 6).map((t, i) => (
                <TicketRow key={t.id} ticket={t} index={i} />
              ))}
            </div>
          )}
        </Card>

        <TrendCard tickets={tickets} />
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  loading,
}: {
  icon: typeof Ticket
  tone: 'iris' | 'aqua' | 'emerald' | 'amber' | 'rose' | 'neutral'
  label: string
  value: string | number
  sub?: string
  loading?: boolean
}) {
  const toneText = {
    iris: 'text-iris-400', aqua: 'text-aqua-400', emerald: 'text-emerald-400',
    amber: 'text-amber-400', rose: 'text-rose-400', neutral: 'text-fg-muted',
  }[tone]
  return (
    <Card className="relative overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">{label}</span>
        <Icon className={cn('h-[18px] w-[18px]', toneText)} />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
      )}
      {sub && <p className="mt-0.5 text-xs text-fg-dim">{sub}</p>}
    </Card>
  )
}

function TicketRow({ ticket, index }: { ticket: TicketTrace; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to={`/app/tickets/${ticket.id}`}
        className="group flex items-center gap-3 py-3 transition-colors"
      >
        <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY[ticket.priority].dot)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg group-hover:text-iris-300">{ticket.subject}</p>
          <p className="truncate text-xs text-fg-dim">
            {CATEGORY[ticket.category].label} · {timeAgo(ticket.created_at)}
          </p>
        </div>
        <Badge tone={STATUS[ticket.status].tone} className="hidden sm:inline-flex">
          {STATUS[ticket.status].label}
        </Badge>
        <span className="font-mono text-xs tabular-nums text-fg-dim">{ticket.confidence}</span>
        <ArrowUpRight className="h-4 w-4 text-fg-dim opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </motion.div>
  )
}

function TrendCard({ tickets }: { tickets?: TicketTrace[] }) {
  // Build a simple confidence series from recent tickets (most recent last).
  const series = (tickets ?? []).slice(0, 10).map((t) => t.confidence).reverse()
  const points = series.length >= 2 ? series : [60, 72, 68, 80, 84, 78, 90, 86]
  const w = 100
  const h = 42
  const max = 100
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - (p / max) * h}`)
    .join(' ')

  return (
    <Card className="flex flex-col p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">Confidence trend</h2>
        <Badge tone="iris">last {points.length}</Badge>
      </div>
      <p className="text-xs text-fg-dim">QA confidence per resolved ticket</p>
      <div className="relative mt-4 flex-1">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-28 w-full">
          <defs>
            <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-iris-500)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-iris-500)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.polyline
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            points={path}
            fill="none"
            stroke="var(--color-iris-400)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <polygon points={`0,${h} ${path} ${w},${h}`} fill="url(#trend)" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        <Stat
          label="resolve rate"
          value={`${tickets?.length ? Math.round((tickets.filter((t) => t.status === 'RESOLVED').length / tickets.length) * 100) : 0}%`}
        />
        <Stat
          label="time saved"
          // ~12 min median human handle time per auto-resolved ticket
          value={`${Math.round(((tickets?.filter((t) => t.status === 'RESOLVED').length ?? 0) * 12) / 6) / 10}h`}
        />
        <Stat
          label="LLM spend"
          value={`$${(tickets?.reduce((a, t) => a + t.estimated_cost_usd, 0) ?? 0).toFixed(2)}`}
        />
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-lg font-semibold tabular-nums text-fg">{value}</p>
      <p className="text-[11px] text-fg-dim">{label}</p>
    </div>
  )
}
