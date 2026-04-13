import type { Article } from '../../types'
import ArticleCard from './ArticleCard'
import EmptyState from '../ui/EmptyState'

export default function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return <EmptyState message="No articles found." />
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <ArticleCard key={a.id} article={a} />
      ))}
    </div>
  )
}
