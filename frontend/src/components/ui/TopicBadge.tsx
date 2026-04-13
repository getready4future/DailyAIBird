const TOPIC_COLORS: Record<string, string> = {
  Models: 'bg-purple-100 text-purple-800',
  Tools: 'bg-blue-100 text-blue-800',
  Research: 'bg-indigo-100 text-indigo-800',
  Products: 'bg-green-100 text-green-800',
  Policy: 'bg-orange-100 text-orange-800',
  'Open Source': 'bg-teal-100 text-teal-800',
  Industry: 'bg-yellow-100 text-yellow-800',
  Safety: 'bg-red-100 text-red-800',
}

export default function TopicBadge({ topic }: { topic: string }) {
  const cls = TOPIC_COLORS[topic] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {topic}
    </span>
  )
}
