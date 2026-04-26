import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format } from 'date-fns'
import { useArticles } from '../hooks/useArticles'
import ArticleGrid from '../components/articles/ArticleGrid'
import ArticleFilters from '../components/articles/ArticleFilters'
import { topicLabel } from '../components/ui/TopicBadge'
import { ArticleGridSkeleton } from '../components/ui/Skeleton'
import NewsletterSignup from '../components/ui/NewsletterSignup'

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

  const today = format(new Date(), 'EEEE, MMMM d')

  return (
    <div className="fade-in-up">
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

      {/* Editorial masthead */}
      <header className="mb-10 border-b border-paper-200 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">{today}</p>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink leading-[1.05]">
              {topic ? `${topicLabel(topic)}` : "Today's AI News"}
            </h1>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-500">
              {topic
                ? `The latest in ${topicLabel(topic)}. Curated and summarised by AI, reviewed by humans.`
                : "The day's signal in 5 minutes. Curated by AI, reviewed by humans — no hype, no ads."}
            </p>
          </div>
          {data && (
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400 shrink-0">
              {data.total} {data.total === 1 ? 'story' : 'stories'}
            </span>
          )}
        </div>
      </header>

      <ArticleFilters />

      {isLoading ? (
        <ArticleGridSkeleton count={9} />
      ) : error ? (
        <p className="py-10 text-center text-red-500">Failed to load articles.</p>
      ) : (
        <>
          <ArticleGrid articles={data?.items ?? []} />

          {showPagination && (
            <nav className="mt-16 flex items-center justify-center gap-3">
              {page > 1 ? (
                <a
                  href={`/?page=${page - 1}${topic ? `&topic=${topic}` : ''}`}
                  onClick={(e) => { e.preventDefault(); setPage(page - 1) }}
                  className="rounded-md border border-paper-300 px-5 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-500 hover:border-ink hover:text-ink transition"
                >
                  ← Previous
                </a>
              ) : (
                <span className="rounded-md border border-paper-200 px-5 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-300 cursor-not-allowed">
                  ← Previous
                </span>
              )}
              <span className="font-mono text-[12px] tabular-nums text-ink-500">
                Page {page}
              </span>
              {data.has_next ? (
                <a
                  href={`/?page=${page + 1}${topic ? `&topic=${topic}` : ''}`}
                  onClick={(e) => { e.preventDefault(); setPage(page + 1) }}
                  className="rounded-md border border-paper-300 px-5 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-500 hover:border-ink hover:text-ink transition"
                >
                  Next →
                </a>
              ) : (
                <span className="rounded-md border border-paper-200 px-5 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-300 cursor-not-allowed">
                  Next →
                </span>
              )}
            </nav>
          )}

          {/* Newsletter banner — high-conversion moment, after first scroll */}
          {!isLoading && (data?.items.length ?? 0) > 0 && (
            <div className="mt-20">
              <NewsletterSignup variant="banner" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
