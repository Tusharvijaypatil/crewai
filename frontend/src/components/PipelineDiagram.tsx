import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Brain, FileSearch, PenLine, ShieldCheck, GitBranch, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface Stage {
  key: string
  label: string
  sub: string
  icon: LucideIcon
  tone: string // text color class
  glow: string // shadow color
}

export const STAGES: Stage[] = [
  { key: 'classify', label: 'Classify', sub: 'category · priority · sentiment', icon: Brain, tone: 'text-iris-400', glow: 'var(--color-iris-500)' },
  { key: 'retrieve', label: 'Retrieve', sub: 'RAG over the knowledge base', icon: FileSearch, tone: 'text-aqua-400', glow: 'var(--color-aqua-500)' },
  { key: 'draft', label: 'Draft', sub: 'grounded reply + citations', icon: PenLine, tone: 'text-iris-400', glow: 'var(--color-iris-500)' },
  { key: 'qa', label: 'QA guardrail', sub: 'hallucination + tone check', icon: ShieldCheck, tone: 'text-emerald-400', glow: 'var(--color-emerald-500)' },
  { key: 'route', label: 'Route', sub: 'deterministic — not an LLM', icon: GitBranch, tone: 'text-amber-400', glow: 'var(--color-amber-500)' },
]

/** The signature visual: a 5-stage agent pipeline that animates into view. */
export function PipelineDiagram({ className }: { className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <div ref={ref} className={cn('w-full', className)}>
      {/* desktop: horizontal flow */}
      <div className="hidden items-stretch gap-2 md:flex">
        {STAGES.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <StageCard stage={s} index={i} active={inView} />
            {i < STAGES.length - 1 && <Connector index={i} active={inView} />}
          </div>
        ))}
      </div>
      {/* mobile: vertical flow */}
      <div className="space-y-2 md:hidden">
        {STAGES.map((s, i) => (
          <StageCard key={s.key} stage={s} index={i} active={inView} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: STAGES.length * 0.14 + 0.2 }}
        className="mt-4 flex flex-wrap items-center justify-center gap-3 text-center md:justify-between"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Auto-resolved · high confidence
        </span>
        <span className="text-xs text-fg-dim">routing decision is plain Python, never an LLM</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Escalated · human review
        </span>
      </motion.div>
    </div>
  )
}

function StageCard({ stage, index, active }: { stage: Stage; index: number; active: boolean }) {
  const Icon = stage.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={active ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ delay: index * 0.14, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="surface-card group relative flex-1 overflow-hidden p-4"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: stage.glow }}
      />
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] border border-line bg-ink-900">
          <Icon className={cn('h-[18px] w-[18px]', stage.tone)} />
        </span>
        <span className="font-mono text-[11px] text-fg-dim">0{index + 1}</span>
      </div>
      <p className="font-display text-[15px] font-semibold text-fg">{stage.label}</p>
      <p className="mt-0.5 text-xs leading-snug text-fg-muted">{stage.sub}</p>
    </motion.div>
  )
}

function Connector({ index, active }: { index: number; active: boolean }) {
  return (
    <div className="relative hidden h-px w-6 shrink-0 overflow-visible md:block">
      <div className="absolute inset-0 top-1/2 h-px bg-line" />
      <motion.div
        className="absolute top-1/2 h-px bg-iris-aqua"
        initial={{ width: 0 }}
        animate={active ? { width: '100%' } : {}}
        transition={{ delay: index * 0.14 + 0.25, duration: 0.4 }}
      />
      <motion.span
        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-aqua-400"
        initial={{ left: 0, opacity: 0 }}
        animate={active ? { left: ['0%', '100%'], opacity: [0, 1, 0] } : {}}
        transition={{ delay: index * 0.14 + 0.3, duration: 0.7, ease: 'easeInOut' }}
        style={{ boxShadow: '0 0 8px var(--color-aqua-500)' }}
      />
    </div>
  )
}
