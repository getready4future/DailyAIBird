import { useSearchParams } from 'react-router-dom'
import { topicLabel, topicEmoji } from '../ui/TopicBadge'

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
    <div className="mb-8 border-b border-paper-200 pb-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="eyebrow shrink-0">Topics</span>
        {TOPICS.map((t) => {
          const emoji = topicEmoji(t)
          return (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`font-mono text-[11px] uppercase tracking-[0.14em] transition pb-px border-b ${
                activeTopic === t
                  ? 'text-brand-700 border-brand-500'
                  : 'text-ink-500 border-transparent hover:text-ink hover:border-paper-300'
              }`}
            >
              {emoji && <span className="mr-1" aria-hidden>{emoji}</span>}
              {topicLabel(t)}
            </button>
          )
        })}
        {activeTopic && (
          <button
            onClick={() => setTopic('')}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 hover:text-ink transition"
          >
            × Clear
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[12px] text-ink-500">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Sort</span>
        {['relevance', 'date'].map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`capitalize transition ${
              activeSort === s
                ? 'font-semibold text-ink underline underline-offset-4 decoration-brand-500 decoration-2'
                : 'text-ink-500 hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
