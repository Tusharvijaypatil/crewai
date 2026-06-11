// Single API surface. Dispatches to the mock layer (default, offline) or the live
// FastAPI backend via the Vite /api proxy when VITE_USE_MOCKS=false.

import { ApiError, mockApi } from './mocks'
import type { Escalation, Health, IngestResponse, TicketRequest, TicketResponse, TicketTrace } from './types'
import { sleep } from './utils'

export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false'
const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

// Real backend has no "list tickets" endpoint, so keep a session cache of what
// we've submitted this session (the queue list endpoint is used for escalations).
let realTickets: TicketTrace[] = []

export const api = {
  useMocks: USE_MOCKS,

  async submitTicket(req: TicketRequest): Promise<TicketTrace> {
    if (USE_MOCKS) {
      await sleep(900)
      return mockApi.submitTicket(req)
    }
    const r = await http<TicketResponse>('/tickets', { method: 'POST', body: JSON.stringify(req) })
    const full = await http<TicketTrace>(`/tickets/${r.id}`)
    realTickets = [full, ...realTickets]
    return full
  },

  async getTicket(id: string): Promise<TicketTrace> {
    if (USE_MOCKS) {
      await sleep(450)
      return mockApi.getTicket(id)
    }
    return http<TicketTrace>(`/tickets/${id}`)
  },

  async listTickets(): Promise<TicketTrace[]> {
    if (USE_MOCKS) {
      await sleep(400)
      return mockApi.listTickets()
    }
    return structuredClone(realTickets)
  },

  async listEscalations(status?: string): Promise<Escalation[]> {
    if (USE_MOCKS) {
      await sleep(400)
      return mockApi.listEscalations(status)
    }
    return http<Escalation[]>(`/escalations${status ? `?status=${status}` : ''}`)
  },

  async actOnEscalation(
    id: number,
    action: 'approve' | 'reject' | 'edit',
    body?: { note?: string; final_reply?: string },
  ): Promise<Escalation> {
    if (USE_MOCKS) {
      await sleep(550)
      return mockApi.actOnEscalation(id, action, body)
    }
    return http<Escalation>(`/escalations/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    })
  },

  async health(): Promise<Health> {
    if (USE_MOCKS) {
      await sleep(300)
      return mockApi.health()
    }
    return http<Health>('/health')
  },

  async ingest(): Promise<IngestResponse> {
    if (USE_MOCKS) {
      await sleep(1600)
      return mockApi.ingest()
    }
    return http<IngestResponse>('/ingest', { method: 'POST' })
  },
}

export { ApiError }
