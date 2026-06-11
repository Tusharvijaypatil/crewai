import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { confidenceTone, type Tone } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { toneBar, toneText } from './ui'

/** Horizontal confidence meter with semantic color + numeric label. */
export function ConfidenceMeter({
  value,
  label = 'Confidence',
  tone,
  className,
}: {
  value: number
  label?: string
  tone?: Tone
  className?: string
}) {
  const t = tone ?? confidenceTone(value)
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className={cn('font-mono font-semibold tabular-nums', toneText[t])}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <motion.div
          className={cn('h-full rounded-full', toneBar[t])}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

/** Circular score ring (used in KPI / QA header). */
export function ScoreRing({ value, size = 64, tone }: { value: number; size?: number; tone?: Tone }) {
  const t = tone ?? confidenceTone(value)
  const stroke = 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const colorVar: Record<Tone, string> = {
    iris: 'var(--color-iris-500)',
    aqua: 'var(--color-aqua-500)',
    emerald: 'var(--color-emerald-500)',
    amber: 'var(--color-amber-500)',
    rose: 'var(--color-rose-500)',
    neutral: 'var(--color-fg-dim)',
  }
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-700)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colorVar[t]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (value / 100) * c }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className={cn('absolute font-mono text-sm font-semibold tabular-nums', toneText[t])}>{value}</span>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-line px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-line bg-ink-800 text-fg-dim">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message }: { title?: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-rose-500/30 bg-rose-500/5 px-6 py-12 text-center">
      <p className="font-medium text-rose-400">{title}</p>
      {message && <p className="max-w-sm text-sm text-fg-muted">{message}</p>}
    </div>
  )
}
