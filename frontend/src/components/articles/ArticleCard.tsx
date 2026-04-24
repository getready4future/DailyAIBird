import { Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import type { Article } from '../../types'
import TopicBadge from '../ui/TopicBadge'

type Variant = 'hero' | 'large' | 'default'

const TOPIC_GRADIENTS: Record<string, string> = {
  research:    'from-violet-600 to-indigo-700',
  products:    'from-blue-600 to-cyan-700',
  policy:      'from-slate-600 to-gray-700',
  business:    'from-emerald-600 to-teal-700',
  safety:      'from-amber-600 to-orange-700',
  open_source: 'from-green-600 to-emerald-700',
  tools:       'from-sky-600 to-blue-700',
  agents:      'from-purple-600 to-violet-700',
}

function TopicGradient({ topic, height = 'h-40' }: { topic?: string | null; height?: string }) {
  const grad = (topic && TOPIC_GRADIENTS[topic]) || 'from-brand-600 to-brand-900'
  return (
    <div className={`${height} w-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
      <span className="text-3xl opacity-30">🐦</span>
    </div>
  )
}

function TimeAgo({ date }: { date: string | null }) {
  if (!date) return null
  return <span>{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>
}

function DualTimestamp({ article }: { article: Article }) {
  const sourceDate = article.published_at
    ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true })
    : null
  const addedDate = article.approved_at
    ? format(new Date(article.approved_at), 'MMM d, HH:mm')
    : null

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
      {sourceDate && <span>{sourceDate}</span>}
      {sourceDate && addedDate && <span className="text-gray-600">·</span>}
      {addedDate && (
        <span className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-700 text-[10px] font-medium">
          Added {addedDate}
        </span>
      )}
    </div>
  )
}

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/articles/${article.id}`}
      className="group relative block h-full min-h-[460px] overflow-hidden rounded-2xl"
    >
      {article.image_url ? (
        <img
          src={article.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : null}
      <div className={`absolute inset-0 bg-gradient-to-br ${
        (article.topic && TOPIC_GRADIENTS[article.topic]) || 'from-brand-700 to-gray-950'
      } ${article.image_url ? 'opacity-0' : 'opacity-100'}`} />

      {/* deep gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

      {/* top badges */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        {article.is_featured && (
          <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold tracking-wide text-amber-900 uppercase">
            ★ Featured
          </span>
        )}
        {article.topic && <TopicBadge topic={article.topic} />}
      </div>

      {/* content block */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="mb-2.5 flex items-center gap-2 text-xs text-gray-300">
          <span className="font-semibold text-white">{article.source.name}</span>
          <span className="text-gray-600">·</span>
          <TimeAgo date={article.published_at} />
        </div>
        <h2 className="mb-3 text-2xl font-extrabold leading-tight text-white line-clamp-3 group-hover:text-brand-100 transition-colors lg:text-3xl">
          {article.title}
        </h2>
        {article.summary && (
          <p className="mb-3 text-sm leading-relaxed text-gray-300 line-clamp-2">{article.summary}</p>
        )}
        {article.approved_at && (
          <span className="inline-block rounded bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
            Added {format(new Date(article.approved_at), 'MMM d, HH:mm')}
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Large card ────────────────────────────────────────────────────────────────
function LargeCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/articles/${article.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition-all duration-300 h-full"
    >
      <div className="overflow-hidden relative">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              img.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`${article.image_url ? 'hidden' : ''}`}>
          <TopicGradient topic={article.topic} height="h-52" />
        </div>
        {article.topic && (
          <div className="absolute bottom-3 left-3">
            <TopicBadge topic={article.topic} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2.5 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="font-semibold text-gray-700">{article.source.name}</span>
          <span>·</span>
          <TimeAgo date={article.published_at} />
        </div>
        <h2 className="mb-2 text-base font-bold leading-snug text-gray-900 line-clamp-2 group-hover:text-brand-600 transition-colors">
          {article.title}
        </h2>
        {article.summary && (
          <p className="flex-1 text-sm text-gray-500 line-clamp-2 leading-relaxed">{article.summary}</p>
        )}
        <div className="mt-3 pt-3 border-t border-gray-50">
          <DualTimestamp article={article} />
        </div>
      </div>
    </Link>
  )
}

// ── Default card ──────────────────────────────────────────────────────────────
function DefaultCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/articles/${article.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="overflow-hidden">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            className="h-40 w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              img.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={`${article.image_url ? 'hidden' : ''}`}>
          <TopicGradient topic={article.topic} height="h-40" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="font-medium text-gray-600">{article.source.name}</span>
          <span>·</span>
          <TimeAgo date={article.published_at} />
        </div>
        <h2 className="flex-1 text-sm font-bold leading-snug text-gray-900 line-clamp-3 group-hover:text-brand-600 transition-colors">
          {article.title}
        </h2>
        <div className="mt-3 flex items-center justify-between gap-2">
          {article.topic && <TopicBadge topic={article.topic} />}
          {article.approved_at && (
            <span className="text-[10px] text-gray-400 shrink-0">
              {format(new Date(article.approved_at), 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function ArticleCard({ article, variant = 'default' }: { article: Article; variant?: Variant }) {
  if (variant === 'hero')  return <HeroCard article={article} />
  if (variant === 'large') return <LargeCard article={article} />
  return <DefaultCard article={article} />
}
