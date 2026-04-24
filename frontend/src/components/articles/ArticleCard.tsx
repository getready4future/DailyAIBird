import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { Article } from '../../types'
import TopicBadge from '../ui/TopicBadge'
import ScoreBadge from './ScoreBadge'

export default function ArticleCard({ article }: { article: Article }) {
  const timeAgo = article.published_at
    ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true })
    : null

  return (
    <article
      className={`rounded-xl border bg-white shadow-sm transition hover:shadow-md overflow-hidden ${
        article.is_featured ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
      }`}
    >
      {article.image_url && (
        <img
          src={article.image_url}
          alt=""
          className="w-full h-44 object-cover"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      )}

      <div className="p-5">
        {article.is_featured && (
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-amber-600">
            <span>★</span> Featured
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{article.source.name}</span>
          {timeAgo && <span>· {timeAgo}</span>}
        </div>

        <h2 className="mb-2 text-base font-semibold leading-snug text-gray-900 line-clamp-2">
          <Link to={`/articles/${article.id}`} className="hover:text-brand-600">
            {article.title}
          </Link>
        </h2>

        {article.summary && (
          <p className="mb-3 text-sm text-gray-600 line-clamp-2">{article.summary}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {article.topic && <TopicBadge topic={article.topic} />}
          <ScoreBadge score={article.relevance_score} />
          <Link
            to={`/articles/${article.id}`}
            className="ml-auto text-xs text-brand-600 hover:underline"
          >
            Oku →
          </Link>
        </div>
      </div>
    </article>
  )
}
