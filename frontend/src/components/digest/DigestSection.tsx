import type { DigestSection as DigestSectionType } from '../../types'
import TopicBadge from '../ui/TopicBadge'

export default function DigestSection({ section }: { section: DigestSectionType }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <TopicBadge topic={section.topic} />
        <h2 className="text-lg font-semibold text-gray-800">{section.heading}</h2>
      </div>
      <ul className="space-y-3">
        {section.items.map((item, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-900 hover:text-brand-600"
              >
                {item.title}
              </a>
              <p className="mt-1 text-sm text-gray-600">{item.one_liner}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
