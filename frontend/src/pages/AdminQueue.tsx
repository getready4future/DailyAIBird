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

type LogEvent = { message: string; kind: string; ts: number }

function kindStyle(kind: string) {
  switch (kind) {
    case 'publish':    return 'text-emerald-400'
    case 'caution':    return 'text-yellow-400'
    case 'scrape':     return 'text-blue-400'
    case 'error':      return 'text-red-400'
    case 'done':       return 'text-emerald-300 font-bold'
    default:           return 'text-gray-400'
  }
}

function kindPrefix(kind: string) {
  switch (kind) {
    case 'publish':  return '✓'
    case 'caution':  return '⚠'
    case 'scrape':   return '↓'
    case 'error':    return '✗'
    case 'done':     return '🎉'
    default:         return '·'
  }
}

function ScrapePanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [done, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = `${BASE_URL}/api/v1/admin/scrape-events?token=${encodeURIComponent(ADMIN_TOKEN)}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      const event: LogEvent = JSON.parse(e.data)
      setLogs((prev) => [...prev, event])
      if (event.kind === 'done') {
        setDone(true)
        es.close()
        onDone()
      }
    }

    es.onerror = () => {
      setLogs((prev) => [...prev, { message: 'Bağlantı kesildi.', kind: 'error', ts: Date.now() / 1000 }])
      es.close()
    }

    return () => es.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-gray-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-2">
          {!done && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />}
          <span className="text-sm font-semibold text-white">
            {done ? 'Tamamlandı' : 'Scraping çalışıyor…'}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <span className="text-gray-600 shrink-0">
              {new Date(log.ts * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`shrink-0 ${kindStyle(log.kind)}`}>{kindPrefix(log.kind)}</span>
            <span className={kindStyle(log.kind)}>{log.message}</span>
          </div>
        ))}
        {!done && logs.length === 0 && (
          <p className="text-gray-600">Bağlanıyor…</p>
        )}
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
  onApprove: (id: number) => void
  onReject: (id: number) => void
}) {
  const [showContent, setShowContent] = useState(false)
  const timeAgo = article.published_at
    ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true })
    : '—'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{article.source.name}</span>
        <span>· {timeAgo}</span>
        <span className="ml-auto">ID #{article.id}</span>
      </div>

      <h3 className="mb-3 text-base font-semibold text-gray-900 leading-snug">
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
          {article.title}
        </a>
      </h3>

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

      <div className="flex gap-3">
        <button
          onClick={() => onApprove(article.id)}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          Approve & Publish
        </button>
        <button
          onClick={() => onReject(article.id)}
          className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

export default function AdminQueue() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showPanel, setShowPanel] = useState(false)

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['admin-queue', page],
    queryFn: () => fetchQueue(page),
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

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moderation Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review AI-analyzed articles before publishing. {articles.length} pending.
          </p>
        </div>
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

      {digestMut.isSuccess && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
          Digest generation triggered. Go to <a href="/admin/digests" className="underline">Digest Review</a> to approve.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <EmptyState message="Queue is empty — no articles pending review." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleReviewCard
              key={a.id}
              article={a}
              onApprove={(id) => approveMut.mutate(id)}
              onReject={(id) => rejectMut.mutate(id)}
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
