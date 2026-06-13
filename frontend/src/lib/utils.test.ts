import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { timeAgo, titleCase } from './utils'

describe('timeAgo', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00Z')))
  afterEach(() => vi.useRealTimers())

  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it('returns an em dash for missing input', () => {
    expect(timeAgo(undefined)).toBe('—')
    expect(timeAgo(null)).toBe('—')
  })

  it('returns an em dash for an unparseable date', () => {
    expect(timeAgo('not-a-date')).toBe('—')
  })

  it('formats seconds, minutes, hours, and days', () => {
    expect(timeAgo(ago(5_000))).toBe('5s ago')
    expect(timeAgo(ago(3 * 60_000))).toBe('3m ago')
    expect(timeAgo(ago(2 * 3_600_000))).toBe('2h ago')
    expect(timeAgo(ago(4 * 86_400_000))).toBe('4d ago')
  })

  it('never returns 0 seconds', () => {
    expect(timeAgo(ago(200))).toBe('1s ago')
  })
})

describe('titleCase', () => {
  it('capitalises words and replaces underscores', () => {
    expect(titleCase('feature_request')).toBe('Feature Request')
    expect(titleCase('billing')).toBe('Billing')
    expect(titleCase('pending_review')).toBe('Pending Review')
  })
})
