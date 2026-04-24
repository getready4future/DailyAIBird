import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
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
  image_url?: string
}

function StatusPill({ kind, decision }: { kind: string; decision?: string }) {
  if (kind === 'found')
    return <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs text-blue-300">Bulundu</span>
  if (kind === 'publish' || decision === 'publish')
    return <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs text-emerald-300">Yayınlandı</span>
  if (kind === 'caution' || decision === 'publish_with_caution')
    return <span className="rounded-full bg-yellow-900 px-2 py-0.5 text-xs text-yellow-300">İncelenmeli</span>
  if (kind === 'error')
    return <span className="rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-300">Hata</span>
  return null
}

function ArticleEventCard({ event }: { event: ScrapeEvent }) {
  const isArticle = event.kind === 'found' || event.kind === 'publish' || event.kind === 'caution'

  if (!isArticle) {
    // System message (scrape summary, info, done, error)
    const color =
      event.kind === 'scrape' ? 'text-blue-400' :
      event.kind === 'done'   ? 'text-emerald-300 font-semibold' :
      event.kind === 'error'  ? 'text-red-400' :
      'text-gray-500'
    return (
      <div className={`flex items-center gap-2 px-1 py-1.5 text-xs ${color}`}>
        <span className="shrink-0">
          {event.kind === 'scrape' ? '↓' : event.kind === 'done' ? '🎉' : event.kind === 'error' ? '✗' : '·'}
        </span>
        <span>{event.message}</span>
      </div>
    )
  }

  return (
    <div className="flex gap-3 rounded-lg bg-gray-900 p-3 border border-gray-800">
      {event.image_url && (
        <img
          src={event.image_url}
          alt=""
          className="h-14 w-20 shrink-0 rounded object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {event.source && (
            <span className="text-xs font-medium text-gray-400">{event.source}</span>
          )}
          <StatusPill kind={event.kind} decision={event.decision} />
          {event.topic && (
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{event.topic}</span>
          )}
          {event.confidence !== undefined && (
            <span className="text-xs text-gray-600">güven {event.confidence}/5</span>
          )}
        </div>
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-100 leading-snug line-clamp-2 hover:text-white hover:underline"
        >
          {event.message}
        </a>
      </div>
    </div>
  )
}

function ScrapePanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [events, setEvents] = useState<ScrapeEvent[]>([])
  const [done, setDone] = useState(false)
  const [counts, setCounts] = useState({ found: 0, published: 0, caution: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = `${BASE_URL}/api/v1/admin/scrape-events?token=${encodeURIComponent(ADMIN_TOKEN)}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      const event: ScrapeEvent = JSON.parse(e.data)
      setEvents((prev) => [...prev, event])
      setCounts((prev) => ({
        found:     prev.found     + (event.kind === 'found'   ? 1 : 0),
        published: prev.published + (event.kind === 'publish' ? 1 : 0),
        caution:   prev.caution   + (event.kind === 'caution' ? 1 : 0),
      }))
      if (event.kind === 'done') {
        setDone(true)
        es.close()
        onDone()
      }
    }

    es.onerror = () => {
      setEvents((prev) => [...prev, { message: 'Bağlantı kesildi.', kind: 'error', ts: Date.now() / 1000 }])
      es.close()
    }

    return () => es.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-gray-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-3">
          {!done && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
          <span className="text-sm font-semibold text-white">
            {done ? 'Scraping tamamlandı' : 'Haberler taranıyor…'}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>

      {/* Stats bar */}
      {(counts.found > 0 || counts.published > 0 || counts.caution > 0) && (
        <div className="flex gap-4 border-b border-gray-800 px-5 py-2 text-xs">
          <span className="text-blue-400">{counts.found} bulundu</span>
          <span className="text-emerald-400">{counts.published} onaylandı</span>
          {counts.caution > 0 && <span className="text-yellow-400">{counts.caution} incelenmeli</span>}
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {events.length === 0 && !done && (
          <p className="text-xs text-gray-600">Bağlanıyor…</p>
        )}
        {events.map((ev, i) => (
          <ArticleEventCard key={i} event={ev} />
        ))}
        <div ref={bottomRef} />
      </div>

      {done && (
        <div className="border-t border-gray-800 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  )
}

function QualityBar({ score }: { score: number | null }) {
  if (score === null) return null
  const pct = Math.round(score * 100)
  const color = score >= 0.75 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600">
      <span className="w-14">Quality</span>
      <div className="h-1.5 w-24 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  )
}

function ArticleReviewCard({ article, onApprove, onReject }: {
  article: ArticleAdmin
  onApprove?: (id: number) => void
  onReject?: (id: number) => void
}) {
  const [showContent, setShowContent] = useState(false)
  const timeAgo = article.published_at
    ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true })
    : '—'

  const statusBadge = article.status === 'published'
    ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">✓ Yayınlandı</span>
    : article.status === 'rejected'
    ? <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">✗ Reddedildi</span>
    : null

  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${
      article.status === 'published' ? 'border-emerald-200'
      : article.status === 'rejected' ? 'border-red-200'
      : 'border-gray-200'
    }`}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{article.source.name}</span>
        <span>· {timeAgo}</span>
        {statusBadge}
        <span className="ml-auto">ID #{article.id}</span>
      </div>

      <h3 className="mb-3 text-base font-semibold text-gray-900 leading-snug">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
          {article.title}
        </a>
      </h3>

      {article.status === 'published' && article.approved_at && (
        <p className="mb-2 text-xs text-emerald-600">
          Onaylandı: {formatDistanceToNow(new Date(article.approved_at), { addSuffix: true })}
          {article.approved_by ? ` · ${article.approved_by}` : ''}
        </p>
      )}
      {article.status === 'rejected' && article.rejection_reason && (
        <p className="mb-2 text-xs text-red-500">Sebep: {article.rejection_reason}</p>
      )}

      <div className="mb-3 space-y-1.5">
        <QualityBar score={article.quality_score} />
        {article.flags && article.flags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.flags.map((f) => (
              <span key={f} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{f}</span>
            ))}
          </div>
        )}
      </div>

      {article.summary && (
        <p className="mb-3 text-sm text-gray-600 line-clamp-2">{article.summary}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {article.topic && <TopicBadge topic={article.topic} />}
        {article.relevance_score !== null && (
          <span className="text-xs text-gray-500">Relevance: {Math.round((article.relevance_score || 0) * 100)}%</span>
        )}
      </div>

      {article.raw_content && (
        <div className="mb-4">
          <button
            onClick={() => setShowContent(!showContent)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showContent ? 'Hide' : 'Show'} raw content
          </button>
          {showContent && (
            <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
              {article.raw_content}
            </pre>
          )}
        </div>
      )}

      {(onApprove || onReject) && (
        <div className="flex gap-3">
          {onApprove && (
            <button
              onClick={() => onApprove(article.id)}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              {article.status === 'rejected' ? 'Geri Al & Yayınla' : 'Onayla & Yayınla'}
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(article.id)}
              className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
            >
              Reddet
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type TabStatus = 'pending_human' | 'published' | 'rejected'

const TABS: { key: TabStatus; label: string }[] = [
  { key: 'pending_human', label: 'Bekliyor' },
  { key: 'published',     label: 'Yayınlandı' },
  { key: 'rejected',      label: 'Reddedildi' },
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

  function switchTab(t: TabStatus) {
    setTab(t)
    setPage(1)
  }

  return (
    <div>
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowPanel(false)} />
          <ScrapePanel
            onClose={() => setShowPanel(false)}
            onDone={() => qc.invalidateQueries({ queryKey: ['admin-queue'] })}
          />
        </>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Moderation Queue</h1>
        <div className="flex gap-3">
          <button
            onClick={() => digestMut.mutate()}
            disabled={digestMut.isPending}
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition"
          >
            {digestMut.isPending ? 'Generating...' : 'Generate Digest'}
          </button>
          <button
            onClick={() => scrapeMut.mutate('all')}
            disabled={scrapeMut.isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 transition"
          >
            {scrapeMut.isPending ? 'Starting...' : 'Run Scrape'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {digestMut.isSuccess && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
          Digest generation triggered. Go to <a href="/admin/digests" className="underline">Digest Review</a> to approve.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <EmptyState message={
          tab === 'pending_human' ? 'Queue is empty — no articles pending review.'
          : tab === 'published' ? 'Henüz yayınlanmış makale yok.'
          : 'Henüz reddedilmiş makale yok.'
        } />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleReviewCard
              key={a.id}
              article={a}
              onApprove={tab === 'pending_human' || tab === 'rejected' ? (id) => approveMut.mutate(id) : undefined}
              onReject={tab === 'pending_human' ? (id) => rejectMut.mutate(id) : undefined}
            />
          ))}
        </div>
      )}

      {articles.length === 20 && (
        <div className="mt-6 flex justify-center gap-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
          <button onClick={() => setPage(p => p + 1)} className="rounded-lg border px-4 py-2 text-sm">Next</button>
        </div>
      )}
    </div>
  )
}
