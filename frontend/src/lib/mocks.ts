// In-memory mock backend that mirrors the FastAPI pipeline closely enough to
// demo the whole product offline. Keyword classification + canned KB snippets,
// the same deterministic routing rule as app/flow/routing.py.

import type {
  Category,
  Escalation,
  Health,
  IngestResponse,
  Priority,
  Sentiment,
  TicketRequest,
  TicketResponse,
  TicketTrace,
  Trace,
} from './types'
import { shortId } from './utils'

export const CONFIDENCE_THRESHOLD = 75

export const KB_DOCS = [
  '01-getting-started.md',
  '02-password-reset-and-login.md',
  '03-plan-tiers-and-pricing.md',
  '04-billing-and-invoices.md',
  '05-refund-policy.md',
  '06-api-rate-limits.md',
  '07-integrations.md',
  '08-security-and-data-privacy.md',
  '09-troubleshooting-deployments.md',
]

const SNIPPETS: Record<string, { source: string; text: string }> = {
  rate: {
    source: '06-api-rate-limits.md',
    text: 'Limits by plan — Free: 60 req/min (burst 100/10s); Starter: 300 req/min; Pro: 1,200 req/min (burst 2,000/10s); Enterprise: custom. Limits are per organization. A 429 response includes a Retry-After header and X-RateLimit-Remaining.',
  },
  reset: {
    source: '02-password-reset-and-login.md',
    text: 'Reset a forgotten password at app.nimbus.io/forgot-password. The reset link is valid for 60 minutes. SSO users must reset through their identity provider — Nimbus does not store SSO passwords.',
  },
  refund: {
    source: '05-refund-policy.md',
    text: 'Annual plans are eligible for a full refund within 14 days of purchase. Monthly plans are not pro-rated but can be cancelled anytime and remain active until period end.',
  },
  slack: {
    source: '07-integrations.md',
    text: 'Connect Slack under Settings → Integrations → Slack via OAuth. Choose a default channel for run notifications. Available on Starter and above.',
  },
  invoices: {
    source: '04-billing-and-invoices.md',
    text: 'Find invoices under Settings → Billing → Invoices. Each invoice can be downloaded as a PDF and includes your business name, address, and VAT/Tax ID if set.',
  },
  plans: {
    source: '03-plan-tiers-and-pricing.md',
    text: 'Starter is $29/mo (25 workflows, 5 seats, email support). Pro is $99/mo (unlimited workflows, 20 seats, SSO, priority support). Annual billing saves two months.',
  },
  deploy: {
    source: '09-troubleshooting-deployments.md',
    text: 'Failed runs appear under Runs with per-step logs. Common causes: expired cloud credentials, step timeouts (default 10 min), and rate-limited downstream APIs. Configure auto-retry with backoff.',
  },
  security: {
    source: '08-security-and-data-privacy.md',
    text: 'Nimbus is SOC 2 Type II certified. Data is encrypted at rest (AES-256) and in transit (TLS 1.2+). A DPA is available and EU data residency is offered on Enterprise.',
  },
}

interface Rule {
  match: RegExp
  category: Category
  snippet: keyof typeof SNIPPETS
  sentiment?: 'positive' | 'neutral' | 'negative'
}

const RULES: Rule[] = [
  { match: /rate limit|429|throttl|quota/i, category: 'technical', snippet: 'rate' },
  { match: /password|reset|log ?in|2fa|sign in/i, category: 'account', snippet: 'reset' },
  { match: /refund|cancel.*subscription|money back/i, category: 'billing', snippet: 'refund' },
  { match: /slack|integration|webhook|connect/i, category: 'technical', snippet: 'slack' },
  { match: /invoice|receipt|billing|download.*pdf/i, category: 'billing', snippet: 'invoices' },
  { match: /plan|pricing|tier|upgrade|seats/i, category: 'billing', snippet: 'plans' },
  { match: /deploy|failing|timeout|stuck|error|workflow/i, category: 'technical', snippet: 'deploy' },
  { match: /soc ?2|dpa|compliance|residency|security/i, category: 'account', snippet: 'security' },
]

const P1 = /urgent|outage|down|production|critical|customers affected|sla breach/i
const SENSITIVE =
  /gdpr|article 17|erase|delete (my|all).*(data|account)|double charg|charged twice|leaked|breach|security incident|hipaa|baa/i
const ANGRY = /urgent|asap|unacceptable|ridiculous|angry|frustrat|terrible|down|costing/i

function classify(text: string) {
  const t = text.toLowerCase()
  const rule = RULES.find((r) => r.match.test(t))
  const category: Category = rule?.category ?? 'other'
  const sensitive = SENSITIVE.test(t)
  let priority: Priority = 'P4'
  if (P1.test(t)) priority = 'P1'
  else if (sensitive) priority = 'P2'
  else if (category === 'account') priority = 'P3'
  else if (/refund|cancel/.test(t)) priority = 'P3'
  else if (/error|timeout|fail|stuck|can'?t|429/.test(t)) priority = 'P3'
  const sentiment: Sentiment = ANGRY.test(t) ? 'negative' : 'neutral'
  return { category, priority, sentiment, rule, sensitive }
}

function runPipeline(req: TicketRequest): TicketTrace {
  const text = `${req.subject} ${req.body}`
  const { category, priority, sentiment, rule, sensitive } = classify(text)

  const hit = rule ? SNIPPETS[rule.snippet] : null
  const retrieval_confidence = hit ? 78 + Math.floor(Math.random() * 18) : 28
  const snippets = hit ? [hit.text] : []
  const sources = hit ? [hit.source] : []

  const canAnswer = !!hit && !sensitive
  const reason = sensitive
    ? sensitiveReason(text)
    : !hit
      ? 'Insufficient knowledge-base context to answer confidently.'
      : null

  const reply = canAnswer
    ? `Thanks for reaching out about "${req.subject}". Based on our documentation: ${hit!.text} If anything's unclear, just reply here.`
    : 'This request needs a human teammate to handle safely, so I’ve routed it to our support specialists who will follow up.'

  const qaConfidence = canAnswer ? retrieval_confidence : Math.min(40, Math.floor(retrieval_confidence / 2))
  const passed = canAnswer

  const reasons: string[] = []
  if (!canAnswer) reasons.push(`drafter_cannot_answer:${reason}`)
  if (!passed) reasons.push('qa_failed')
  if (priority === 'P1') reasons.push('priority_P1')
  if (qaConfidence < CONFIDENCE_THRESHOLD) reasons.push(`confidence_below_threshold:${qaConfidence}<${CONFIDENCE_THRESHOLD}`)
  const escalate = reasons.length > 0
  const status = escalate ? 'PENDING_REVIEW' : 'RESOLVED'

  const trace: Trace = {
    classification: {
      category,
      priority,
      sentiment,
      rationale: `Matched ${category} signals; priority ${priority} from urgency/sensitivity heuristics.`,
    },
    retrieval: { snippets, sources, retrieval_confidence },
    draft: { reply, citations: canAnswer ? sources : [], can_answer: canAnswer, escalation_reason: reason },
    qa: {
      grounded: canAnswer,
      tone_ok: true,
      completeness_ok: canAnswer,
      confidence: qaConfidence,
      passed,
      issues: passed ? [] : [reason ?? 'Cannot be answered from the knowledge base.'],
    },
    decision: { status, escalate, reasons },
    usage: { records: [] },
  }

  const now = new Date().toISOString()
  return {
    id: req.id || shortId(),
    status,
    category,
    priority,
    sentiment,
    escalated: escalate,
    confidence: qaConfidence,
    reply: status === 'RESOLVED' ? reply : null,
    citations: canAnswer ? sources : [],
    escalation_reasons: reasons,
    estimated_cost_usd: 0,
    subject: req.subject,
    body: req.body,
    channel: req.channel ?? null,
    customer_tier: req.customer_tier ?? null,
    trace,
    created_at: now,
    updated_at: now,
  }
}

function sensitiveReason(t: string): string {
  if (/gdpr|article 17|erase|delete (my|all)/i.test(t))
    return 'GDPR data-deletion request requires identity verification by a human agent.'
  if (/double charg|charged twice/i.test(t))
    return 'Billing dispute / duplicate charge requires account verification and a human refund.'
  if (/leaked|breach|security incident/i.test(t))
    return 'Possible security incident — must be routed to the security on-call team immediately.'
  if (/hipaa|baa/i.test(t)) return 'HIPAA/BAA is not covered by the knowledge base and requires legal review.'
  return 'This request requires a human teammate to handle safely.'
}

// ── Seed store ─────────────────────────────────────────────────────────────
const SEEDS: TicketRequest[] = [
  { subject: 'Getting 429 errors from the API', body: 'We intermittently get HTTP 429s. What are the rate limits and which headers show remaining quota?', channel: 'email', customer_tier: 'pro' },
  { subject: 'How do I reset my password?', body: 'I forgot my password and the reset email link seems expired. Help?', channel: 'chat', customer_tier: 'starter' },
  { subject: 'Connect Nimbus to Slack', body: 'We want failure notifications posted into our #ops channel. How do we set that up?', channel: 'chat', customer_tier: 'pro' },
  { subject: 'Difference between Starter and Pro?', body: 'Deciding whether to upgrade — seats, workflows, support response time, SSO?', channel: 'email', customer_tier: 'starter' },
  { subject: 'Where do I download invoices?', body: 'Finance needs PDF copies of past invoices for expense reports.', channel: 'email', customer_tier: 'pro' },
  { subject: 'Refund window for annual plans?', body: 'We upgraded to the annual Pro plan 9 days ago but are consolidating tooling. Are we still inside the refund window?', channel: 'email', customer_tier: 'pro' },
  { subject: 'Deploy step keeps timing out', body: 'Our nightly Terraform-apply workflow fails at step 3 with a timeout after exactly 10 minutes. Runs fine locally. What controls that limit?', channel: 'chat', customer_tier: 'starter' },
  { subject: 'URGENT: production is down', body: 'Every workflow is failing in production right now and customers are affected. Enterprise SLA.', channel: 'phone', customer_tier: 'enterprise' },
  { subject: 'Delete all my data', body: 'Under GDPR Article 17 please erase all personal data and delete my account.', channel: 'email', customer_tier: 'free' },
  { subject: 'We were double charged this month', body: 'Two identical Pro charges hit our card. Please refund the duplicate.', channel: 'email', customer_tier: 'pro' },
]

const TICKETS: TicketTrace[] = []
const ESCALATIONS: Escalation[] = []
let escId = 1

function seed() {
  if (TICKETS.length) return
  const spread = [2, 5, 9, 14, 21, 28, 39, 47, 61, 84] // minutes ago
  SEEDS.forEach((s, i) => {
    const t = runPipeline(s)
    const created = new Date(Date.now() - spread[i] * 60_000).toISOString()
    t.created_at = created
    t.updated_at = created
    TICKETS.push(t)
    if (t.escalated) {
      ESCALATIONS.push({
        id: escId++,
        ticket_id: t.id,
        status: 'PENDING_REVIEW',
        reasons: t.escalation_reasons,
        human_note: null,
        final_reply: null,
        created_at: created,
        ticket_subject: t.subject,
        ticket_category: t.category,
        ticket_priority: t.priority,
        ticket_confidence: t.confidence,
      })
    }
  })
  TICKETS.reverse()
}
seed()

// ── Mock API surface ───────────────────────────────────────────────────────
export const mockApi = {
  async submitTicket(req: TicketRequest): Promise<TicketTrace> {
    const t = runPipeline(req)
    TICKETS.unshift(t)
    if (t.escalated) {
      ESCALATIONS.unshift({
        id: escId++,
        ticket_id: t.id,
        status: 'PENDING_REVIEW',
        reasons: t.escalation_reasons,
        human_note: null,
        final_reply: null,
        created_at: t.created_at,
        ticket_subject: t.subject,
        ticket_category: t.category,
        ticket_priority: t.priority,
        ticket_confidence: t.confidence,
      })
    }
    return structuredClone(t)
  },
  async listTickets(): Promise<TicketTrace[]> {
    return structuredClone(TICKETS)
  },
  async getTicket(id: string): Promise<TicketTrace> {
    const t = TICKETS.find((x) => x.id === id)
    if (!t) throw new ApiError(404, `Ticket ${id} not found`)
    return structuredClone(t)
  },
  async listEscalations(status?: string): Promise<Escalation[]> {
    const rows = status ? ESCALATIONS.filter((e) => e.status === status) : ESCALATIONS
    return structuredClone(rows)
  },
  async actOnEscalation(
    id: number,
    action: 'approve' | 'reject' | 'edit',
    body?: { note?: string; final_reply?: string },
  ): Promise<Escalation> {
    const esc = ESCALATIONS.find((e) => e.id === id)
    if (!esc) throw new ApiError(404, `Escalation ${id} not found`)
    const ticket = TICKETS.find((t) => t.id === esc.ticket_id)
    if (action === 'approve') {
      esc.status = 'APPROVED'
      esc.human_note = body?.note ?? null
      if (ticket) ticket.status = 'RESOLVED'
    } else if (action === 'reject') {
      esc.status = 'REJECTED'
      esc.human_note = body?.note ?? null
    } else {
      esc.status = 'EDITED'
      esc.final_reply = body?.final_reply ?? null
      if (ticket && body?.final_reply) {
        ticket.status = 'RESOLVED'
        ticket.reply = body.final_reply
      }
    }
    return structuredClone(esc)
  },
  async health(): Promise<Health> {
    return {
      status: 'ok',
      version: '0.1.0',
      llm_provider: 'mock',
      vector_store: 'chroma',
      confidence_threshold: CONFIDENCE_THRESHOLD,
    }
  },
  async ingest(): Promise<IngestResponse> {
    return { status: 'ok', documents: 9, chunks: 53, collection: 'nimbus_kb', vector_store: 'chroma' }
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type { TicketResponse }
