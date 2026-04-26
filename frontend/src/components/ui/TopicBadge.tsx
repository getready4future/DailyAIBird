const TOPIC_COLORS: Record<string, string> = {
  research:    'bg-indigo-100 text-indigo-800',
  products:    'bg-green-100 text-green-800',
  policy:      'bg-orange-100 text-orange-800',
  business:    'bg-yellow-100 text-yellow-800',
  safety:      'bg-red-100 text-red-800',
  open_source: 'bg-teal-100 text-teal-800',
  tools:       'bg-blue-100 text-blue-800',
  agents:      'bg-purple-100 text-purple-800',
}

const TOPIC_LABELS: Record<string, string> = {
  research:    'Research',
  products:    'Products',
  policy:      'Policy',
  business:    'Business',
  safety:      'Safety',
  open_source: 'Open Source',
  tools:       'Tools',
  agents:      'Agents',
}

export function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function TopicBadge({ topic }: { topic: string }) {
  const cls = TOPIC_COLORS[topic] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {topicLabel(topic)}
    </span>
  )
}
