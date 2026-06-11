// Domain → visual mappings. Confidence/QA/priority always get color + meaning,
// never a raw number alone.
import type { Category, Priority, Sentiment, TicketStatus } from './types'

export type Tone = 'iris' | 'aqua' | 'emerald' | 'amber' | 'rose' | 'neutral'

export const PRIORITY: Record<Priority, { tone: Tone; label: string; dot: string }> = {
  P1: { tone: 'rose', label: 'P1 · Critical', dot: 'bg-rose-500' },
  P2: { tone: 'amber', label: 'P2 · High', dot: 'bg-amber-500' },
  P3: { tone: 'iris', label: 'P3 · Normal', dot: 'bg-iris-500' },
  P4: { tone: 'neutral', label: 'P4 · Low', dot: 'bg-fg-dim' },
}

export const CATEGORY: Record<Category, { label: string; tone: Tone }> = {
  billing: { label: 'Billing', tone: 'aqua' },
  technical: { label: 'Technical', tone: 'iris' },
  account: { label: 'Account', tone: 'amber' },
  feature_request: { label: 'Feature request', tone: 'emerald' },
  other: { label: 'Other', tone: 'neutral' },
}

export const SENTIMENT: Record<Sentiment, { label: string; tone: Tone; emoji: string }> = {
  positive: { label: 'Positive', tone: 'emerald', emoji: '◗' },
  neutral: { label: 'Neutral', tone: 'neutral', emoji: '◑' },
  negative: { label: 'Negative', tone: 'rose', emoji: '◖' },
}

export const STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  RESOLVED: { label: 'Auto-resolved', tone: 'emerald' },
  PENDING_REVIEW: { label: 'In review', tone: 'amber' },
}

export function confidenceTone(n: number): Tone {
  if (n >= 75) return 'emerald'
  if (n >= 50) return 'amber'
  return 'rose'
}

/** Make a raw routing reason string human-readable. */
export function humanizeReason(reason: string): string {
  if (reason.startsWith('drafter_cannot_answer:')) return reason.replace('drafter_cannot_answer:', '')
  if (reason === 'qa_failed') return 'QA guardrail did not pass'
  if (reason === 'priority_P1') return 'Priority P1 — always routed to a human'
  if (reason.startsWith('confidence_below_threshold:')) {
    const m = reason.match(/(\d+)<(\d+)/)
    return m ? `QA confidence ${m[1]} is below the ${m[2]} auto-resolve threshold` : 'Confidence below threshold'
  }
  return reason
}
