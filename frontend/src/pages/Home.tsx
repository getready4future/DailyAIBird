import { useSearchParams } from 'react-router-dom'
import { useArticles } from '../hooks/useArticles'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleFilters from '../components/articles/ArticleFilters'
import { topicLabel } from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'

export default function Home() {
  const [params, setParams] = useSearchParams()
  const topic = params.get('topic') || undefined
  const sort = (params.get('sort') as 'relevance' | 'date') || 'relevance'
  const page = Number(params.get('page') || '1')

  const { data, isLoading, error } = useArticles({ topic, sort, page, per_page: 20 })

  const setPage = (p: number) => {
    const next = new URLSearchParams(params)
    next.set('page', String(p))
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showPagination = data && (page > 1 || data.has_next)

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 border-b border-gray-100 pb-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase">
                🤖 AI-Assisted
              </span>
              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-green-700 uppercase">
                ✓ Editor-Reviewed
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">
              {topic ? `${topicLabel(topic)} News` : "Today's AI News"}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Surfaced, summarised, and scored — updated continuously
            </p>
          </div>
          {data && (
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
              {data.total} stories
            </span>
          )}
        </div>
      </div>

      <div className="mb-7">
        <ArticleFilters />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : error ? (
        <p className="py-10 text-center text-red-500">Failed to load articles.</p>
      ) : (
        <>
          <ArticleGrid articles={data?.items ?? []} />

          {showPagination && (
            <div className="mt-12 flex items-center justify-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 disabled:opacity-30 transition"
              >
                ← Previous
              </button>
              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                {page}
              </span>
              <button
                disabled={!data.has_next}
                onClick={() => setPage(page + 1)}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 disabled:opacity-30 transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
