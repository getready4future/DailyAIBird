import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format, formatDistanceToNow } from 'date-fns'
import { useArticle } from '../hooks/useArticles'
import Spinner from '../components/ui/Spinner'
import AIDisclosure from '../components/ui/AIDisclosure'
import NewsletterSignup from '../components/ui/NewsletterSignup'
import ShareButtons from '../components/articles/ShareButtons'
import { topicEmoji } from '../components/ui/TopicBadge'

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

function readingTime(text: string): number {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))  // 220 wpm
}

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: article, isLoading, error } = useArticle(Number(id))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error || !article) return <p className="py-10 text-center text-red-500">Article not found.</p>

  const paragraphs = article.summary?.split('\n').filter(Boolean) ?? []
  const lead = paragraphs[0]
  const rest = paragraphs.slice(1)
  const pageTitle = `${article.title} — Daily AI Bird`
  const description = paragraphs[0]?.slice(0, 160) ?? article.title
  const canonical = `https://dailyaibird.com/articles/${article.id}`
  const minutes = readingTime(article.summary || '')
  const topicLabel = article.topic ? (TOPIC_LABELS[article.topic] ?? article.topic.replace('_', ' ')) : null

  let sourceHost = ''
  try { sourceHost = new URL(article.source.url).hostname.replace('www.', '') } catch { /* noop */ }

  const newsArticleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description,
    image: article.image_url ? [article.image_url] : [],
    datePublished: article.published_at,
    dateModified: article.published_at,
    author: article.author
      ? [{ '@type': 'Person', name: article.author }]
      : [{ '@type': 'Organization', name: article.source.name }],
    publisher: {
      '@type': 'Organization',
      name: 'Daily AI Bird',
      url: 'https://dailyaibird.com',
      logo: { '@type': 'ImageObject', url: 'https://dailyaibird.com/bird-og.png' },
    },
    url: canonical,
    mainEntityOfPage: canonical,
    articleBody: article.summary || description,
    inLanguage: 'en',
    isAccessibleForFree: true,
    isBasedOn: article.url,
    articleSection: topicLabel ?? undefined,
    keywords: Array.isArray(article.tags) ? article.tags.join(', ') : undefined,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dailyaibird.com' },
      ...(article.topic ? [{ '@type': 'ListItem', position: 2, name: topicLabel, item: `https://dailyaibird.com/?topic=${article.topic}` }] : []),
      { '@type': 'ListItem', position: article.topic ? 3 : 2, name: article.title, item: canonical },
    ],
  }

  return (
    <article className="mx-auto max-w-reading fade-in-up">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        {article.image_url && <meta property="og:image" content={article.image_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={description} />
        {article.image_url && <meta name="twitter:image" content={article.image_url} />}
        <script type="application/ld+json">{JSON.stringify(newsArticleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      {/* Breadcrumb (subtle, mono) */}
      <nav className="mb-8 flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
        <Link to="/" className="hover:text-ink transition-colors">Home</Link>
        <span>/</span>
        {article.topic && (
          <>
            <Link to={`/?topic=${article.topic}`} className="hover:text-ink transition-colors">
              {topicLabel}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-ink-500 line-clamp-1 max-w-[280px] normal-case tracking-normal text-[12px]">
          {article.title}
        </span>
      </nav>

      {/* Topic eyebrow + reading time */}
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-brand-600">
        {article.topic && topicEmoji(article.topic) && (
          <span className="mr-1.5" aria-hidden>{topicEmoji(article.topic)}</span>
        )}
        {topicLabel ?? 'AI'}
        <span className="ml-2 text-ink-400">· {minutes} min read</span>
        {article.is_featured && <span className="ml-2 text-accent-700">· Featured</span>}
        {article.momentum_score >= 3 && (
          <span
            className="ml-2 text-accent-700"
            title={`Covered by ${article.momentum_score} of our trusted sources — a signal of significance, not a duplicate.`}
          >
            · Trending across {article.momentum_score} sources
          </span>
        )}
      </p>

      {/* Title — serif, semibold */}
      <h1 className="font-serif text-3xl md:text-[2.5rem] font-semibold leading-[1.15] tracking-tight text-ink">
        {article.title}
      </h1>

      {/* Standfirst (lead paragraph as drop-in deck) */}
      {lead && (
        <p className="mt-6 font-serif text-[19px] leading-[1.55] text-ink-700">
          {lead}
        </p>
      )}

      {/* Byline / meta row */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-paper-200 py-4 text-[13px] text-ink-500">
        <span className="flex items-center gap-1.5">
          {sourceHost && (
            <img
              src={`https://www.google.com/s2/favicons?domain=${sourceHost}&sz=32`}
              alt=""
              aria-hidden
              className="h-3.5 w-3.5 rounded-sm"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span className="text-ink-500">via</span>
          <a
            href={article.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink hover:text-brand-700 underline-grow"
          >
            {article.source.name}
          </a>
        </span>
        {article.author && (
          <>
            <span className="text-ink-300">·</span>
            <span>by {article.author}</span>
          </>
        )}
        {article.published_at && (
          <>
            <span className="text-ink-300">·</span>
            <time dateTime={article.published_at} className="font-mono text-[12px]">
              {format(new Date(article.published_at), 'MMM d, yyyy')}
              <span className="ml-1 text-ink-400">
                ({formatDistanceToNow(new Date(article.published_at), { addSuffix: true })})
              </span>
            </time>
          </>
        )}
      </div>

      {/* Hero image — under byline (Stratechery / MIT TR pattern) */}
      {article.image_url && (
        <div className="mt-8 overflow-hidden rounded-md">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full object-cover max-h-[460px]"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Body — serif prose */}
      {rest.length > 0 && (
        <div className="prose prose-lg max-w-none mt-8
                        prose-p:font-serif prose-p:text-[18px] prose-p:leading-[1.7] prose-p:text-ink-700
                        prose-headings:font-serif prose-a:text-brand-700">
          {rest.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-1.5">
          {article.tags.map((tag) => (
            <Link
              key={tag}
              to={`/?q=${tag}`}
              className="font-mono text-[11px] uppercase tracking-wider text-ink-500 hover:text-brand-700 transition border-b border-paper-200 hover:border-brand-300 pb-px"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Why this matters — plain-English context for general readers */}
      {(article.is_featured || article.momentum_score >= 3 || article.impact_score) && (
        <aside
          className="mt-10 rounded-md border-l-4 border-brand-500 bg-brand-50/40 px-5 py-4"
          aria-label="Why this matters"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-700 mb-1.5">
            Why we surfaced this
          </p>
          <p className="font-serif text-[15px] leading-[1.6] text-ink">
            {(() => {
              const reasons: string[] = []
              if (article.is_featured) reasons.push("our editors flagged it as the day's most consequential story")
              if (article.momentum_score >= 3) reasons.push(`${article.momentum_score} of our trusted sources covered it`)
              if (article.impact_score && article.impact_score >= 0.7) reasons.push('it has near-term consequences for many readers')
              if (reasons.length === 0) reasons.push('it cleared our quality gate for verifiable, novel reporting')
              return `We featured this because ${reasons.join(' and ')}.`
            })()}
          </p>
        </aside>
      )}

      {/* Share buttons */}
      <div className="mt-8">
        <ShareButtons
          url={canonical}
          title={article.title}
          source={article.source.name}
        />
      </div>

      {/* AI disclosure — AFTER body, not before */}
      <div className="mt-8">
        <AIDisclosure />
      </div>

      {/* Read Original CTA */}
      <div className="mt-8 rounded-md border border-paper-200 bg-paper-50 px-5 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-600 mb-1">
            Original Reporting
          </p>
          <p className="font-serif text-[16px] text-ink">
            Read the full story at <span className="font-semibold">{article.source.name}</span>
          </p>
          <p className="text-[12px] text-ink-500 mt-1">
            This is an AI-assisted summary · facts verified against the source
          </p>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper hover:bg-brand-700 transition-colors whitespace-nowrap"
        >
          Read Original →
        </a>
      </div>

      {/* Added to Daily AI Bird timestamp */}
      {article.approved_at && (
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 text-center">
          Added{' '}
          <time dateTime={article.approved_at}>
            {format(new Date(article.approved_at), 'MMM d, yyyy · HH:mm')}
          </time>
        </p>
      )}

      {/* Newsletter signup */}
      <div className="mt-12">
        <NewsletterSignup />
      </div>

      {/* Back + report row */}
      <div className="mt-12 flex items-center justify-between">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500 hover:text-ink transition">
          ← Back to feed
        </Link>
        <a
          href={`mailto:corrections@dailyaibird.com?subject=Error report: ${encodeURIComponent(article.title)}&body=Article URL: ${encodeURIComponent(article.url)}%0A%0AError description:%0A`}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 hover:text-ink transition underline-grow"
        >
          Report an error
        </a>
      </div>
    </article>
  )
}
