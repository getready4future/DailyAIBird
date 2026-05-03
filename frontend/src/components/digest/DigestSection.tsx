import type { DigestSection as DigestSectionType } from '../../types'
import { topicEmoji, topicLabel } from '../ui/TopicBadge'

export default function DigestSection({ section }: { section: DigestSectionType }) {
  const emoji = topicEmoji(section.topic)
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="eyebrow">
          {emoji && <span className="mr-1.5" aria-hidden>{emoji}</span>}
          {topicLabel(section.topic)}
        </span>
        <div className="flex-1 h-px bg-paper-200" />
      </div>
      <h2 className="mb-5 font-serif text-2xl font-semibold leading-tight text-ink">
        {section.heading}
      </h2>
      <ol className="space-y-5">
        {section.items.map((item, i) => (
          <li key={i} className="flex gap-4">
            <span className="mt-1 shrink-0 font-mono text-[12px] tabular-nums text-ink-400 w-5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-[18px] font-semibold leading-snug text-ink hover:text-brand-700 transition-colors underline-grow"
              >
                {item.title}
              </a>
              <p className="mt-1.5 font-serif text-[15px] leading-[1.55] text-ink-500">
                {item.one_liner}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
