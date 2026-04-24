import { useSearchParams } from 'react-router-dom'
import { useArticles } from '../hooks/useArticles'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleFilters from '../components/articles/ArticleFilters'
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
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-widest text-brand-600 uppercase">AI News</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">Today's Feed</h1>
        </div>
        {data && (
          <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
            {data.total} stories
          </span>
        )}
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
