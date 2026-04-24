import type { Article } from '../../types'
import ArticleCard from './ArticleCard'
import EmptyState from '../ui/EmptyState'

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-bold tracking-widest text-brand-600 uppercase">{text}</span>
      <div className="flex-1 h-px bg-brand-100" />
    </div>
  )
}

export default function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return <EmptyState message="No articles found." />

  if (articles.length < 3) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {articles.map((a) => <ArticleCard key={a.id} article={a} variant="large" />)}
      </div>
    )
  }

  const [hero, ...rest] = articles
  const sidebar = rest.slice(0, 2)
  const remaining = rest.slice(2)

  return (
    <div className="space-y-8">
      {/* Lead story row */}
      <div>
        <SectionLabel text="Lead Story" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 h-full">
            <ArticleCard article={hero} variant="hero" />
          </div>
          <div className="flex flex-col gap-5">
            {sidebar.map((a) => <ArticleCard key={a.id} article={a} variant="large" />)}
          </div>
        </div>
      </div>

      {/* Remaining articles */}
      {remaining.length > 0 && (
        <div>
          <SectionLabel text="Latest News" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {remaining.map((a) => <ArticleCard key={a.id} article={a} variant="default" />)}
          </div>
        </div>
      )}
    </div>
  )
}
