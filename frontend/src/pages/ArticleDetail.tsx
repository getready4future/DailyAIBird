import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useArticle } from '../hooks/useArticles'
import TopicBadge from '../components/ui/TopicBadge'
import ScoreBadge from '../components/articles/ScoreBadge'
import Spinner from '../components/ui/Spinner'

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: article, isLoading, error } = useArticle(Number(id))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error || !article) return <p className="py-10 text-center text-red-500">Article not found.</p>

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        ← Back to feed
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{article.source.name}</span>
        {article.published_at && (
          <span>· {format(new Date(article.published_at), 'MMM d, yyyy')}</span>
        )}
        {article.author && <span>· {article.author}</span>}
      </div>

      <h1 className="mb-4 text-2xl font-bold leading-tight text-gray-900">{article.title}</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {article.topic && <TopicBadge topic={article.topic} />}
        <ScoreBadge score={article.relevance_score} />
        {article.sentiment && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            article.sentiment === 'positive' ? 'bg-green-100 text-green-700'
            : article.sentiment === 'negative' ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-600'
          }`}>
            {article.sentiment}
          </span>
        )}
      </div>

      {article.summary && (
        <div className="mb-6 rounded-xl bg-brand-50 border border-brand-100 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
            AI Summary
          </h2>
          <p className="text-gray-800 leading-relaxed">{article.summary}</p>
        </div>
      )}

      {article.tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 transition"
      >
        Read Original Article
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  )
}
