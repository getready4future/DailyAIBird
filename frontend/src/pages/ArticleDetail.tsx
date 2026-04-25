import { useParams, Link } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { useArticle } from '../hooks/useArticles'
import TopicBadge from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'
import AIDisclosure from '../components/ui/AIDisclosure'
import NewsletterSignup from '../components/ui/NewsletterSignup'

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: article, isLoading, error } = useArticle(Number(id))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error || !article) return <p className="py-10 text-center text-red-500">Article not found.</p>

  const paragraphs = article.summary?.split('\n').filter(Boolean) ?? []

  return (
    <div className="mx-auto max-w-2xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs text-gray-400">
        <Link to="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <span>›</span>
        {article.topic && (
          <>
            <Link to={`/?topic=${article.topic}`} className="hover:text-gray-600 transition-colors capitalize">
              {article.topic.replace('_', ' ')}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="text-gray-500 line-clamp-1 max-w-[300px]">{article.title}</span>
      </nav>

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
        {article.momentum_score >= 3 && (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-600">
            🔥 {article.momentum_score} sources covering this
          </span>
        )}
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
      <h1 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight text-gray-950 lg:text-4xl">
        {article.title}
      </h1>

      {/* Byline / meta row */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Source</span>
          <a
            href={article.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-800 hover:text-brand-600 transition-colors"
          >
            {article.source.name} ↗
          </a>
        </span>
        {article.author && (
          <>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">By</span>
              <span className="text-gray-700">{article.author}</span>
            </span>
          </>
        )}
        {article.published_at && (
          <>
            <span className="text-gray-300">·</span>
            <time dateTime={article.published_at} className="text-gray-500">
              {format(new Date(article.published_at), 'MMM d, yyyy')}
              <span className="ml-1 text-gray-400">
                ({formatDistanceToNow(new Date(article.published_at), { addSuffix: true })})
              </span>
            </time>
          </>
        )}
      </div>

      {/* AI disclosure */}
      <div className="mb-6">
        <AIDisclosure />
      </div>

      {/* Summary body */}
      {paragraphs.length > 0 && (
        <div className="mb-10 space-y-5 border-t border-gray-100 pt-6">
          {paragraphs.map((p, i) => (
            <p key={i} className={`leading-relaxed text-gray-700 ${
              i === 0 ? 'text-xl font-medium text-gray-900' : 'text-lg'
            }`}>
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <Link
              key={tag}
              to={`/?q=${tag}`}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Read Original CTA */}
      <div className="mb-8 rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-700">Read the full story at {article.source.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            This is an AI-assisted summary · original reporting by {article.source.name}
          </p>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 hover:border-brand-400 transition-colors"
        >
          Read Original →
        </a>
      </div>

      {/* Added to Daily AI Bird timestamp */}
      {article.approved_at && (
        <p className="mb-8 text-xs text-gray-400 text-center border-t border-gray-100 pt-5">
          Added to Daily AI Bird on{' '}
          <span className="font-medium text-brand-600">
            {format(new Date(article.approved_at), 'MMM d, yyyy · HH:mm')}
          </span>
        </p>
      )}

      {/* Newsletter signup */}
      <div className="mb-8">
        <NewsletterSignup />
      </div>

      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition">
        ← Back to feed
      </Link>
    </div>
  )
}
