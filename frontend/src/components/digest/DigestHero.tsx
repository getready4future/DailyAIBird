import type { DailyDigest } from '../../types'
import { format } from 'date-fns'

export default function DigestHero({ digest }: { digest: DailyDigest }) {
  return (
    <header className="mb-12 border-b border-paper-200 pb-8">
      <p className="eyebrow mb-3">
        Daily AI Briefing · {format(new Date(digest.digest_date), 'EEEE, MMMM d, yyyy')}
      </p>
      <h1 className="font-serif text-4xl md:text-[2.75rem] font-semibold leading-[1.1] tracking-tight text-ink">
        {digest.headline}
      </h1>
      {digest.intro && (
        <p className="mt-5 font-serif text-[19px] leading-[1.55] text-ink-700 max-w-prose">
          {digest.intro}
        </p>
      )}
      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
        {digest.article_count} {digest.article_count === 1 ? 'story' : 'stories'} · summarised by {digest.model_used || 'Claude'} · reviewed by humans
      </p>
    </header>
  )
}
