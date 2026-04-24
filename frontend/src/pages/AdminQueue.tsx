import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { fetchQueue, approveArticle, rejectArticle, triggerScrape, triggerDigest } from '../api/admin'
import type { ArticleAdmin } from '../types'
import TopicBadge from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'

const BASE_URL = import.meta.env.VITE_API_URL || ''
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || ''

type ScrapeEvent = {
  message: string
  kind: string
  ts: number
  url?: string
  source?: string
  topic?: string
  decision?: string
  confidence?: number
  quality?: number
  relevance?: number
  image_url?: string
  preview?: string
  core_claim?: string
  detail?: string
  reason?: string
}

// ── Pipeline event renderers ──────────────────────────────────────────────────

function EvFound({ ev }: { ev: ScrapeEvent }) {
  return (
    <div className="flex gap-3 rounded-lg border border-sky-900/40 bg-sky-950/20 p-3">
      {ev.image_url && (
        <img src={ev.image_url} alt="" className="h-12 w-16 shrink-0 rounded object-cover opacity-70"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      )}
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-sky-500 uppercase">
          <span>Found</span>
          {ev.source && <span className="text-sky-700">· {ev.source}</span>}
        </div>
        <p className="text-sm text-gray-200 line-clamp-1">{ev.message}</p>
      </div>
    </div>
  )
}

function EvAnalyzing({ ev }: { ev: ScrapeEvent }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 text-xs text-gray-600">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500 shrink-0" />
      <span className="line-clamp-1">Analyzing: <span className="text-gray-500">{ev.message}</span></span>
    </div>
  )
}

function EvScored({ ev }: { ev: ScrapeEvent }) {
  const decisionColor =
    ev.decision === 'publish'             ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' :
    ev.decision === 'publish_with_caution' ? 'text-yellow-400 bg-yellow-950/30 border-yellow-800/40' :
                                             'text-red-400 bg-red-950/30 border-red-800/40'
  return (
    <div className="ml-3 rounded-lg border border-gray-800/60 bg-gray-900/40 p-2.5 text-xs space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-gray-500">
        <span>source <span className="font-semibold text-gray-300">{ev.quality}/5</span></span>
        <span>·</span>
        <span>relevance <span className="font-semibold text-gray-300">{ev.relevance}/5</span></span>
        <span>·</span>
        <span>confidence <span className="font-semibold text-gray-300">{ev.confidence}/5</span></span>
        {ev.topic && (
          <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-gray-400">{ev.topic}</span>
        )}
        <span className={`ml-auto rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${decisionColor}`}>
          {ev.decision?.replace('_', ' ')}
        </span>
      </div>
      {ev.core_claim && (
        <p className="text-gray-600 italic line-clamp-2 leading-relaxed">"{ev.core_claim}"</p>
      )}
    </div>
  )
}

function EvRewriting({ ev }: { ev: ScrapeEvent }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 text-xs text-gray-600">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500 shrink-0" />
      <span className="line-clamp-1">Rewriting: <span className="text-gray-500">{ev.message}</span></span>
    </div>
  )
}

function EvReady({ ev }: { ev: ScrapeEvent }) {
  return (
    <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-wide uppercase text-emerald-400">✓ Queued</span>
        {ev.topic && (
          <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{ev.topic}</span>
        )}
        <span className="ml-auto text-xs text-gray-700">confidence {ev.confidence}/5</span>
      </div>
      <p className="mb-1.5 text-sm font-medium text-gray-100 line-clamp-2">{ev.message}</p>
      {ev.preview && (
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{ev.preview}</p>
      )}
    </div>
  )
}

function EvSkipped({ ev }: { ev: ScrapeEvent }) {
  return (
    <div className="flex items-start gap-2 px-2 py-1 text-xs text-gray-700">
      <span className="mt-px shrink-0 text-red-900">✗</span>
      <div className="min-w-0">
        <span className="line-clamp-1 text-gray-600">{ev.message}</span>
        {ev.reason && <span className="text-gray-700"> · {ev.reason}</span>}
      </div>
    </div>
  )
}

function EvSystem({ ev }: { ev: ScrapeEvent }) {
  const color =
    ev.kind === 'source_start' ? 'text-gray-600' :
    ev.kind === 'done'         ? 'text-emerald-400 font-semibold' :
    ev.kind === 'error'        ? 'text-red-400' :
    'text-gray-700'
  const icon =
    ev.kind === 'source_start' ? '→' :
    ev.kind === 'done'         ? '🎉' :
    ev.kind === 'error'        ? '✗' : '·'
  return (
    <div className={`flex items-center gap-2 px-2 py-1 text-xs ${color}`}>
      <span className="shrink-0">{icon}</span>
      <span>{ev.message}</span>
    </div>
  )
}

function PipelineEvent({ ev }: { ev: ScrapeEvent }) {
  switch (ev.kind) {
    case 'found':     return <EvFound ev={ev} />
    case 'analyzing': return <EvAnalyzing ev={ev} />
    case 'scored':    return <EvScored ev={ev} />
    case 'rewriting': return <EvRewriting ev={ev} />
    case 'publish':   return <EvReady ev={ev} />
    case 'skipped':   return <EvSkipped ev={ev} />
    default:          return <EvSystem ev={ev} />
  }
}

// ── Scrape panel ──────────────────────────────────────────────────────────────

function ScrapePanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [events, setEvents] = useState<ScrapeEvent[]>([])
  const [done, setDone] = useState(false)
  const [counts, setCounts] = useState({ found: 0, ready: 0, skipped: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = `${BASE_URL}/api/v1/admin/scrape-events?token=${encodeURIComponent(ADMIN_TOKEN)}`
    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: ScrapeEvent = JSON.parse(e.data)
      setEvents((prev) => [...prev, event])
      setCounts((prev) => ({
        found:   prev.found   + (event.kind === 'found'   ? 1 : 0),
        ready:   prev.ready   + (event.kind === 'publish' ? 1 : 0),
        skipped: prev.skipped + (event.kind === 'skipped' ? 1 : 0),
      }))
      if (event.kind === 'done') {
        setDone(true)
        es.close()
        onDone()
      }
    }
    es.onerror = () => {
      setEvents((prev) => [...prev, { message: 'Connection lost.', kind: 'error', ts: Date.now() / 1000 }])
      es.close()
    }
    return () => es.close()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [events])

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-gray-950 shadow-2xl border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 px-5 py-4">
        <div className="flex items-center gap-3">
          {!done && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Pipeline</p>
            <p className="text-sm font-semibold text-white">
              {done ? 'Completed' : 'Running…'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-800 hover:text-white transition">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Stats bar */}
      {(counts.found > 0 || counts.ready > 0 || counts.skipped > 0) && (
        <div className="flex gap-4 border-b border-gray-800/60 bg-gray-900/50 px-5 py-2.5 text-xs">
          <div>
            <span className="text-gray-600">Found </span>
            <span className="font-bold text-sky-400">{counts.found}</span>
          </div>
          <div>
            <span className="text-gray-600">Queued </span>
            <span className="font-bold text-emerald-400">{counts.ready}</span>
          </div>
          {counts.skipped > 0 && (
            <div>
              <span className="text-gray-600">Skipped </span>
              <span className="font-bold text-gray-500">{counts.skipped}</span>
            </div>
          )}
        </div>
      )}

      {/* Events */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {events.length === 0 && !done && (
          <p className="px-2 py-3 text-xs text-gray-700">Connecting…</p>
        )}
        {events.map((ev, i) => <PipelineEvent key={i} ev={ev} />)}
        <div ref={bottomRef} />
      </div>

      {done && (
        <div className="border-t border-gray-800 p-4">
          <button onClick={onClose}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition">
            Close & Refresh
          </button>
        </div>
      )}
    </div>
  )
}

// ── Article review card ───────────────────────────────────────────────────────

function QualityBar({ score }: { score: number | null }) {
  if (score === null) return null
  const pct = Math.round(score * 100)
  const color = score >= 0.75 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-gray-400 w-7 text-right">{pct}%</span>
    </div>
  )
}

function ArticleReviewCard({ article, onApprove, onReject }: {
  article: ArticleAdmin
  onApprove?: (id: number) => void
  onReject?: (id: number) => void
}) {
  const [showContent, setShowContent] = useState(false)

  const statusConfig = {
    published:   { label: 'Published', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-l-emerald-400' },
    rejected:    { label: 'Rejected',  cls: 'bg-red-50 text-red-700 border-red-200',             border: 'border-l-red-400' },
    rejected_ai: { label: 'AI Skip',   cls: 'bg-orange-50 text-orange-700 border-orange-200',    border: 'border-l-orange-400' },
    pending_human: { label: 'Pending', cls: 'bg-gray-50 text-gray-600 border-gray-200',          border: 'border-l-gray-300' },
  }
  const cfg = statusConfig[article.status as keyof typeof statusConfig] ?? statusConfig.pending_human

  return (
    <div className={`rounded-xl border border-gray-100 bg-white shadow-sm border-l-4 ${cfg.border} overflow-hidden hover:shadow-md transition-shadow`}>
      {/* Image — always show something */}
      <div className="overflow-hidden h-36">
        {article.image_url ? (
          <img src={article.image_url} alt="" className="h-full w-full object-cover"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              img.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`h-full w-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center ${article.image_url ? 'hidden' : ''}`}>
          <span className="text-2xl opacity-20">🐦</span>
        </div>
      </div>

      <div className="p-4">
        {/* Top meta */}
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700">{article.source.name}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">
            {article.published_at
              ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true })
              : '—'}
          </span>
          <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="mb-3 text-sm font-bold leading-snug text-gray-900">
          {article.title}
        </h3>

        {/* Dual timestamps */}
        {article.approved_at && (
          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-gray-400">
            <span>Added</span>
            <span className="font-medium text-brand-600">
              {format(new Date(article.approved_at), 'MMM d · HH:mm')}
            </span>
            <span>by {article.approved_by || 'admin'}</span>
          </div>
        )}
        {article.rejection_reason && (
          <p className="mb-2 text-xs text-red-500">{article.rejection_reason}</p>
        )}

        {/* Quality bar */}
        <div className="mb-3">
          <QualityBar score={article.quality_score} />
        </div>

        {/* Flags */}
        {article.flags && article.flags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {article.flags.map((f) => (
              <span key={f} className="rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[10px] text-orange-600">{f}</span>
            ))}
          </div>
        )}

        {/* Summary */}
        {article.summary && (
          <p className="mb-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">{article.summary}</p>
        )}

        {/* Topic */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {article.topic && <TopicBadge topic={article.topic} />}
          <span className="ml-auto text-[10px] text-gray-300">#{article.id}</span>
        </div>

        {/* Raw content toggle */}
        {article.raw_content && (
          <div className="mb-3">
            <button onClick={() => setShowContent(!showContent)}
              className="text-[10px] font-medium text-gray-400 hover:text-gray-600 underline underline-offset-2">
              {showContent ? 'Hide' : 'Show'} raw content
            </button>
            {showContent && (
              <pre className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-gray-50 p-3 text-[10px] text-gray-600 whitespace-pre-wrap border border-gray-100">
                {article.raw_content}
              </pre>
            )}
          </div>
        )}

        {/* Action buttons */}
        {(onApprove || onReject) && (
          <div className="flex gap-2">
            {onApprove && (
              <button onClick={() => onApprove(article.id)}
                className="flex-1 rounded-lg bg-gray-900 py-2 text-xs font-bold text-white hover:bg-gray-700 transition">
                {article.status === 'rejected' || article.status === 'rejected_ai' ? 'Override & Publish' : 'Approve'}
              </button>
            )}
            {onReject && (
              <button onClick={() => onReject(article.id)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition">
                Reject
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main AdminQueue ───────────────────────────────────────────────────────────

type TabStatus = 'pending_human' | 'published' | 'rejected' | 'rejected_ai'

const TABS: { key: TabStatus; label: string; icon: string }[] = [
  { key: 'pending_human', label: 'Awaiting Review', icon: '⏳' },
  { key: 'published',     label: 'Published',       icon: '✓' },
  { key: 'rejected',      label: 'Rejected',        icon: '✗' },
  { key: 'rejected_ai',   label: 'AI Skipped',      icon: '⚡' },
]

export default function AdminQueue() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<TabStatus>('pending_human')
  const [showPanel, setShowPanel] = useState(false)

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['admin-queue', tab, page],
    queryFn: () => fetchQueue(page, tab),
  })

  const approveMut = useMutation({
    mutationFn: approveArticle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-queue'] }),
  })
  const rejectMut = useMutation({
    mutationFn: (id: number) => rejectArticle(id, 'Rejected by admin'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-queue'] }),
  })
  const scrapeMut = useMutation({
    mutationFn: triggerScrape,
    onSuccess: () => setShowPanel(true),
  })
  const digestMut = useMutation({ mutationFn: triggerDigest })

  function switchTab(t: TabStatus) { setTab(t); setPage(1) }

  return (
    <div className="min-h-screen">
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowPanel(false); qc.invalidateQueries({ queryKey: ['admin-queue'] }) }}
          />
          <ScrapePanel
            onClose={() => { setShowPanel(false); qc.invalidateQueries({ queryKey: ['admin-queue'] }) }}
            onDone={() => qc.invalidateQueries({ queryKey: ['admin-queue'] })}
          />
        </>
      )}

      {/* Admin header bar */}
      <div className="mb-8 rounded-2xl bg-gray-950 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Daily AI Bird</p>
            <h1 className="text-xl font-bold text-white">Moderation Queue</h1>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => digestMut.mutate()}
              disabled={digestMut.isPending}
              className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-40 transition"
            >
              {digestMut.isPending ? 'Generating…' : 'Generate Digest'}
            </button>
            <button
              onClick={() => scrapeMut.mutate('all')}
              disabled={scrapeMut.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
            >
              {scrapeMut.isPending ? 'Starting…' : '↓ Run Scrape'}
            </button>
          </div>
        </div>
      </div>

      {digestMut.isSuccess && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          Digest triggered. <a href="/admin/digests" className="font-semibold underline">Review →</a>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <EmptyState message={
          tab === 'pending_human' ? 'No articles awaiting review. Run Scrape to fetch new ones.'
          : tab === 'published'   ? 'No published articles yet.'
          : tab === 'rejected_ai' ? 'No AI-skipped articles.'
          : 'No rejected articles.'
        } />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleReviewCard
              key={a.id}
              article={a}
              onApprove={
                tab === 'pending_human' || tab === 'rejected' || tab === 'rejected_ai'
                  ? (id) => approveMut.mutate(id)
                  : undefined
              }
              onReject={tab === 'pending_human' ? (id) => rejectMut.mutate(id) : undefined}
            />
          ))}
        </div>
      )}

      {articles.length === 20 && (
        <div className="mt-8 flex justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="rounded-full border border-gray-200 px-5 py-2 text-sm disabled:opacity-40 hover:border-gray-400 transition">
            ← Previous
          </button>
          <button onClick={() => setPage(p => p + 1)}
            className="rounded-full border border-gray-200 px-5 py-2 text-sm hover:border-gray-400 transition">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
