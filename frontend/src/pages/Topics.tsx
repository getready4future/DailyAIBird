import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTopics } from '../hooks/useTopics'
import TopicBadge, { topicLabel } from '../components/ui/TopicBadge'
import Spinner from '../components/ui/Spinner'

export default function Topics() {
  const { data: topics, isLoading } = useTopics()

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div>
      <Helmet>
        <title>AI News Topics — Daily AI Bird</title>
        <meta name="description" content="Browse AI news by topic — research, products, policy, safety, agents, and more." />
        <link rel="canonical" href="https://dailyaibird.com/topics" />
      </Helmet>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Topics</h1>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {(topics || []).map(({ topic, count }) => (
          <Link
            key={topic}
            to={`/?topic=${encodeURIComponent(topic)}`}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            <TopicBadge topic={topic} />
            <span className="text-sm font-semibold text-gray-600">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
