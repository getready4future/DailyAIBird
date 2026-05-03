import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTopics } from '../hooks/useTopics'
import { topicLabel, topicEmoji } from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'

const TOPIC_BLURBS: Record<string, string> = {
  research:    'Models, papers, and benchmarks from AI labs and academia.',
  products:    'Consumer and enterprise launches — the AI you actually use.',
  policy:      'Regulation, courts, government, and standards bodies.',
  business:    'Funding, deals, layoffs, and the market that funds the field.',
  safety:      'Alignment, misuse, deepfakes, and societal risk.',
  open_source: 'Open weights, datasets, and community releases that shift power.',
  tools:       'Developer infrastructure — APIs, frameworks, deployment.',
  agents:      'Agentic AI, autonomous workflows, multi-agent systems.',
}

export default function Topics() {
  const { data: topics, isLoading } = useTopics()

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const items = topics || []

  return (
    <div className="mx-auto max-w-reading-lg">
      <Helmet>
        <title>Topics — Daily AI Bird</title>
        <meta name="description" content="Browse AI news by topic — research, products, policy, safety, agents, business, open source, and developer tools." />
        <link rel="canonical" href="https://dailyaibird.com/topics" />
      </Helmet>

      <p className="eyebrow mb-2">Topics</p>
      <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink leading-[1.05]">
        Browse by what you care about
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-500">
        Eight beats covering the AI field. Every story we publish gets exactly one topic.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {items.map(({ topic, count }) => {
          const emoji = topicEmoji(topic)
          const blurb = TOPIC_BLURBS[topic]
          return (
            <Link
              key={topic}
              to={`/?topic=${encodeURIComponent(topic)}`}
              className="group flex items-start justify-between gap-4 border-b border-paper-200 py-4 transition hover:border-ink"
            >
              <div className="flex-1 min-w-0">
                <p className="font-serif text-[18px] font-semibold text-ink group-hover:text-brand-700">
                  {emoji && <span className="mr-2" aria-hidden>{emoji}</span>}
                  {topicLabel(topic)}
                </p>
                {blurb && (
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                    {blurb}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 pt-1 tabular-nums">
                {count} {count === 1 ? 'story' : 'stories'}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
