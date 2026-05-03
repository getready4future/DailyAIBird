import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useSources } from '../hooks/useSources'
import Spinner from '../components/ui/Spinner'

const CATEGORY_META: Record<string, { label: string; tone: string }> = {
  blog:       { label: 'Lab blog',     tone: 'border-brand-300 text-brand-700' },
  news:       { label: 'Tech press',   tone: 'border-paper-300 text-ink-500' },
  research:   { label: 'Research',     tone: 'border-accent-300 text-accent-700' },
  social:     { label: 'Community',    tone: 'border-paper-300 text-ink-500' },
  newsletter: { label: 'Newsletter',   tone: 'border-paper-300 text-ink-500' },
}

export default function Sources() {
  const { data: sources, isLoading } = useSources()

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const grouped = (sources || []).reduce<Record<string, typeof sources>>((acc, s) => {
    const key = s.category || 'other'
    ;(acc[key] = acc[key] || []).push(s)
    return acc
  }, {} as Record<string, NonNullable<typeof sources>>)

  const order = ['blog', 'news', 'research', 'newsletter', 'social']
  const orderedKeys = [
    ...order.filter((k) => grouped[k]?.length),
    ...Object.keys(grouped).filter((k) => !order.includes(k)),
  ]

  return (
    <div className="mx-auto max-w-reading">
      <Helmet>
        <title>Sources — Daily AI Bird</title>
        <meta name="description" content="The AI labs, publications, research servers, and communities Daily AI Bird tracks every day." />
        <link rel="canonical" href="https://dailyaibird.com/sources" />
      </Helmet>

      <p className="eyebrow mb-2">Sources</p>
      <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink leading-[1.05]">
        Where our stories come from
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-500">
        We pull from official AI lab blogs, tier-1 tech press, research servers, and trusted
        communities — refreshed every six hours. Every article on the site is traceable to
        one of these sources.
      </p>

      <div className="mt-12 space-y-12">
        {orderedKeys.map((cat) => {
          const meta = CATEGORY_META[cat] || { label: cat, tone: 'border-paper-300 text-ink-500' }
          const items = grouped[cat] || []
          return (
            <section key={cat}>
              <div className="mb-5 flex items-baseline gap-3">
                <span className="eyebrow">{meta.label}</span>
                <div className="flex-1 h-px bg-paper-200" />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                  {items.length} {items.length === 1 ? 'source' : 'sources'}
                </span>
              </div>
              <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {items.map((s) => {
                  let host = ''
                  try { host = new URL(s.url).hostname.replace('www.', '') } catch { /* noop */ }
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/?source_slug=${s.slug}`}
                        className="group flex items-center gap-3 py-1.5 hover:text-brand-700 transition-colors"
                      >
                        {host && (
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            className="h-4 w-4 rounded-sm shrink-0"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <span className="font-serif text-[16px] text-ink group-hover:text-brand-700">
                          {s.name}
                        </span>
                        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Browse →
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <p className="mt-16 border-t border-paper-200 pt-6 font-serif text-[14px] leading-relaxed text-ink-500">
        Spot a source we should add? Email{' '}
        <a href="mailto:hello@dailyaibird.com?subject=Source suggestion" className="text-brand-700 underline-grow">
          hello@dailyaibird.com
        </a>
        . We add publications that consistently break news or do the reporting other outlets reference.
      </p>
    </div>
  )
}
