import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fetchAdminSources, updateSource, triggerScrape, testSource, importCatalogSource, type AdminSource, type SourceTestArticle } from '../api/admin'
import Spinner from '../components/ui/Spinner'
import PipelinePanel from '../components/admin/PipelinePanel'

// ── Test result panel ─────────────────────────────────────────────────────────

function TestPanel({ articles, onClose }: { articles: SourceTestArticle[]; onClose: () => void }) {
  if (articles.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-amber-400">Test Result</p>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-sm leading-none">✕</button>
        </div>
        <p className="text-xs text-gray-500">No articles returned — the source may be empty or the scraper needs configuration.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
          Test Preview — {articles.length} article{articles.length > 1 ? 's' : ''} found
        </p>
        <button onClick={onClose} className="rounded p-0.5 text-gray-600 hover:text-gray-300 transition text-sm leading-none">✕</button>
      </div>

      <div className="divide-y divide-gray-800/60">
        {articles.map((a, i) => (
          <div key={i} className="flex gap-3 p-3">
            {/* Thumbnail */}
            <div className="shrink-0">
              {a.image_url ? (
                <img
                  src={a.image_url}
                  alt=""
                  className="h-16 w-24 rounded-lg object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="h-16 w-24 rounded-lg bg-gray-800 flex items-center justify-center">
                  <span className="text-xl opacity-20">🐦</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-semibold text-gray-100 line-clamp-2 hover:text-brand-400 transition leading-snug mb-1"
              >
                {a.title}
              </a>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600 mb-1.5">
                {a.author && <span>{a.author}</span>}
                {a.author && a.published_at && <span>·</span>}
                {a.published_at && (
                  <span>{formatDistanceToNow(new Date(a.published_at), { addSuffix: true })}</span>
                )}
              </div>
              {a.summary && (
                <p className="text-[10px] text-gray-600 line-clamp-2 leading-relaxed">{a.summary}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ source, selected, onToggleSelect, onSave, onScrape }: {
  source: AdminSource
  selected: boolean
  onToggleSelect: (id: number) => void
  onSave: (id: number, data: Partial<AdminSource>) => void
  onScrape: (slug: string, name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [maxArticles, setMaxArticles] = useState(source.max_articles?.toString() ?? '')
  const [contextPrompt, setContextPrompt] = useState(source.context_prompt ?? '')
  const [cronSchedule, setCronSchedule] = useState(source.cron_schedule ?? '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<SourceTestArticle[] | null>(null)
  const [testError, setTestError] = useState('')

  function handleSave() {
    onSave(source.id, {
      max_articles: maxArticles ? parseInt(maxArticles) : null,
      context_prompt: contextPrompt || null,
      cron_schedule: cronSchedule || null,
    })
    setEditing(false)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    setTestError('')
    try {
      const result = await testSource(source.id)
      setTestResult(result)
    } catch (err: any) {
      setTestError(err?.response?.data?.detail || 'Test failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={`rounded-xl border bg-gray-900 border-l-4 overflow-hidden transition-all ${
      source.is_active ? 'border-l-emerald-500 border-gray-800' : 'border-l-gray-700 border-gray-800 opacity-60'
    } ${selected ? 'ring-1 ring-brand-600/50' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          {/* Checkbox */}
          <button
            onClick={() => onToggleSelect(source.id)}
            className={`shrink-0 h-4.5 w-4.5 rounded border transition flex items-center justify-center ${
              selected
                ? 'border-brand-500 bg-brand-600 text-white'
                : 'border-gray-600 bg-gray-800 hover:border-brand-500'
            }`}
            style={{ width: 18, height: 18 }}
            aria-label="Select source"
          >
            {selected && <span className="text-[10px] leading-none font-bold">✓</span>}
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{source.name}</p>
            <p className="text-xs text-gray-500 truncate">{source.url}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            source.is_active ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {source.is_active ? 'Active' : 'Paused'}
          </span>
          <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
            {source.scraper_type}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-5 py-2.5 text-xs text-gray-500 border-b border-gray-800/50">
        <span>Max: <span className="text-gray-300 font-medium">{source.max_articles ?? 'default'}</span></span>
        {source.cron_schedule && (
          <span>Cron: <span className="text-gray-300 font-mono">{source.cron_schedule}</span></span>
        )}
        {source.last_scraped_at && (
          <span className="ml-auto">
            {formatDistanceToNow(new Date(source.last_scraped_at), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Context prompt preview */}
      {source.context_prompt && !editing && (
        <div className="px-5 py-3 border-b border-gray-800/50">
          <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-1">Context Prompt</p>
          <p className="text-xs text-gray-400 line-clamp-2">{source.context_prompt}</p>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="px-5 py-4 space-y-4 border-b border-gray-800">
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Max Articles</label>
            <input
              type="number" min="1" max="100"
              value={maxArticles}
              onChange={(e) => setMaxArticles(e.target.value)}
              placeholder="Leave empty for global default"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Context Prompt</label>
            <textarea
              rows={3}
              value={contextPrompt}
              onChange={(e) => setContextPrompt(e.target.value)}
              placeholder="Optional: additional instructions for rewriting articles from this source..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Cron Schedule (overrides global)</label>
            <input
              type="text"
              value={cronSchedule}
              onChange={(e) => setCronSchedule(e.target.value)}
              placeholder="e.g. 0 8 * * *"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-gray-600">Format: minute hour day month weekday</p>
          </div>
        </div>
      )}

      {/* Test results */}
      <div className="px-5">
        {testing && (
          <div className="mt-3 flex items-center gap-2.5 py-3 text-xs text-gray-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Fetching articles from source…
          </div>
        )}
        {testError && (
          <div className="mt-3 rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">
            {testError}
          </div>
        )}
        {testResult !== null && (
          <TestPanel articles={testResult} onClose={() => setTestResult(null)} />
        )}
        {(testing || testResult !== null || testError) && <div className="pb-3" />}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-gray-800">
        <button
          onClick={() => onSave(source.id, { is_active: !source.is_active })}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            source.is_active
              ? 'border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400'
              : 'border-emerald-800 text-emerald-500 hover:border-emerald-600'
          }`}
        >
          {source.is_active ? 'Pause' : 'Enable'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          className="rounded-lg border border-brand-700/50 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:border-brand-500 hover:bg-brand-950/30 disabled:opacity-50 transition"
        >
          {testing ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-brand-400 border-t-transparent" />
              Testing…
            </span>
          ) : '▷ Test'}
        </button>

        <button
          onClick={() => onScrape(source.slug, source.name)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-brand-600 hover:text-brand-400 transition"
        >
          ↓ Scrape Now
        </button>

        <div className="ml-auto flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSave}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-500 transition">
                ✓ Save
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:text-white transition">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-gray-500 hover:text-white transition">
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add source form ───────────────────────────────────────────────────────────

const SCRAPER_TYPES = ['rss', 'hn', 'reddit', 'arxiv', 'playwright', 'twitter']
const CATEGORIES    = ['news', 'blog', 'newsletter', 'research', 'policy', 'social']

function AddSourceForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName]               = useState('')
  const [url, setUrl]                 = useState('')
  const [feedUrl, setFeedUrl]         = useState('')
  const [scraperType, setScraperType] = useState('rss')
  const [category, setCategory]       = useState('news')
  const [maxArticles, setMaxArticles] = useState('')
  const [contextPrompt, setContextPrompt] = useState('')
  const [error, setError]             = useState('')

  // Auto-generate slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)

  const createMut = useMutation({
    mutationFn: () => importCatalogSource({
      name, slug, url,
      feed_url: feedUrl || null,
      scraper_type: scraperType,
      category,
      scrape_config: maxArticles ? { max_articles: parseInt(maxArticles) } : {},
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sources'] })
      onClose()
    },
    onError: (err: any) => setError(err?.response?.data?.detail || 'Failed to add source.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !url) return
    setError('')
    createMut.mutate()
  }

  const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none'
  const labelCls = 'mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase'

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-brand-700/30 bg-gray-900 p-6">
      <p className="mb-5 text-[10px] font-bold tracking-widest text-brand-500 uppercase">New Source</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Source Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. OpenAI Blog" required className={inputCls} />
          {slug && <p className="mt-1 text-[10px] text-gray-600">slug: {slug}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Website URL *</label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com" required className={inputCls} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Feed URL <span className="normal-case font-normal text-gray-600">(RSS/Atom — leave blank for non-RSS)</span></label>
          <input type="url" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="https://example.com/feed.xml" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Scraper Type</label>
          <select value={scraperType} onChange={(e) => setScraperType(e.target.value)}
            className={inputCls}>
            {SCRAPER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Max Articles <span className="normal-case font-normal text-gray-600">(optional)</span></label>
          <input type="number" min="1" max="100" value={maxArticles}
            onChange={(e) => setMaxArticles(e.target.value)}
            placeholder="Global default" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Context Prompt <span className="normal-case font-normal text-gray-600">(optional)</span></label>
          <input value={contextPrompt} onChange={(e) => setContextPrompt(e.target.value)}
            placeholder="Extra rewriting instructions…" className={inputCls} />
        </div>
      </div>

      {scraperType === 'twitter' && (
        <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-400">
          Twitter/X scraper requires <code className="font-mono">TWITTER_BEARER_TOKEN</code> in your .env file.
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={createMut.isPending || !name || !url}
          className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition">
          {createMut.isPending ? 'Adding…' : '+ Add Source'}
        </button>
        <button type="button" onClick={onClose}
          className="rounded-lg border border-gray-700 px-5 py-2 text-xs font-semibold text-gray-400 hover:text-white transition">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSources() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd]     = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pipeline, setPipeline]   = useState<{ open: boolean; label: string; key: number }>({
    open: false, label: '', key: 0,
  })

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['admin-sources'],
    queryFn: fetchAdminSources,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AdminSource> }) => updateSource(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sources'] }),
  })

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === sources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sources.map((s) => s.id)))
    }
  }

  async function handleScrape(slug: string, name: string) {
    await triggerScrape(slug)
    setPipeline((p) => ({ open: true, label: name, key: p.key + 1 }))
  }

  async function handleScrapeSelected() {
    const selected = sources.filter((s) => selectedIds.has(s.id))
    if (!selected.length) return
    const label = selected.length === 1
      ? selected[0].name
      : `${selected.length} sources`
    // Trigger all selected sources
    await Promise.all(selected.map((s) => triggerScrape(s.slug)))
    setPipeline((p) => ({ open: true, label, key: p.key + 1 }))
  }

  const activeCount  = sources.filter((s) => s.is_active).length
  const allSelected  = sources.length > 0 && selectedIds.size === sources.length
  const someSelected = selectedIds.size > 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Sources</p>
            <h1 className="text-xl font-bold text-white">Source Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                {activeCount}<span className="text-gray-600">/{sources.length}</span>
              </p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Active</p>
            </div>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                showAdd ? 'bg-gray-700 text-white' : 'bg-brand-600 text-white hover:bg-brand-500'
              }`}
            >
              {showAdd ? '✕ Cancel' : '+ Add Source'}
            </button>
          </div>
        </div>
      </div>

      {showAdd && <AddSourceForm onClose={() => setShowAdd(false)} />}

      {/* Selection toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:border-gray-500 hover:text-white"
        >
          <span className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[9px] font-bold transition ${
            allSelected ? 'border-brand-500 bg-brand-600 text-white' : 'border-gray-600 bg-gray-800'
          }`}>
            {allSelected ? '✓' : ''}
          </span>
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        {someSelected && (
          <>
            <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
            <button
              onClick={handleScrapeSelected}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-500"
            >
              ↓ Scrape Selected ({selectedIds.size})
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-600 hover:text-gray-400 transition"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              selected={selectedIds.has(source.id)}
              onToggleSelect={toggleSelect}
              onSave={(id, data) => updateMut.mutate({ id, data })}
              onScrape={handleScrape}
            />
          ))}
        </div>
      )}

      <PipelinePanel
        open={pipeline.open}
        sourceLabel={pipeline.label}
        sessionKey={pipeline.key}
        onClose={() => setPipeline((p) => ({ ...p, open: false }))}
      />
    </div>
  )
}
