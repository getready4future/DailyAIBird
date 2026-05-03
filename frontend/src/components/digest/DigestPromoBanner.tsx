import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useTodayDigest } from '../../hooks/useDigest'

/**
 * Promo strip pointing readers from the homepage to today's digest.
 * Renders nothing if there is no published digest yet for today — keeps
 * the homepage honest rather than promoting empty content.
 */
export default function DigestPromoBanner() {
  const { data: digest } = useTodayDigest()

  if (!digest) return null

  const today = format(new Date(digest.digest_date), 'EEEE, MMM d')
  const stories = digest.article_count

  return (
    <Link
      to={`/digest`}
      className="group mb-10 flex flex-col gap-3 rounded-md border border-paper-200 bg-paper-50 px-5 py-4 transition hover:border-ink sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-600">
          📧 Today's Briefing · {today}
        </p>
        <p className="mt-1.5 font-serif text-[17px] font-semibold leading-snug text-ink line-clamp-2 group-hover:text-brand-700 transition-colors">
          {digest.headline || "Today's AI in five minutes."}
        </p>
        {digest.intro && (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500 line-clamp-2">
            {digest.intro}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 shrink-0">
          {stories} {stories === 1 ? 'story' : 'stories'}
        </span>
        <span className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors group-hover:bg-brand-700 whitespace-nowrap">
          Read briefing →
        </span>
      </div>
    </Link>
  )
}
