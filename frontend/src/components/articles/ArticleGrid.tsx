import type { Article } from '../../types'
import ArticleCard from './ArticleCard'
import EmptyState from '../ui/EmptyState'

export default function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return <EmptyState message="No articles found." />

  // With 3+ articles: hero layout. With fewer: uniform large grid.
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
    <div className="space-y-5">
      {/* Editorial top row: 1 hero (2/3) + 2 large cards (1/3) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 h-full">
          <ArticleCard article={hero} variant="hero" />
        </div>
        <div className="flex flex-col gap-5">
          {sidebar.map((a) => <ArticleCard key={a.id} article={a} variant="large" />)}
        </div>
      </div>

      {/* Remaining articles: 3-column uniform grid */}
      {remaining.length > 0 && (
        <>
          <div className="border-t border-gray-100 pt-1" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {remaining.map((a) => <ArticleCard key={a.id} article={a} variant="default" />)}
          </div>
        </>
      )}
    </div>
  )
}
