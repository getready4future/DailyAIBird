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

  const { data, isLoading, error } = useArticles({ topic, sort, page, per_page: 21 })

  const setPage = (p: number) => {
    const next = new URLSearchParams(params)
    next.set('page', String(p))
    setParams(next)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Latest AI News</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-curated stories from the top sources, reviewed and published by humans
        </p>
      </div>

      <ArticleFilters />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <p className="py-10 text-center text-red-500">Failed to load articles.</p>
      ) : (
        <>
          <ArticleGrid articles={data?.items ?? []} />
          {data && data.total > 0 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} · {data.total} total
              </span>
              <button
                disabled={!data.has_next}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
