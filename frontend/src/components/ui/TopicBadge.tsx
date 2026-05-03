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

export const TOPIC_EMOJI: Record<string, string> = {
  research:    '🔬',
  products:    '🚀',
  policy:      '📋',
  business:    '💼',
  safety:      '🛡️',
  open_source: '📦',
  tools:       '🔧',
  agents:      '🤖',
}

export function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function topicEmoji(slug: string): string | undefined {
  return TOPIC_EMOJI[slug]
}

export default function TopicBadge({ topic, withEmoji = true }: { topic: string; withEmoji?: boolean }) {
  const emoji = withEmoji ? topicEmoji(topic) : undefined
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-600">
      {emoji && <span className="mr-1.5" aria-hidden>{emoji}</span>}
      {topicLabel(topic)}
    </span>
  )
}
