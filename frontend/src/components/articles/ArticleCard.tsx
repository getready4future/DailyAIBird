import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { Article } from '../../types'
import TopicBadge from '../ui/TopicBadge'

type Variant = 'hero' | 'large' | 'default'

function TimeAgo({ date }: { date: string | null }) {
  if (!date) return null
  return (
    <span>{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
  )
}

// ── Hero card: full-bleed image with gradient overlay ────────────────────────
function HeroCard({ article }: { article: Article }) {
  return (
    <Link to={`/articles/${article.id}`} className="group relative block h-full min-h-[340px] overflow-hidden rounded-2xl">
      {article.image_url ? (
        <img
          src={article.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-900" />
      )}
      {/* gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* top meta */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        {article.is_featured && (
          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-900">★ Featured</span>
        )}
        {article.topic && <TopicBadge topic={article.topic} />}
      </div>

      {/* bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-300">
          <span className="font-medium text-white">{article.source.name}</span>
          <span>·</span>
          <TimeAgo date={article.published_at} />
        </div>
        <h2 className="text-xl font-bold leading-snug text-white line-clamp-3 group-hover:text-brand-200 transition">
          {article.title}
        </h2>
        {article.summary && (
          <p className="mt-2 text-sm text-gray-300 line-clamp-2">{article.summary}</p>
        )}
      </div>
    </Link>
  )
}

// ── Large card: image top, rich text below ───────────────────────────────────
function LargeCard({ article }: { article: Article }) {
  return (
    <Link to={`/articles/${article.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow h-full">
      {article.image_url && (
        <div className="overflow-hidden">
          <img
            src={article.image_url}
            alt=""
            className="h-48 w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
          <span className="font-medium text-gray-600">{article.source.name}</span>
          <span>·</span>
          <TimeAgo date={article.published_at} />
        </div>
        <h2 className="mb-2 text-base font-bold leading-snug text-gray-900 line-clamp-2 group-hover:text-brand-600 transition">
          {article.title}
        </h2>
        {article.summary && (
          <p className="text-sm text-gray-500 line-clamp-2 flex-1">{article.summary}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {article.topic && <TopicBadge topic={article.topic} />}
          {article.is_featured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">★ Featured</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Default card: compact ────────────────────────────────────────────────────
function DefaultCard({ article }: { article: Article }) {
  return (
    <Link to={`/articles/${article.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
      {article.image_url && (
        <div className="overflow-hidden">
          <img
            src={article.image_url}
            alt=""
            className="h-36 w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}
      <div className="p-4">
        <div className="mb-1.5 flex items-center gap-2 text-xs text-gray-400">
          <span className="font-medium text-gray-500">{article.source.name}</span>
          <span>·</span>
          <TimeAgo date={article.published_at} />
        </div>
        <h2 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-brand-600 transition">
          {article.title}
        </h2>
        {article.topic && (
          <div className="mt-2">
            <TopicBadge topic={article.topic} />
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Public export ────────────────────────────────────────────────────────────
export default function ArticleCard({ article, variant = 'default' }: { article: Article; variant?: Variant }) {
  if (variant === 'hero')    return <HeroCard article={article} />
  if (variant === 'large')   return <LargeCard article={article} />
  return <DefaultCard article={article} />
}
