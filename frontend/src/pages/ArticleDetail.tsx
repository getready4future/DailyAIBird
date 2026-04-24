import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useArticle } from '../hooks/useArticles'
import TopicBadge from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: article, isLoading, error } = useArticle(Number(id))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error || !article) return <p className="py-10 text-center text-red-500">Article not found.</p>

  const paragraphs = article.summary?.split('\n').filter(Boolean) ?? []

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition">
        ← Back to feed
      </Link>

      {/* Hero image */}
      {article.image_url && (
        <div className="mb-8 overflow-hidden rounded-2xl">
          <img
            src={article.image_url}
            alt=""
            className="w-full object-cover max-h-96"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Meta */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
        <span className="font-semibold text-gray-700">{article.source.name}</span>
        {article.published_at && (
          <>
            <span>·</span>
            <span>{format(new Date(article.published_at), 'MMM d, yyyy')}</span>
          </>
        )}
        {article.author && (
          <>
            <span>·</span>
            <span>{article.author}</span>
          </>
        )}
      </div>

      {/* Title */}
      <h1 className="mb-5 text-3xl font-bold leading-tight text-gray-900">{article.title}</h1>

      {/* Badges */}
      <div className="mb-7 flex flex-wrap gap-2">
        {article.topic && <TopicBadge topic={article.topic} />}
        {article.sentiment && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            article.sentiment === 'positive' ? 'bg-green-100 text-green-700'
            : article.sentiment === 'negative' ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-500'
          }`}>
            {article.sentiment}
          </span>
        )}
      </div>

      {/* Body */}
      {paragraphs.length > 0 && (
        <div className="mb-8 space-y-5">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed text-gray-700">{p}</p>
          ))}
        </div>
      )}

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="border-t border-gray-100 pt-6 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
