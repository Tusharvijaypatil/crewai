import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'

import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/domain'

/* ─── Button ─────────────────────────────────────────────────────────────── */
const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium transition-all duration-200 ease-[var(--ease-out-expo)] focus-visible:outline-2 focus-visible:outline-iris-500 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-iris-aqua text-ink-950 font-semibold shadow-[0_8px_30px_-10px_var(--color-iris-600)] hover:shadow-[0_10px_40px_-8px_var(--color-iris-500)] hover:brightness-110',
        secondary: 'bg-ink-700 text-fg border border-line hover:bg-ink-600 hover:border-line-strong',
        outline: 'border border-line text-fg hover:bg-ink-800 hover:border-line-strong',
        ghost: 'text-fg-muted hover:text-fg hover:bg-ink-800',
        danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25',
        success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  },
)
Button.displayName = 'Button'

/* ─── Tone styling shared by Badge / Pill ────────────────────────────────── */
const toneClasses: Record<Tone, string> = {
  iris: 'bg-iris-500/12 text-iris-300 border-iris-500/25',
  aqua: 'bg-aqua-500/12 text-aqua-300 border-aqua-500/25',
  emerald: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/12 text-amber-400 border-amber-500/25',
  rose: 'bg-rose-500/12 text-rose-400 border-rose-500/25',
  neutral: 'bg-ink-600/60 text-fg-muted border-line',
}
export const toneText: Record<Tone, string> = {
  iris: 'text-iris-400',
  aqua: 'text-aqua-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  neutral: 'text-fg-muted',
}
export const toneBar: Record<Tone, string> = {
  iris: 'bg-iris-500',
  aqua: 'bg-aqua-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  neutral: 'bg-fg-dim',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/* ─── Card ───────────────────────────────────────────────────────────────── */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface-card', className)} {...props} />
}

/* ─── Inputs ─────────────────────────────────────────────────────────────── */
const fieldBase =
  'w-full rounded-[var(--radius-md)] bg-ink-850 border border-line px-3.5 text-sm text-fg placeholder:text-fg-dim transition-colors focus:border-iris-500/60 focus:bg-ink-800 focus-visible:outline-none'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'py-2.5 min-h-24 resize-y leading-relaxed', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-fg-muted', className)} {...props} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldBase,
        'h-10 appearance-none bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239aa3b6%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')]",
        className,
      )}
      {...props}
    />
  )
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-[var(--radius-sm)] bg-ink-700/70', className)} />
}

/* ─── Section heading kicker ─────────────────────────────────────────────── */
export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-800/60 px-3 py-1 text-xs font-medium text-fg-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-iris-aqua" />
      {children}
    </span>
  )
}
