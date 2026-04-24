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

  const paragraphs = article.summary?.split('\n').filter(Boolean) ?? []

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
        ← Back to feed
      </Link>

      {article.image_url && (
        <img
          src={article.image_url}
          alt=""
          className="mb-6 w-full rounded-xl object-cover max-h-72"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      )}

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

      {paragraphs.length > 0 && (
        <div className="prose prose-gray max-w-none mb-6">
          {paragraphs.map((p, i) => (
            <p key={i} className="mb-4 text-gray-800 leading-relaxed">{p}</p>
          ))}
        </div>
      )}

      {article.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
