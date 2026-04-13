import type { DailyDigest } from '../../types'
import { format } from 'date-fns'

export default function DigestHero({ digest }: { digest: DailyDigest }) {
  return (
    <div className="mb-10 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 px-8 py-10 text-white shadow-lg">
      <p className="mb-2 text-sm font-medium opacity-75">
        Daily AI Briefing · {format(new Date(digest.digest_date), 'MMMM d, yyyy')}
      </p>
      <h1 className="mb-4 text-2xl font-bold leading-tight sm:text-3xl">{digest.headline}</h1>
      <p className="max-w-2xl text-base opacity-90 leading-relaxed">{digest.intro}</p>
      <div className="mt-4 text-xs opacity-60">
        {digest.article_count} stories · Powered by {digest.model_used || 'Claude'}
      </div>
    </div>
  )
}
