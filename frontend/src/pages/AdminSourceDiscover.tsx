import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSourceCatalog, importCatalogSource, analyzeSourceUrl,
  type CatalogSource, type SourceAnalysis,
} from '../api/admin'
import Spinner from '../components/ui/Spinner'

const CATEGORY_LABELS: Record<string, string> = {
  blog: 'AI Lab Blog', news: 'Tech News', newsletter: 'Newsletter',
  research: 'Research', policy: 'Policy & Safety', social: 'Community',
}
const CATEGORY_COLORS: Record<string, string> = {
  blog:       'bg-violet-900/30 border-violet-700/40 text-violet-400',
  news:       'bg-blue-900/30 border-blue-700/40 text-blue-400',
  newsletter: 'bg-amber-900/30 border-amber-700/40 text-amber-400',
  research:   'bg-emerald-900/30 border-emerald-700/40 text-emerald-400',
  policy:     'bg-rose-900/30 border-rose-700/40 text-rose-400',
  social:     'bg-gray-800 border-gray-700 text-gray-400',
}

// ── Catalog card ──────────────────────────────────────────────────────────────

function CatalogCard({ source, onAdd }: { source: CatalogSource; onAdd: (s: CatalogSource) => void }) {
  const catColor = CATEGORY_COLORS[source.category] ?? CATEGORY_COLORS.news

  return (
    <div className={`flex flex-col rounded-xl border bg-gray-900 overflow-hidden transition-all ${
      source.already_added ? 'opacity-50 border-gray-800' : 'border-gray-800 hover:border-gray-700'
    }`}>
      <div className="flex-1 p-4">
        <div className="mb-2 flex flex-wrap items-start gap-2">
          <p className="text-sm font-bold text-white leading-tight flex-1">{source.name}</p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catColor}`}>
            {CATEGORY_LABELS[source.category] ?? source.category}
          </span>
        </div>
        <p className="mb-3 text-xs text-gray-500 leading-relaxed">{source.description}</p>
        <div className="flex flex-wrap gap-1">
          {source.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">#{tag}</span>
          ))}
          {source.requires && (
            <span className="rounded-full border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[10px] text-amber-500">
              requires: {source.requires}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-gray-800 px-4 py-2.5">
        <a href={source.url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-gray-600 hover:text-gray-400 truncate transition">
          {source.url.replace(/^https?:\/\//, '')}
        </a>
        {source.already_added ? (
          <span className="shrink-0 rounded-full border border-emerald-800/50 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold text-emerald-500">
            ✓ Added
          </span>
        ) : (
          <button onClick={() => onAdd(source)}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-brand-500 transition">
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

// ── Analysis result ───────────────────────────────────────────────────────────

function AnalysisResult({ result, onImport, importing }: {
  result: SourceAnalysis
  onImport: () => void
  importing: boolean
}) {
  const recColor =
    result.recommendation === 'add'  ? 'border-emerald-700/50 bg-emerald-950/20' :
    result.recommendation === 'maybe'? 'border-amber-700/50 bg-amber-950/15' :
                                       'border-red-700/50 bg-red-950/15'
  const recLabel =
    result.recommendation === 'add'  ? { text: '✓ Recommended', cls: 'text-emerald-400' } :
    result.recommendation === 'maybe'? { text: '~ Maybe', cls: 'text-amber-400' } :
                                       { text: '✗ Not Recommended', cls: 'text-red-400' }
  const qualityStars = result.quality_score
    ? '★'.repeat(result.quality_score) + '☆'.repeat(5 - result.quality_score)
    : null

  return (
    <div className={`mt-6 rounded-2xl border p-6 ${recColor}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-bold tracking-widest uppercase mb-1 ${recLabel.cls}`}>{recLabel.text}</p>
          <h3 className="text-lg font-bold text-white">{result.site_name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{result.url}</p>
        </div>
        {qualityStars && (
          <div className="text-right shrink-0">
            <p className="text-sm text-amber-400 font-mono tracking-widest">{qualityStars}</p>
            <p className="text-[10px] text-gray-600">quality score</p>
          </div>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-300 leading-relaxed">{result.description}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2.5">
          <p className="text-gray-600 mb-0.5">Category</p>
          <p className="font-semibold text-gray-200">{CATEGORY_LABELS[result.category] ?? result.category}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2.5">
          <p className="text-gray-600 mb-0.5">Audience</p>
          <p className="font-semibold text-gray-200 capitalize">{result.audience}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2.5">
          <p className="text-gray-600 mb-0.5">Frequency</p>
          <p className="font-semibold text-gray-200 capitalize">{result.update_frequency}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2.5">
          <p className="text-gray-600 mb-0.5">Scraper</p>
          <p className="font-semibold text-gray-200">{result.feed_url ? 'RSS' : 'HTML'}</p>
        </div>
      </div>

      {result.primary_topics.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {result.primary_topics.map((t) => (
            <span key={t} className="rounded-full bg-gray-800 px-2.5 py-0.5 text-[10px] text-gray-400">#{t}</span>
          ))}
        </div>
      )}

      <div className="mb-5 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 text-xs text-gray-400 italic">
        {result.reason}
      </div>

      {result.feed_url && (
        <div className="mb-5 flex items-center gap-2 text-xs">
          <span className="text-emerald-400">✓ RSS feed detected:</span>
          <span className="font-mono text-gray-400 truncate">{result.feed_url}</span>
        </div>
      )}

      {result.recommendation !== 'skip' && (
        <button
          onClick={onImport}
          disabled={importing}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
        >
          {importing ? 'Adding…' : '+ Add to Sources'}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'blog', 'news', 'newsletter', 'research', 'policy', 'social']

export default function AdminSourceDiscover() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'catalog' | 'analyze'>('catalog')
  const [filterCat, setFilterCat] = useState('all')
  const [analyzeUrl, setAnalyzeUrl] = useState('')
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null)
  const [toast, setToast] = useState('')

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['source-catalog'],
    queryFn: fetchSourceCatalog,
  })

  const importMut = useMutation({
    mutationFn: importCatalogSource,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['source-catalog'] })
      qc.invalidateQueries({ queryKey: ['admin-sources'] })
      setToast(`"${vars.name}" eklendi!`)
      setTimeout(() => setToast(''), 3000)
    },
  })

  const analyzeMut = useMutation({
    mutationFn: analyzeSourceUrl,
    onSuccess: (data) => setAnalysis(data),
  })

  function handleAdd(source: CatalogSource) {
    importMut.mutate({
      name: source.name,
      slug: source.slug,
      url: source.url,
      feed_url: source.feed_url,
      scraper_type: source.scraper_type,
      category: source.category,
      scrape_config: (source as any).scrape_config ?? {},
    })
  }

  function handleImportAnalysis() {
    if (!analysis) return
    importMut.mutate({
      name: analysis.site_name,
      slug: analysis.slug,
      url: analysis.url,
      feed_url: analysis.feed_url,
      scraper_type: analysis.scraper_type,
      category: analysis.category,
      scrape_config: {},
    })
    setAnalysis(null)
    setAnalyzeUrl('')
  }

  const filtered = filterCat === 'all'
    ? catalog
    : catalog.filter((s) => s.category === filterCat)

  const addedCount = catalog.filter((s) => s.already_added).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Discovery</p>
            <h1 className="text-xl font-bold text-white">Find Sources</h1>
            <p className="mt-1 text-xs text-gray-500">
              Browse {catalog.length} curated AI news sources, or analyze any URL with AI.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{addedCount}<span className="text-gray-600">/{catalog.length}</span></p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Added</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(['catalog', 'analyze'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition capitalize ${
              tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'
            }`}>
            {t === 'catalog' ? `📚 Catalog (${catalog.length})` : '🔍 Analyze URL'}
          </button>
        ))}
      </div>

      {/* ── Catalog tab ── */}
      {tab === 'catalog' && (
        <>
          {/* Category filter */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition capitalize ${
                  filterCat === cat
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                }`}>
                {cat === 'all' ? `All (${catalog.length})` : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((source) => (
                <CatalogCard key={source.slug} source={source} onAdd={handleAdd} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Analyze tab ── */}
      {tab === 'analyze' && (
        <div className="max-w-2xl">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">URL Analyzer</p>
            <p className="mb-4 text-xs text-gray-500">
              Paste any website URL — the system will fetch the page, detect RSS feeds,
              and use AI to assess if it's a good AI news source.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={analyzeUrl}
                onChange={(e) => { setAnalyzeUrl(e.target.value); setAnalysis(null) }}
                placeholder="https://example.com/ai-news"
                className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && analyzeUrl && analyzeMut.mutate(analyzeUrl)}
              />
              <button
                onClick={() => analyzeUrl && analyzeMut.mutate(analyzeUrl)}
                disabled={!analyzeUrl || analyzeMut.isPending}
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
              >
                {analyzeMut.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Analyzing…
                  </span>
                ) : 'Analyze'}
              </button>
            </div>

            {analyzeMut.isError && (
              <p className="mt-3 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
                {(analyzeMut.error as any)?.response?.data?.detail || 'Analysis failed. Check the URL and try again.'}
              </p>
            )}
          </div>

          {analyzeMut.isPending && (
            <div className="mt-6 flex items-center gap-3 text-sm text-gray-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Fetching page and running AI assessment…
            </div>
          )}

          {analysis && (
            <AnalysisResult
              result={analysis}
              onImport={handleImportAnalysis}
              importing={importMut.isPending}
            />
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
