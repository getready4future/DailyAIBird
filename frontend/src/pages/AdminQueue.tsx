import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fetchQueue, approveArticle, rejectArticle, triggerScrape, triggerDigest } from '../api/admin'
import type { ArticleAdmin } from '../types'
import TopicBadge from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'

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
        {article.is_scam && (
          <p className="text-xs text-red-600 font-medium">SCAM DETECTED: {article.scam_reason}</p>
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

  const scrapeMut = useMutation({ mutationFn: triggerScrape })
  const digestMut = useMutation({ mutationFn: triggerDigest })

  return (
    <div>
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
            {scrapeMut.isPending ? 'Running...' : 'Run Scrape'}
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
