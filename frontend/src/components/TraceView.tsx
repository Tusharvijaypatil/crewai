import { motion } from 'framer-motion'
import {
  Brain,
  CheckCircle2,
  FileSearch,
  GitBranch,
  PenLine,
  Quote,
  ShieldCheck,
  ShieldX,
  XCircle,
} from 'lucide-react'

import { CATEGORY, PRIORITY, SENTIMENT, confidenceTone, humanizeReason } from '@/lib/domain'
import type { TicketTrace } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ConfidenceMeter, ScoreRing } from './bits'
import { Badge } from './ui'

const stagger = { animate: { transition: { staggerChildren: 0.12 } } }
const stepIn = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
}

function Step({
  icon: Icon,
  index,
  title,
  tone,
  children,
  last,
}: {
  icon: typeof Brain
  index: number
  title: string
  tone: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <motion.div variants={stepIn} className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span className={cn('relative z-10 grid h-10 w-10 place-items-center rounded-full border border-line bg-ink-850', tone)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {!last && <span className="w-px flex-1 bg-gradient-to-b from-line to-transparent" />}
      </div>
      <div className="flex-1 pb-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[11px] text-fg-dim">0{index}</span>
          <h3 className="font-display text-[15px] font-semibold text-fg">{title}</h3>
        </div>
        {children}
      </div>
    </motion.div>
  )
}

export function TraceView({ ticket }: { ticket: TicketTrace }) {
  const { classification: c, retrieval: r, draft: d, qa, decision } = ticket.trace
  const resolved = decision.status === 'RESOLVED'

  return (
    <motion.div variants={stagger} initial="initial" animate="animate">
      {/* 01 Classify */}
      <Step icon={Brain} index={1} title="Classify" tone="text-iris-400" >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CATEGORY[c.category].tone}>{CATEGORY[c.category].label}</Badge>
          <Badge tone={PRIORITY[c.priority].tone}>{PRIORITY[c.priority].label}</Badge>
          <Badge tone={SENTIMENT[c.sentiment].tone}>{SENTIMENT[c.sentiment].label}</Badge>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-fg-muted">{c.rationale}</p>
      </Step>

      {/* 02 Retrieve */}
      <Step icon={FileSearch} index={2} title="Retrieve · RAG" tone="text-aqua-400">
        <div className="surface-card p-4">
          <ConfidenceMeter value={r.retrieval_confidence} label="Retrieval confidence" />
          <div className="mt-3 space-y-2">
            {r.snippets.length === 0 && (
              <p className="text-sm text-fg-dim">No relevant knowledge-base context was retrieved.</p>
            )}
            {r.snippets.map((s, i) => (
              <div key={i} className="rounded-[var(--radius-md)] border border-line bg-ink-900/50 p-3">
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-aqua-400">
                  <Quote className="h-3 w-3" /> {r.sources[i] ?? 'unknown'}
                </p>
                <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-fg-muted">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </Step>

      {/* 03 Draft */}
      <Step icon={PenLine} index={3} title="Draft" tone="text-iris-400">
        <div className="surface-card p-4">
          {d.can_answer ? (
            <>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg">{d.reply}</p>
              {d.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                  <span className="text-xs text-fg-dim">Cited</span>
                  {d.citations.map((cite) => (
                    <span key={cite} className="rounded-md border border-line bg-ink-900 px-1.5 py-0.5 font-mono text-[11px] text-iris-400">
                      {cite}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-400">
                <ShieldX className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-amber-400">Drafter declined to answer</p>
                <p className="mt-0.5 text-sm text-fg-muted">{d.escalation_reason}</p>
              </div>
            </div>
          )}
        </div>
      </Step>

      {/* 04 QA */}
      <Step icon={qa.passed ? ShieldCheck : ShieldX} index={4} title="QA guardrail" tone={qa.passed ? 'text-emerald-400' : 'text-rose-400'}>
        <div className="surface-card flex items-center gap-5 p-4">
          <ScoreRing value={qa.confidence} tone={confidenceTone(qa.confidence)} />
          <div className="flex-1 space-y-1.5">
            <Check label="Grounded in sources" ok={qa.grounded} />
            <Check label="Tone appropriate" ok={qa.tone_ok} />
            <Check label="Complete answer" ok={qa.completeness_ok} />
            {qa.issues.length > 0 && (
              <p className="pt-1 text-xs text-rose-400">{qa.issues.join(' · ')}</p>
            )}
          </div>
          <Badge tone={qa.passed ? 'emerald' : 'rose'}>{qa.passed ? 'PASS' : 'FAIL'}</Badge>
        </div>
      </Step>

      {/* 05 Route */}
      <Step icon={GitBranch} index={5} title="Route · deterministic" tone={resolved ? 'text-emerald-400' : 'text-amber-400'} last>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, type: 'spring', stiffness: 220, damping: 18 }}
          className={cn(
            'rounded-[var(--radius-lg)] border p-4',
            resolved ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-amber-500/30 bg-amber-500/[0.06]',
          )}
        >
          <div className="flex items-center gap-2">
            {resolved ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldX className="h-5 w-5 text-amber-400" />
            )}
            <span className={cn('font-display text-lg font-semibold', resolved ? 'text-emerald-400' : 'text-amber-400')}>
              {resolved ? 'Auto-resolved' : 'Escalated to human review'}
            </span>
          </div>
          {decision.reasons.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {decision.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2 text-sm text-fg-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  {humanizeReason(reason)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">
              Confident, grounded, and not P1 — the drafted reply was sent automatically.
            </p>
          )}
        </motion.div>
      </Step>
    </motion.div>
  )
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <XCircle className="h-4 w-4 text-rose-400" />
      )}
      <span className={ok ? 'text-fg-muted' : 'text-rose-400'}>{label}</span>
    </div>
  )
}
