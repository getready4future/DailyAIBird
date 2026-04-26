import type { Article } from '../../types'
import ArticleCard from './ArticleCard'
import EmptyState from '../ui/EmptyState'

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span className="eyebrow">{text}</span>
      <div className="flex-1 h-px bg-paper-200" />
    </div>
  )
}

export default function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return <EmptyState message="Nothing here yet." hint="Check back in a few hours — new stories every six." />
  }

  if (articles.length < 3) {
    return (
      <div className="grid gap-8 sm:grid-cols-2">
        {articles.map((a) => <ArticleCard key={a.id} article={a} variant="large" />)}
      </div>
    )
  }

  const [hero, ...rest] = articles
  const sidebar = rest.slice(0, 3)
  const remaining = rest.slice(3)

  return (
    <div className="space-y-12">
      {/* Lead story + text-list sidebar (Verge / NYT pattern) */}
      <section>
        <SectionLabel text="Lead Story" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <ArticleCard article={hero} variant="hero" />
          </div>
          <aside className="lg:col-span-4 flex flex-col divide-y divide-paper-200">
            {sidebar.map((a) => (
              <ArticleCard key={a.id} article={a} variant="text-list" />
            ))}
          </aside>
        </div>
      </section>

      {/* Latest grid */}
      {remaining.length > 0 && (
        <section>
          <SectionLabel text="Latest" />
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {remaining.map((a) => (
              <ArticleCard key={a.id} article={a} variant="default" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
