import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import type { Article } from '../../types'

type Variant = 'hero' | 'large' | 'default' | 'text-list'

const TOPIC_GRADIENTS: Record<string, string> = {
  research:    'from-brand-700 to-ink',
  products:    'from-brand-600 to-brand-900',
  policy:      'from-ink-700 to-ink',
  business:    'from-brand-500 to-brand-800',
  safety:      'from-accent-500 to-accent-700',
  open_source: 'from-brand-400 to-brand-700',
  tools:       'from-brand-500 to-brand-800',
  agents:      'from-brand-600 to-ink',
}

const TOPIC_LABELS: Record<string, string> = {
  research: 'Research',
  products: 'Products',
  policy: 'Policy',
  business: 'Business',
  safety: 'Safety',
  open_source: 'Open Source',
  tools: 'Tools',
  agents: 'Agents',
}

const TOPIC_EMOJI: Record<string, string> = {
  research: '🔬',
  products: '🚀',
  policy: '📋',
  business: '💼',
  safety: '🛡️',
  open_source: '📦',
  tools: '🔧',
  agents: '🤖',
}

function TrendingBadge({ momentum }: { momentum: number }) {
  if (!momentum || momentum < 3) return null
  return (
    <span
      className="ml-2 text-accent-700"
      title={`Covered by ${momentum} of our trusted sources — a signal of significance, not a duplicate.`}
    >
      · Trending across {momentum} sources
    </span>
  )
}

function TopicEyebrow({ topic, momentum }: { topic?: string | null; momentum?: number }) {
  const label = topic ? (TOPIC_LABELS[topic] ?? topic.replace('_', ' ')) : 'AI'
  const emoji = topic ? TOPIC_EMOJI[topic] : undefined
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-600">
      {emoji && <span className="mr-1.5 not-italic" aria-hidden>{emoji}</span>}
      {label}
      <TrendingBadge momentum={momentum ?? 0} />
    </p>
  )
}

function TopicTexture({ topic, height = 'h-40' }: { topic?: string | null; height?: string }) {
  const grad = (topic && TOPIC_GRADIENTS[topic]) || 'from-brand-700 to-ink'
  return (
    <div className={`relative ${height} w-full bg-gradient-to-br ${grad} overflow-hidden`}>
      <div className="absolute inset-0 bg-dot-grid opacity-60" />
      <span className="absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/70">
        {topic ?? 'ai'}
      </span>
    </div>
  )
}

function SourceLine({ article }: { article: Article }) {
  let host = ''
  try { host = new URL(article.source.url).hostname.replace('www.', '') } catch { /* noop */ }
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-ink-500">
      {host && (
        <img
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
          alt=""
          aria-hidden
          loading="lazy"
          className="h-3.5 w-3.5 rounded-sm shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-500">
        {article.source.name}
      </span>
      {article.published_at && (
        <>
          <span className="text-ink-300">·</span>
          <span className="text-[11px] text-ink-400">
            {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
          </span>
        </>
      )}
    </div>
  )
}

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ article }: { article: Article }) {
  return (
    <Link
      to={`/articles/${article.id}`}
      className="group relative block h-full min-h-[360px] sm:min-h-[420px] overflow-hidden rounded-md"
    >
      {article.image_url ? (
        <img
          src={article.image_url}
          alt={article.title}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <TopicTexture topic={article.topic} height="absolute inset-0 h-full" />
      )}

      {/* Deep gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/40 to-transparent" />

      {/* Featured ribbon (top-left) */}
      {article.is_featured && (
        <div className="absolute left-5 top-5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-400">
          ★ Featured
        </div>
      )}

      {/* Content (bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-200">
          {article.topic && TOPIC_EMOJI[article.topic] && (
            <span className="mr-1.5" aria-hidden>{TOPIC_EMOJI[article.topic]}</span>
          )}
          {article.topic ? (TOPIC_LABELS[article.topic] ?? article.topic) : 'AI'}
          {article.momentum_score >= 3 && (
            <span
              className="ml-2 text-accent-400"
              title={`Covered by ${article.momentum_score} of our trusted sources — a signal of significance, not a duplicate.`}
            >
              · Trending across {article.momentum_score} sources
            </span>
          )}
        </p>
        <h2 className="mb-3 font-serif text-2xl sm:text-3xl lg:text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-paper">
          {article.title}
        </h2>
        {article.summary && (
          <p className="mb-3 font-serif text-[15px] leading-[1.55] text-paper/80 line-clamp-2">
            {article.summary}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[12px] text-paper/60">
          <span className="font-mono text-[11px] uppercase tracking-wider text-paper/70">
            {article.source.name}
          </span>
          {article.published_at && (
            <>
              <span className="text-paper/40">·</span>
              <span className="text-[11px] text-paper/60">
                {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Large card ────────────────────────────────────────────────────────────────
function LargeCard({ article }: { article: Article }) {
  return (
    <article className="group flex flex-col h-full">
      <Link to={`/articles/${article.id}`} className="block overflow-hidden rounded-md mb-4">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt={article.title}
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              img.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={article.image_url ? 'hidden' : ''}>
          <TopicTexture topic={article.topic} height="aspect-[16/10] w-full" />
        </div>
      </Link>

      <TopicEyebrow topic={article.topic} momentum={article.momentum_score} />
      <Link
        to={`/articles/${article.id}`}
        className="mt-1.5 font-serif text-xl font-semibold leading-tight text-ink line-clamp-3 transition-colors group-hover:text-brand-700"
      >
        {article.title}
      </Link>
      {article.summary && (
        <p className="mt-2 font-serif text-[15px] leading-[1.55] text-ink-500 line-clamp-2">
          {article.summary}
        </p>
      )}
      <div className="mt-3 pt-3 border-t border-paper-200">
        <SourceLine article={article} />
      </div>
    </article>
  )
}

// ── Default card (most cards in grid) ─────────────────────────────────────────
function DefaultCard({ article }: { article: Article }) {
  return (
    <article className="group flex flex-col h-full">
      <Link to={`/articles/${article.id}`} className="block overflow-hidden rounded-md mb-3">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt={article.title}
            className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.style.display = 'none'
              img.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div className={article.image_url ? 'hidden' : ''}>
          <TopicTexture topic={article.topic} height="aspect-[4/3] w-full" />
        </div>
      </Link>

      <TopicEyebrow topic={article.topic} momentum={article.momentum_score} />
      <Link
        to={`/articles/${article.id}`}
        className="mt-1.5 flex-1 font-serif text-[17px] font-semibold leading-snug text-ink line-clamp-3 transition-colors group-hover:text-brand-700"
      >
        {article.title}
      </Link>
      <div className="mt-3 pt-3 border-t border-paper-200">
        <SourceLine article={article} />
      </div>
    </article>
  )
}

// ── Text-list card (sidebar / digest list) ────────────────────────────────────
function TextListCard({ article }: { article: Article }) {
  return (
    <article className="group py-5 first:pt-0 last:pb-0">
      <TopicEyebrow topic={article.topic} momentum={article.momentum_score} />
      <Link
        to={`/articles/${article.id}`}
        className="mt-1.5 block font-serif text-[18px] font-semibold leading-snug text-ink line-clamp-3 transition-colors group-hover:text-brand-700"
      >
        {article.title}
      </Link>
      <div className="mt-2.5">
        <SourceLine article={article} />
      </div>
    </article>
  )
}

export default function ArticleCard({
  article, variant = 'default',
}: { article: Article; variant?: Variant }) {
  if (variant === 'hero')      return <HeroCard article={article} />
  if (variant === 'large')     return <LargeCard article={article} />
  if (variant === 'text-list') return <TextListCard article={article} />
  return <DefaultCard article={article} />
}
