import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
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

  const pageTitle = topic
    ? `${topicLabel(topic)} AI News — Daily AI Bird`
    : 'Daily AI Bird — AI News, Curated & Scored'
  const description = topic
    ? `The latest ${topicLabel(topic)} AI news, summarised and scored by relevance.`
    : 'The most important AI news of the day — surfaced, summarised, and scored. Updated continuously.'

  return (
    <div>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`https://dailyaibird.com/${topic ? `?topic=${topic}` : ''}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        {page > 1 && <link rel="prev" href={`https://dailyaibird.com/?page=${page - 1}${topic ? `&topic=${topic}` : ''}`} />}
        {data?.has_next && <link rel="next" href={`https://dailyaibird.com/?page=${page + 1}${topic ? `&topic=${topic}` : ''}`} />}
      </Helmet>
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
              Surfaced, summarised, and scored by AI · reviewed by humans
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
              {page > 1 ? (
                <a
                  href={`/?page=${page - 1}${topic ? `&topic=${topic}` : ''}`}
                  onClick={(e) => { e.preventDefault(); setPage(page - 1) }}
                  className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 transition"
                >
                  ← Previous
                </a>
              ) : (
                <span className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-300 cursor-not-allowed">
                  ← Previous
                </span>
              )}
              <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700">
                {page}
              </span>
              {data.has_next ? (
                <a
                  href={`/?page=${page + 1}${topic ? `&topic=${topic}` : ''}`}
                  onClick={(e) => { e.preventDefault(); setPage(page + 1) }}
                  className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 transition"
                >
                  Next →
                </a>
              ) : (
                <span className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium text-gray-300 cursor-not-allowed">
                  Next →
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
