import { useSearchParams } from 'react-router-dom'
import { topicLabel } from '../ui/TopicBadge'

const TOPICS = ['research', 'products', 'policy', 'business', 'safety', 'open_source', 'tools', 'agents']

export default function ArticleFilters() {
  const [params, setParams] = useSearchParams()
  const activeTopic = params.get('topic') || ''
  const activeSort = params.get('sort') || 'relevance'

  const setTopic = (t: string) => {
    const next = new URLSearchParams(params)
    if (t === activeTopic) next.delete('topic')
    else next.set('topic', t)
    next.delete('page')
    setParams(next)
  }

  const setSort = (s: string) => {
    const next = new URLSearchParams(params)
    next.set('sort', s)
    next.delete('page')
    setParams(next)
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              activeTopic === t
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {topicLabel(t)}
          </button>
        ))}
        {activeTopic && (
          <button onClick={() => setTopic('')} className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-100">
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Sort:</span>
        {['relevance', 'date'].map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`capitalize underline-offset-2 ${activeSort === s ? 'font-semibold text-brand-600 underline' : 'hover:text-gray-700'}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
