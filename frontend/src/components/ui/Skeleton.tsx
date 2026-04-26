/**
 * Skeleton loaders — improve perceived performance vs spinners.
 * Animate-pulse is Tailwind built-in. Heights match real component dimensions
 * so the layout doesn't jump when content loads.
 */

export function ArticleCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] bg-paper-100 rounded-md" />
      <div className="mt-3 h-3 w-20 bg-paper-100 rounded" />
      <div className="mt-2 h-5 w-full bg-paper-100 rounded" />
      <div className="mt-1.5 h-5 w-3/4 bg-paper-100 rounded" />
      <div className="mt-3 pt-3 border-t border-paper-200 flex items-center gap-2">
        <div className="h-3 w-3 bg-paper-100 rounded-sm" />
        <div className="h-3 w-24 bg-paper-100 rounded" />
      </div>
    </div>
  )
}

export function ArticleHeroSkeleton() {
  return (
    <div className="animate-pulse rounded-md bg-paper-100 min-h-[360px] sm:min-h-[420px]" />
  )
}

export function ArticleListItemSkeleton() {
  return (
    <div className="animate-pulse py-5">
      <div className="h-3 w-16 bg-paper-100 rounded" />
      <div className="mt-2 h-5 w-full bg-paper-100 rounded" />
      <div className="mt-1.5 h-5 w-2/3 bg-paper-100 rounded" />
      <div className="mt-3 h-3 w-32 bg-paper-100 rounded" />
    </div>
  )
}

export function ArticleGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="space-y-12">
      {/* Hero + sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ArticleHeroSkeleton />
        </div>
        <aside className="lg:col-span-4 flex flex-col divide-y divide-paper-200">
          {[0, 1, 2].map((i) => <ArticleListItemSkeleton key={i} />)}
        </aside>
      </div>
      {/* Latest grid */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => <ArticleCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
