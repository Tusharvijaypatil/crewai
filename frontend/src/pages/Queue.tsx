import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Inbox, PencilLine, X } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, ErrorState } from '@/components/bits'
import { Badge, Button, Card, Label, Skeleton, Textarea } from '@/components/ui'
import { CATEGORY, PRIORITY, humanizeReason } from '@/lib/domain'
import { useEscalationAction, useEscalations } from '@/lib/queries'
import type { Escalation } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

export function QueuePage() {
  const { data, isLoading, isError } = useEscalations()
  const pending = data?.filter((e) => e.status === 'PENDING_REVIEW') ?? []
  const resolved = data?.filter((e) => e.status !== 'PENDING_REVIEW') ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Review queue</h1>
          <p className="mt-1 text-sm text-fg-muted">Human-in-the-loop. Approve, edit, or reject held replies.</p>
        </div>
        {pending.length > 0 && <Badge tone="amber">{pending.length} awaiting review</Badge>}
      </header>

      {isError ? (
        <ErrorState message="Could not load the review queue." />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : pending.length === 0 && resolved.length === 0 ? (
        <EmptyState icon={Inbox} title="Queue is clear" description="No tickets are waiting for review. Anything the router can't auto-resolve will land here." />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {pending.map((esc) => (
                <EscalationCard key={esc.id} esc={esc} />
              ))}
            </AnimatePresence>
            {pending.length === 0 && (
              <EmptyState icon={Check} title="All caught up" description="Every escalation has been handled." />
            )}
          </div>

          {resolved.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-fg-dim">Recently handled</h2>
              <div className="space-y-2">
                {resolved.map((esc) => (
                  <div key={esc.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-ink-850/40 px-4 py-3">
                    <ActionTag status={esc.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">{esc.ticket_subject}</span>
                    <span className="text-xs text-fg-dim">{timeAgo(esc.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EscalationCard({ esc }: { esc: Escalation }) {
  const action = useEscalationAction()
  const [editOpen, setEditOpen] = useState(false)

  const run = (a: 'approve' | 'reject', label: string) =>
    action.mutate(
      { id: esc.id, action: a },
      { onSuccess: () => toast.success(label), onError: () => toast.error('Action failed') },
    )

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              {esc.ticket_priority && <Badge tone={PRIORITY[esc.ticket_priority].tone}>{esc.ticket_priority}</Badge>}
              {esc.ticket_category && <Badge tone={CATEGORY[esc.ticket_category].tone}>{CATEGORY[esc.ticket_category].label}</Badge>}
            </div>
            <Link to={`/app/tickets/${esc.ticket_id}`} className="font-medium text-fg hover:text-iris-300">
              {esc.ticket_subject}
            </Link>
          </div>
          <span className="font-mono text-xs text-fg-dim">#{esc.ticket_id}</span>
        </div>

        <div className="mt-3 rounded-[var(--radius-md)] border border-amber-500/20 bg-amber-500/[0.05] p-3">
          <p className="text-xs font-medium text-amber-400">Why it was held</p>
          <ul className="mt-1.5 space-y-1">
            {esc.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-fg-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {humanizeReason(r)}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="success" disabled={action.isPending} onClick={() => run('approve', 'Approved — ticket resolved')}>
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="secondary" disabled={action.isPending} onClick={() => setEditOpen(true)}>
            <PencilLine className="h-4 w-4" /> Edit & send
          </Button>
          <Button size="sm" variant="danger" disabled={action.isPending} onClick={() => run('reject', 'Rejected — kept in review')}>
            <X className="h-4 w-4" /> Reject
          </Button>
          {esc.ticket_confidence != null && (
            <span className="ml-auto text-xs text-fg-dim">
              confidence <span className="font-mono text-fg">{esc.ticket_confidence}</span>
            </span>
          )}
        </div>
      </Card>

      <EditDialog esc={esc} open={editOpen} onOpenChange={setEditOpen} />
    </motion.div>
  )
}

function EditDialog({ esc, open, onOpenChange }: { esc: Escalation; open: boolean; onOpenChange: (v: boolean) => void }) {
  const action = useEscalationAction()
  const [reply, setReply] = useState(
    `Hi — thanks for reaching out about "${esc.ticket_subject}". `,
  )

  const save = () => {
    if (!reply.trim()) return
    action.mutate(
      { id: esc.id, action: 'edit', body: { final_reply: reply } },
      {
        onSuccess: () => {
          toast.success('Edited reply sent — ticket resolved')
          onOpenChange(false)
        },
        onError: () => toast.error('Could not save'),
      },
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
            'surface-card p-6 focus:outline-none',
          )}
        >
          <Dialog.Title className="font-display text-lg font-semibold">Edit the reply</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-fg-muted">
            Write the response a human will send. Sending resolves the ticket.
          </Dialog.Description>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="final">Reply to customer</Label>
            <Textarea id="final" value={reply} onChange={(e) => setReply(e.target.value)} className="min-h-40" autoFocus />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </Dialog.Close>
            <Button size="sm" onClick={save} disabled={action.isPending || !reply.trim()}>
              <Check className="h-4 w-4" /> Send & resolve
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ActionTag({ status }: { status: string }) {
  const map: Record<string, { tone: 'emerald' | 'rose' | 'iris'; label: string }> = {
    APPROVED: { tone: 'emerald', label: 'Approved' },
    EDITED: { tone: 'iris', label: 'Edited' },
    REJECTED: { tone: 'rose', label: 'Rejected' },
  }
  const m = map[status] ?? { tone: 'iris' as const, label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}
