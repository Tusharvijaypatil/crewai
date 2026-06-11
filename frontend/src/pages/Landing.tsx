import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CircleDot,
  Code2,
  FileSearch,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

import { AuroraBackground, Logo } from '@/components/brand'
import { PipelineDiagram } from '@/components/PipelineDiagram'
import { Badge, Button, Card, Kicker } from '@/components/ui'
import { cn } from '@/lib/utils'

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <Nav />
      <Hero />
      <Metrics />
      <PipelineSection />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-fg-muted md:flex">
          <a href="#pipeline" className="transition-colors hover:text-fg">Pipeline</a>
          <a href="#features" className="transition-colors hover:text-fg">Features</a>
          <a href="#pricing" className="transition-colors hover:text-fg">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-fg">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <a href="https://github.com/Tusharvijaypatil/crewai" target="_blank" rel="noreferrer">
              <Code2 className="h-4 w-4" /> GitHub
            </a>
          </Button>
          <Button asChild size="sm">
            <Link to="/app">
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative">
      <AuroraBackground />
      <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Kicker>Multi-agent support triage</Kicker>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Resolve support tickets <span className="text-gradient">autonomously</span>.
            <br className="hidden sm:block" /> Escalate the risky ones to humans.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-fg-muted"
          >
            Nimbus runs every ticket through a five-stage agent pipeline — classify, retrieve, draft,
            QA — then a <span className="text-fg">deterministic router</span> auto-resolves the
            confident answers and sends anything uncertain or sensitive to a human queue.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg">
              <Link to="/app/submit">
                <Sparkles className="h-4 w-4" /> Try the live pipeline
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/app">See the dashboard</Link>
            </Button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4 text-xs text-fg-dim"
          >
            No signup · runs fully in demo mode · grounded in your knowledge base
          </motion.p>
        </div>

        <Reveal delay={0.15} className="mt-16">
          <ProductMock />
        </Reveal>
      </div>
    </section>
  )
}

/** Animated, stylized product screenshot of a ticket result. */
function ProductMock() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 bg-iris-aqua/20 blur-3xl" />
      <Card className="overflow-hidden p-0 ring-1 ring-white/5">
        <div className="flex items-center gap-2 border-b border-line bg-ink-850 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-2 font-mono text-xs text-fg-dim">nimbus · ticket #656d16fa</span>
          <Badge tone="emerald" className="ml-auto">
            <BadgeCheck className="h-3 w-3" /> Auto-resolved
          </Badge>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-fg-dim">Subject</p>
              <p className="font-medium text-fg">Getting 429 errors from the API</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-line bg-ink-900/60 p-3">
              <p className="text-[13px] leading-relaxed text-fg-muted">
                Based on our documentation: Pro allows <span className="text-fg">1,200 req/min</span> with a burst
                of 2,000/10s. A 429 includes a <span className="font-mono text-aqua-400">Retry-After</span> header…
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-dim">
                <FileSearch className="h-3.5 w-3.5" /> cited{' '}
                <span className="font-mono text-iris-400">06-api-rate-limits.md</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="iris">technical</Badge>
              <Badge tone="neutral">
                <CircleDot className="h-3 w-3 text-fg-dim" /> P3
              </Badge>
              <Badge tone="emerald">QA passed</Badge>
            </div>
          </div>
          <div className="space-y-2.5 rounded-[var(--radius-md)] border border-line bg-ink-900/40 p-3">
            {[
              { k: 'Classify', v: 100, t: 'bg-iris-500' },
              { k: 'Retrieve', v: 92, t: 'bg-aqua-500' },
              { k: 'Draft', v: 88, t: 'bg-iris-500' },
              { k: 'QA confidence', v: 84, t: 'bg-emerald-500' },
            ].map((row, i) => (
              <div key={row.k}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-fg-muted">{row.k}</span>
                  <span className="font-mono text-fg-dim">{row.v}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <motion.div
                    className={cn('h-full rounded-full', row.t)}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${row.v}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
            <div className="!mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs">
              <span className="text-fg-dim">Routed</span>
              <span className="font-medium text-emerald-400">RESOLVED</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Metrics() {
  const stats = [
    { v: '67%', l: 'tickets auto-resolved', s: '12 of 18 on the labeled benchmark' },
    { v: '0', l: 'hallucinated replies', s: 'every claim verified against sources' },
    { v: '100%', l: 'of P1s see a human', s: 'enforced by deterministic routing' },
    { v: '< 1¢', l: 'LLM cost per ticket', s: 'nano-class classifier, capped tokens' },
  ]
  return (
    <section className="border-y border-line bg-ink-850/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-5 sm:px-8 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.l} delay={i * 0.06} className="px-2 py-8 text-center sm:py-10">
            <p className="font-display text-3xl font-semibold text-gradient sm:text-4xl">{s.v}</p>
            <p className="mt-1.5 text-sm font-medium text-fg">{s.l}</p>
            <p className="text-xs text-fg-dim">{s.s}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function PipelineSection() {
  return (
    <section id="pipeline" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <Kicker>The pipeline</Kicker>
        <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">Five agents. One deterministic decision.</h2>
        <p className="mt-4 text-fg-muted">
          Agents do the reasoning. The routing gate is plain Python over their structured outputs —
          so it’s auditable, testable, and impossible to prompt-inject into auto-resolving a
          sensitive ticket.
        </p>
      </Reveal>
      <Reveal delay={0.1} className="mt-12">
        <PipelineDiagram />
      </Reveal>
    </section>
  )
}

function Features() {
  const items = [
    { icon: FileSearch, title: 'RAG-grounded replies', body: 'Answers come only from your knowledge base, with the exact source file cited on every reply. No invented facts, prices, or policies.', tone: 'text-aqua-400' },
    { icon: ShieldCheck, title: 'Hallucination QA guardrail', body: 'A dedicated agent verifies every claim is grounded, checks tone and completeness, and assigns a 0–100 confidence before anything auto-sends.', tone: 'text-emerald-400' },
    { icon: Workflow, title: 'Deterministic routing', body: 'A pure function decides: confident & safe → auto-resolve; low confidence, P1, or sensitive → human queue. The decision is never an LLM.', tone: 'text-amber-400' },
    { icon: ScrollText, title: 'Full agent trace', body: 'Every ticket records classification, retrieval, draft, QA, and the routing reason — a transparent, replayable timeline for each decision.', tone: 'text-iris-400' },
    { icon: BarChart3, title: 'Observability built-in', body: 'Structured traces out of the box, with optional Langfuse. Token usage and estimated cost logged per run.', tone: 'text-iris-400' },
    { icon: BadgeCheck, title: 'Human-in-the-loop', body: 'Reviewers approve, reject, or edit drafted replies from a single queue. The model proposes; a human disposes on anything risky.', tone: 'text-aqua-400' },
  ]
  return (
    <section id="features" className="border-t border-line bg-ink-850/30">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal className="max-w-2xl">
          <Kicker>Why Nimbus</Kicker>
          <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">Trust, not just automation.</h2>
          <p className="mt-4 text-fg-muted">
            Auto-answering tickets with an LLM is easy. Deciding what’s safe to auto-send — reliably —
            is the hard part. That’s the whole product.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <Card className="group h-full p-5 transition-colors hover:border-line-strong">
                <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-line bg-ink-900">
                  <f.icon className={cn('h-5 w-5', f.tone)} />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{f.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: '01', t: 'A ticket arrives', d: 'Via the API or the dashboard form — subject, body, channel, customer tier.' },
    { n: '02', t: 'Agents reason', d: 'Classify → retrieve from the KB → draft a grounded reply → QA-check it for hallucination.' },
    { n: '03', t: 'The router decides', d: 'Confident, grounded, not P1 → auto-resolve. Otherwise → the human review queue with a clear reason.' },
    { n: '04', t: 'A human closes the loop', d: 'Reviewers approve, edit, or reject queued replies — every action tracked.' },
  ]
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-2xl">
        <Kicker>How it works</Kicker>
        <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">From inbox to resolution in one pass.</h2>
      </Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="relative h-full rounded-[var(--radius-lg)] border border-line bg-ink-850/40 p-5">
              <span className="font-mono text-sm text-iris-400">{s.n}</span>
              <h3 className="mt-3 font-semibold">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{s.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  const tiers = [
    { name: 'Free', price: '$0', tag: 'Evaluate', features: ['Full pipeline in demo mode — $0 LLM cost', '1 knowledge base, 500 tickets/mo', 'Community support'], cta: 'Start free', highlight: false },
    { name: 'Pro', price: '$99', per: '/mo', tag: 'Most popular', features: ['Live LLM pipeline (bring your key)', '10k tickets/mo, unlimited KB docs', 'Human review queue + SSO', 'Langfuse tracing built in'], cta: 'Open dashboard', highlight: true },
    { name: 'Enterprise', price: 'Custom', tag: 'Scale', features: ['Postgres + managed vector store', 'EU data residency & DPA', 'Dedicated CSM, 99.9% SLA'], cta: 'Talk to us', highlight: false },
  ]
  return (
    <section id="pricing" className="border-t border-line bg-ink-850/30">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Kicker>Pricing</Kicker>
          <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">Start in mock mode. Scale when ready.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <Card
                className={cn(
                  'relative h-full p-6',
                  t.highlight && 'ring-glow border-iris-500/40',
                )}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-iris-aqua px-2.5 py-0.5 text-xs font-semibold text-ink-950">
                    {t.tag}
                  </span>
                )}
                <p className="text-sm font-medium text-fg-muted">{t.name}</p>
                <p className="mt-2 font-display text-4xl font-semibold">
                  {t.price}
                  {t.per && <span className="text-base font-normal text-fg-dim">{t.per}</span>}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-fg-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={t.highlight ? 'primary' : 'secondary'} className="mt-6 w-full">
                  <Link to="/app">{t.cta}</Link>
                </Button>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ() {
  const qs = [
    { q: 'Does it actually call an LLM?', a: 'It can. By default the whole product runs in a deterministic mock mode at $0 — perfect for demos. Point it at OpenAI with one env var to use real models.' },
    { q: 'How does it avoid hallucinations?', a: 'Replies are drafted only from retrieved knowledge-base context, then a separate QA agent verifies every claim is grounded before anything is allowed to auto-resolve.' },
    { q: 'What guarantees a human sees the risky ones?', a: 'The routing decision is a pure function — any P1, low-confidence, or sensitive ticket (refunds, GDPR, security) is forced into the review queue. It can’t be overridden by the model.' },
    { q: 'Can I bring my own knowledge base?', a: 'Yes. Drop markdown into the KB folder and run ingest — Nimbus chunks, embeds locally (no embedding cost), and indexes it into Chroma or Pinecone.' },
  ]
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <Reveal className="text-center">
        <Kicker>FAQ</Kicker>
        <h2 className="mt-5 text-3xl font-semibold sm:text-4xl">Good questions.</h2>
      </Reveal>
      <div className="mt-10 space-y-3">
        {qs.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.05}>
            <details className="group rounded-[var(--radius-lg)] border border-line bg-ink-850/40 p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-fg">
                {item.q}
                <span className="ml-4 text-fg-dim transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm text-fg-muted">
              Autonomous support triage with a human-in-the-loop guardrail. Built on CrewAI Flows +
              FastAPI.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link to="/app">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <a
              href="https://github.com/Tusharvijaypatil/crewai"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              <Code2 className="h-4 w-4" /> View the source
            </a>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-6 text-xs text-fg-dim sm:flex-row">
          <span>© {new Date().getFullYear()} Nimbus. A portfolio demo — the product is fictional.</span>
          <span className="font-mono">classify → retrieve → draft → qa → route</span>
        </div>
      </div>
    </footer>
  )
}
