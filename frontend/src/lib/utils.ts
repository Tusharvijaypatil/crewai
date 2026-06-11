import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Sleep helper for simulated latency in the mock layer. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Short, human id for client-side mock tickets. */
export const shortId = () => Math.random().toString(16).slice(2, 14)

/** Relative time, e.g. "3m ago". */
export function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return '—'
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
