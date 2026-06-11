import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Hash, Mail, Tag } from 'lucide-react'

import { EmptyState, ErrorState } from '@/components/bits'
import { TraceView } from '@/components/TraceView'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { CATEGORY, PRIORITY, SENTIMENT, STATUS } from '@/lib/domain'
import { useTicket } from '@/lib/queries'
import { timeAgo, titleCase } from '@/lib/utils'

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ticket, isLoading, isError, error } = useTicket(id)

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app">
          <ArrowLeft className="h-4 w-4" /> Back to overview
        </Link>
      </Button>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={Hash}
          title="Ticket not found"
          description={String((error as Error)?.message ?? 'This ticket does not exist.')}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link to="/app">Back to overview</Link>
            </Button>
          }
        />
      ) : ticket ? (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[ticket.status].tone}>{STATUS[ticket.status].label}</Badge>
                  <Badge tone={CATEGORY[ticket.category].tone}>{CATEGORY[ticket.category].label}</Badge>
                  <Badge tone={PRIORITY[ticket.priority].tone}>{PRIORITY[ticket.priority].label}</Badge>
                  <Badge tone={SENTIMENT[ticket.sentiment].tone}>{SENTIMENT[ticket.sentiment].label}</Badge>
                </div>
                <h1 className="text-xl font-semibold">{ticket.subject}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{ticket.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fg-dim">
                  <span className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> {ticket.id}</span>
                  {ticket.channel && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {titleCase(ticket.channel)}</span>}
                  {ticket.customer_tier && <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> {titleCase(ticket.customer_tier)}</span>}
                  <span>{timeAgo(ticket.created_at)}</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <Card className="p-6">
              <h2 className="mb-6 font-semibold">Agent trace</h2>
              <TraceView ticket={ticket} />
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-fg-muted">Run summary</h3>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <Row k="Status" v={<span className={STATUS[ticket.status].tone === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}>{ticket.status}</span>} />
                  <Row k="QA confidence" v={<span className="font-mono">{ticket.confidence}</span>} />
                  <Row k="Retrieval conf." v={<span className="font-mono">{ticket.trace.retrieval.retrieval_confidence}</span>} />
                  <Row k="Citations" v={<span className="font-mono">{ticket.citations.length}</span>} />
                  <Row k="Est. cost" v={<span className="font-mono">${ticket.estimated_cost_usd.toFixed(5)}</span>} />
                </dl>
              </Card>

              {ticket.status === 'PENDING_REVIEW' && (
                <Card className="border-amber-500/30 p-5">
                  <h3 className="text-sm font-semibold text-amber-400">Awaiting human review</h3>
                  <p className="mt-1.5 text-sm text-fg-muted">
                    This ticket was held by the router. Resolve it from the review queue.
                  </p>
                  <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                    <Link to="/app/queue">Open review queue</Link>
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </>
      ) : (
        <ErrorState />
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-dim">{k}</dt>
      <dd className="font-medium text-fg">{v}</dd>
    </div>
  )
}
