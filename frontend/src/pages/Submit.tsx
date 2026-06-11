import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { STAGES } from '@/components/PipelineDiagram'
import { Badge, Button, Card, Input, Label, Select, Textarea } from '@/components/ui'
import { STATUS } from '@/lib/domain'
import { useSubmitTicket } from '@/lib/queries'
import type { TicketTrace } from '@/lib/types'
import { cn } from '@/lib/utils'

const SAMPLES = [
  { label: 'Answerable', subject: 'Getting 429 errors from the API', body: 'We intermittently get HTTP 429s. What are the rate limits and which headers show remaining quota?' },
  { label: 'P1 outage', subject: 'URGENT: production is down', body: 'Every workflow is failing in production right now and customers are affected. Enterprise SLA.' },
  { label: 'Sensitive', subject: 'Delete all my data', body: 'Under GDPR Article 17 please erase all my personal data and delete my account.' },
]

export function SubmitPage() {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState('email')
  const [tier, setTier] = useState('pro')
  const [result, setResult] = useState<TicketTrace | null>(null)
  const submit = useSubmitTicket()
  const navigate = useNavigate()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setResult(null)
    submit.mutate(
      { subject, body, channel, customer_tier: tier },
      {
        onSuccess: (t) => {
          setResult(t)
          toast.success(t.status === 'RESOLVED' ? 'Ticket auto-resolved' : 'Ticket escalated to review')
        },
        onError: (err) => toast.error('Pipeline failed', { description: String(err) }),
      },
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Submit a ticket</h1>
        <p className="mt-1 text-sm text-fg-muted">Runs the full pipeline and shows the live result.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => { setSubject(s.subject); setBody(s.body) }}
                  className="rounded-full border border-line bg-ink-850 px-3 py-1 text-xs text-fg-muted transition-colors hover:border-iris-500/50 hover:text-fg"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Getting 429 errors from the API" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the issue…" className="min-h-32" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="channel">Channel</Label>
                <Select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="chat">Chat</option>
                  <option value="phone">Phone</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier">Customer tier</Label>
                <Select id="tier" value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running pipeline…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Run triage</>
              )}
            </Button>
          </form>
        </Card>

        <div className="min-h-[20rem]">
          <AnimatePresence mode="wait">
            {submit.isPending ? (
              <RunningState key="running" />
            ) : result ? (
              <ResultState key="result" ticket={result} onView={() => navigate(`/app/tickets/${result.id}`)} />
            ) : (
              <IdleState key="idle" />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function IdleState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card className="grid h-full place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line bg-ink-900 text-iris-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mt-4 font-medium">The result appears here</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-fg-muted">
            Submit a ticket to watch it flow through classify → retrieve → draft → QA → route.
          </p>
        </div>
      </Card>
    </motion.div>
  )
}

function RunningState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Card className="space-y-3 p-6">
        <p className="text-sm font-medium text-fg-muted">Running the agent pipeline…</p>
        {STAGES.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0.3, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.18 }}
            className="flex items-center gap-3"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-ink-900">
              <s.icon className={cn('h-4 w-4', s.tone)} />
            </span>
            <span className="text-sm text-fg">{s.label}</span>
            <motion.span
              className="ml-auto h-1.5 w-1.5 rounded-full bg-iris-aqua"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
            />
          </motion.div>
        ))}
      </Card>
    </motion.div>
  )
}

function ResultState({ ticket, onView }: { ticket: TicketTrace; onView: () => void }) {
  const resolved = ticket.status === 'RESOLVED'
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <Card className={cn('p-6', resolved ? 'ring-1 ring-emerald-500/20' : 'ring-1 ring-amber-500/20')}>
        <div className="flex items-center justify-between">
          <Badge tone={STATUS[ticket.status].tone}>{STATUS[ticket.status].label}</Badge>
          <span className="font-mono text-xs text-fg-dim">#{ticket.id}</span>
        </div>
        <p className="mt-4 text-xs text-fg-dim">Drafted reply</p>
        {resolved ? (
          <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-fg">{ticket.reply}</p>
        ) : (
          <p className="mt-1 text-sm text-fg-muted">
            Held for a human. {ticket.escalation_reasons.length} reason
            {ticket.escalation_reasons.length === 1 ? '' : 's'} flagged by the router.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <div className="text-xs text-fg-dim">
            confidence <span className="font-mono text-fg">{ticket.confidence}</span>
          </div>
          <Button onClick={onView} size="sm" variant="secondary">
            View full trace <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-fg-dim">
        or <Link to="/app/queue" className="text-iris-400 hover:underline">open the review queue</Link>
      </p>
    </motion.div>
  )
}
