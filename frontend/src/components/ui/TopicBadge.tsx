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

/**
 * Editorial topic eyebrow — replaces the old pastel pill.
 * Use this anywhere you previously had `<TopicBadge>`. The mono uppercase
 * tracked label reads like a Verge / MIT Tech Review section eyebrow.
 */
export default function TopicBadge({ topic }: { topic: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-600">
      {topicLabel(topic)}
    </span>
  )
}
