import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'
import type { Escalation, TicketRequest } from './types'

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 30_000 })
}

export function useTickets() {
  return useQuery({ queryKey: ['tickets'], queryFn: api.listTickets })
}

export function useTicket(id: string | undefined) {
  return useQuery({ queryKey: ['ticket', id], queryFn: () => api.getTicket(id!), enabled: !!id })
}

export function useSubmitTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: TicketRequest) => api.submitTicket(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['escalations'] })
    },
  })
}

export function useEscalations(status?: string) {
  return useQuery({ queryKey: ['escalations', status ?? 'all'], queryFn: () => api.listEscalations(status) })
}

export function useEscalationAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      id: number
      action: 'approve' | 'reject' | 'edit'
      body?: { note?: string; final_reply?: string }
    }) => api.actOnEscalation(vars.id, vars.action, vars.body),
    // Optimistic update of the queue.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['escalations'] })
      const prev = qc.getQueriesData<Escalation[]>({ queryKey: ['escalations'] })
      const nextStatus = vars.action === 'reject' ? 'REJECTED' : vars.action === 'edit' ? 'EDITED' : 'APPROVED'
      prev.forEach(([key, data]) => {
        if (!data) return
        qc.setQueryData(
          key,
          data.map((e) => (e.id === vars.id ? { ...e, status: nextStatus } : e)),
        )
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['escalations'] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}

export function useIngest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.ingest(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health'] }),
  })
}
