import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Cpu, Database, Gauge, Loader2, RefreshCw, ServerCog, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/bits'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { USE_MOCKS } from '@/lib/api'
import { useHealth, useIngest } from '@/lib/queries'
import { cn } from '@/lib/utils'

export function HealthPage() {
  const { data: health, isLoading, isError } = useHealth()
  const ingest = useIngest()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!ingest.isPending) return
    setProgress(8)
    const id = setInterval(() => setProgress((p) => Math.min(92, p + Math.random() * 16)), 200)
    return () => clearInterval(id)
  }, [ingest.isPending])

  useEffect(() => {
    if (ingest.isSuccess) setProgress(100)
  }, [ingest.isSuccess])

  const runIngest = () =>
    ingest.mutate(undefined, {
      onSuccess: (r) => toast.success(`Ingested ${r.documents} docs → ${r.chunks} chunks`),
      onError: () => toast.error('Ingest failed'),
    })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Health & knowledge base</h1>
        <p className="mt-1 text-sm text-fg-muted">Effective configuration and vector-store management.</p>
      </header>

      {isError ? (
        <ErrorState message="Backend is unreachable. The dashboard still runs in demo mode." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ConfigCard icon={ServerCog} label="Status" value={health?.status ?? '—'} tone="emerald" loading={isLoading} pulse />
          <ConfigCard icon={Cpu} label="LLM provider" value={health?.llm_provider ?? '—'} tone="iris" loading={isLoading} />
          <ConfigCard icon={Database} label="Vector store" value={health?.vector_store ?? '—'} tone="aqua" loading={isLoading} />
          <ConfigCard icon={Gauge} label="Confidence threshold" value={health ? String(health.confidence_threshold) : '—'} tone="amber" loading={isLoading} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-iris-400" />
            <h2 className="font-semibold">Knowledge base ingest</h2>
          </div>
          <p className="mt-1.5 text-sm text-fg-muted">
            Rebuild the vector store from the markdown knowledge base. Embeddings run locally — no cost.
          </p>

          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-ink-700">
              <motion.div
                className="h-full rounded-full bg-iris-aqua"
                animate={{ width: `${ingest.isPending || ingest.isSuccess ? progress : 0}%` }}
                transition={{ ease: 'easeOut' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-fg-dim">
              <span>
                {ingest.isPending ? 'Chunking & embedding…' : ingest.isSuccess ? 'Up to date' : 'Idle'}
              </span>
              <span className="font-mono">{Math.round(ingest.isPending || ingest.isSuccess ? progress : 0)}%</span>
            </div>
          </div>

          <AnimatePresence>
            {ingest.isSuccess && ingest.data && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 grid grid-cols-3 gap-2"
              >
                <Stat label="documents" value={ingest.data.documents} />
                <Stat label="chunks" value={ingest.data.chunks} />
                <Stat label="collection" value={ingest.data.collection} mono />
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={runIngest} disabled={ingest.isPending} className="mt-5 w-full" variant="secondary">
            {ingest.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Ingesting…</>
            ) : (
              <><RefreshCw className="h-4 w-4" /> Rebuild vector store</>
            )}
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Pipeline configuration</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <ConfigRow k="Mode" v={<Badge tone={USE_MOCKS ? 'iris' : 'emerald'}>{USE_MOCKS ? 'Demo · mock data' : 'Live · FastAPI'}</Badge>} />
            <ConfigRow k="Version" v={<span className="font-mono">{health?.version ?? '—'}</span>} />
            <ConfigRow k="Embeddings" v={<span className="font-mono text-fg-muted">all-MiniLM-L6-v2 · local</span>} />
            <ConfigRow k="Auto-resolve rule" v={<span className="text-fg-muted">conf ≥ {health?.confidence_threshold ?? 75} & not P1</span>} />
          </dl>
          <p className="mt-5 rounded-[var(--radius-md)] border border-line bg-ink-900/40 p-3 text-xs leading-relaxed text-fg-dim">
            The frontend talks to the FastAPI backend through a dev proxy on <span className="font-mono text-fg-muted">:8000</span>. Set <span className="font-mono text-fg-muted">VITE_USE_MOCKS=false</span> to use the live pipeline.
          </p>
        </Card>
      </div>
    </div>
  )
}

function ConfigCard({
  icon: Icon, label, value, tone, loading, pulse,
}: {
  icon: typeof Cpu; label: string; value: string
  tone: 'iris' | 'aqua' | 'emerald' | 'amber'; loading?: boolean; pulse?: boolean
}) {
  const toneText = { iris: 'text-iris-400', aqua: 'text-aqua-400', emerald: 'text-emerald-400', amber: 'text-amber-400' }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">{label}</span>
        <Icon className={cn('h-[18px] w-[18px]', toneText)} />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-6 w-20" />
      ) : (
        <p className="mt-2 flex items-center gap-2 font-mono text-lg font-semibold capitalize">
          {pulse && <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--color-emerald-500)]" />}
          {value}
        </p>
      )}
    </Card>
  )
}

function ConfigRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-fg-dim">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-ink-900/40 p-2.5 text-center">
      <p className={cn('text-base font-semibold text-fg', mono && 'font-mono text-sm')}>{value}</p>
      <p className="text-[11px] text-fg-dim">{label}</p>
    </div>
  )
}
