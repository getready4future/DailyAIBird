import { useParams, Link } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
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
        <div className="mb-8 overflow-hidden rounded-2xl shadow-lg">
          <img
            src={article.image_url}
            alt=""
            className="w-full object-cover max-h-[420px]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Topic + sentiment */}
      <div className="mb-4 flex flex-wrap gap-2">
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

      {/* Title */}
      <h1 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight text-gray-950">
        {article.title}
      </h1>

      {/* Meta row */}
      <div className="mb-8 flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-gray-100 pb-6">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">Source</p>
          <p className="text-sm font-semibold text-gray-800">{article.source.name}</p>
        </div>
        {article.author && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">Author</p>
            <p className="text-sm text-gray-700">{article.author}</p>
          </div>
        )}
        {article.published_at && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">Originally Published</p>
            <p className="text-sm text-gray-700">
              {format(new Date(article.published_at), 'MMM d, yyyy')}
              <span className="ml-1.5 text-gray-400">
                ({formatDistanceToNow(new Date(article.published_at), { addSuffix: true })})
              </span>
            </p>
          </div>
        )}
        {article.approved_at && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-brand-600 uppercase mb-0.5">Added to Daily AI Bird</p>
            <p className="text-sm font-medium text-brand-700">
              {format(new Date(article.approved_at), 'MMM d, yyyy · HH:mm')}
            </p>
          </div>
        )}
      </div>

      {/* Body */}
      {paragraphs.length > 0 && (
        <div className="mb-10 space-y-5">
          {paragraphs.map((p, i) => (
            <p key={i} className={`leading-relaxed text-gray-700 ${i === 0 ? 'text-xl font-medium text-gray-900' : 'text-lg'}`}>
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="border-t border-gray-100 pt-6 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 transition">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
