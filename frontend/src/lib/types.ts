// Wire types — mirror the FastAPI Pydantic DTOs exactly (app/api/schemas.py,
// app/crew/models.py). Never guess field names; these match the backend.

export type Category = 'billing' | 'technical' | 'account' | 'feature_request' | 'other'
export type Priority = 'P1' | 'P2' | 'P3' | 'P4'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type TicketStatus = 'RESOLVED' | 'PENDING_REVIEW'
export type EscalationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EDITED'

export interface Classification {
  category: Category
  priority: Priority
  sentiment: Sentiment
  rationale: string
}

export interface Retrieval {
  snippets: string[]
  sources: string[]
  retrieval_confidence: number
}

export interface Draft {
  reply: string
  citations: string[]
  can_answer: boolean
  escalation_reason: string | null
}

export interface QAVerdict {
  grounded: boolean
  tone_ok: boolean
  completeness_ok: boolean
  confidence: number
  passed: boolean
  issues: string[]
}

export interface RoutingDecision {
  status: TicketStatus
  escalate: boolean
  reasons: string[]
}

export interface UsageRecord {
  step: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

export interface RunUsage {
  records: UsageRecord[]
}

export interface Trace {
  classification: Classification
  retrieval: Retrieval
  draft: Draft
  qa: QAVerdict
  decision: RoutingDecision
  usage: RunUsage | null
}

export interface TicketResponse {
  id: string
  status: TicketStatus
  category: Category
  priority: Priority
  sentiment: Sentiment
  escalated: boolean
  confidence: number
  reply: string | null
  citations: string[]
  escalation_reasons: string[]
  estimated_cost_usd: number
}

export interface TicketTrace extends TicketResponse {
  subject: string
  body: string
  channel: string | null
  customer_tier: string | null
  trace: Trace
  created_at: string | null
  updated_at: string | null
}

export interface TicketRequest {
  subject: string
  body: string
  channel?: string | null
  customer_tier?: string | null
  id?: string | null
}

export interface Escalation {
  id: number
  ticket_id: string
  status: EscalationStatus
  reasons: string[]
  human_note: string | null
  final_reply: string | null
  created_at: string | null
  ticket_subject: string | null
  ticket_category: Category | null
  ticket_priority: Priority | null
  ticket_confidence: number | null
}

export interface Health {
  status: string
  version: string
  llm_provider: string
  vector_store: string
  confidence_threshold: number
}

export interface IngestResponse {
  status: string
  documents: number
  chunks: number
  collection: string
  vector_store: string
}
