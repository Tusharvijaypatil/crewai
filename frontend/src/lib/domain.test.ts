import { describe, expect, it } from 'vitest'

import { confidenceTone, humanizeReason, STATUS } from './domain'

describe('confidenceTone', () => {
  it('maps scores to semantic tones at the routing threshold boundaries', () => {
    expect(confidenceTone(100)).toBe('emerald')
    expect(confidenceTone(75)).toBe('emerald') // inclusive — matches the 75 auto-resolve gate
    expect(confidenceTone(74)).toBe('amber')
    expect(confidenceTone(50)).toBe('amber')
    expect(confidenceTone(49)).toBe('rose')
    expect(confidenceTone(0)).toBe('rose')
  })
})

describe('STATUS', () => {
  it('labels resolved as success and pending as review', () => {
    expect(STATUS.RESOLVED).toEqual({ label: 'Auto-resolved', tone: 'emerald' })
    expect(STATUS.PENDING_REVIEW).toEqual({ label: 'In review', tone: 'amber' })
  })
})

describe('humanizeReason', () => {
  it('unwraps the drafter reason payload', () => {
    expect(humanizeReason('drafter_cannot_answer:Needs identity verification.')).toBe(
      'Needs identity verification.',
    )
  })

  it('explains the deterministic gate reasons', () => {
    expect(humanizeReason('qa_failed')).toBe('QA guardrail did not pass')
    expect(humanizeReason('priority_P1')).toBe('Priority P1 — always routed to a human')
  })

  it('renders the confidence-threshold reason with both numbers', () => {
    expect(humanizeReason('confidence_below_threshold:40<75')).toBe(
      'QA confidence 40 is below the 75 auto-resolve threshold',
    )
  })

  it('passes through anything it does not recognise', () => {
    expect(humanizeReason('some_future_reason')).toBe('some_future_reason')
  })
})
