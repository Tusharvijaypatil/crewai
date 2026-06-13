import { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryWrapper } from '@/test/utils'
import { api } from './api'
import { useEscalationAction } from './queries'
import type { Escalation } from './types'

const baseEscalation: Escalation = {
  id: 1,
  ticket_id: 't-1',
  status: 'PENDING_REVIEW',
  reasons: ['priority_P1'],
  human_note: null,
  final_reply: null,
  created_at: null,
  ticket_subject: 'URGENT: production is down',
  ticket_category: 'technical',
  ticket_priority: 'P1',
  ticket_confidence: 90,
}

function seededClient() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  client.setQueryData<Escalation[]>(['escalations', 'all'], [baseEscalation])
  return client
}

const statusOf = (client: QueryClient) =>
  client.getQueryData<Escalation[]>(['escalations', 'all'])![0].status

describe('useEscalationAction', () => {
  afterEach(() => vi.restoreAllMocks())

  it('optimistically applies the new status and keeps it on success', async () => {
    const client = seededClient()
    vi.spyOn(api, 'actOnEscalation').mockResolvedValue({ ...baseEscalation, status: 'APPROVED' })

    const { result } = renderHook(() => useEscalationAction(), { wrapper: queryWrapper(client) })
    act(() => result.current.mutate({ id: 1, action: 'approve' }))

    // optimistic: the queue reflects APPROVED before the request resolves
    await waitFor(() => expect(statusOf(client)).toBe('APPROVED'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(statusOf(client)).toBe('APPROVED')
  })

  it('rolls back to the previous status when the request fails', async () => {
    const client = seededClient()
    let reject!: (err: unknown) => void
    vi.spyOn(api, 'actOnEscalation').mockReturnValue(
      new Promise<Escalation>((_resolve, r) => {
        reject = r
      }),
    )

    const { result } = renderHook(() => useEscalationAction(), { wrapper: queryWrapper(client) })
    act(() => result.current.mutate({ id: 1, action: 'reject' }))

    // optimistic update applied
    await waitFor(() => expect(statusOf(client)).toBe('REJECTED'))

    // request fails → rollback to the snapshot
    act(() => reject(new Error('network blip')))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(statusOf(client)).toBe('PENDING_REVIEW')
  })
})
