import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAdminSources, updateSource, triggerScrape, type AdminSource } from '../api/admin'
import Spinner from '../components/ui/Spinner'

function SourceCard({ source, onSave, onScrape }: {
  source: AdminSource
  onSave: (id: number, data: Partial<AdminSource>) => void
  onScrape: (slug: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [maxArticles, setMaxArticles] = useState(source.max_articles?.toString() ?? '')
  const [contextPrompt, setContextPrompt] = useState(source.context_prompt ?? '')
  const [cronSchedule, setCronSchedule] = useState(source.cron_schedule ?? '')

  function handleSave() {
    onSave(source.id, {
      max_articles: maxArticles ? parseInt(maxArticles) : null,
      context_prompt: contextPrompt || null,
      cron_schedule: cronSchedule || null,
    })
    setEditing(false)
  }

  return (
    <div className={`rounded-xl border bg-gray-900 border-l-4 overflow-hidden ${
      source.is_active ? 'border-l-emerald-500 border-gray-800' : 'border-l-gray-700 border-gray-800 opacity-60'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3 min-w-0">
          <div>
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

      {/* Stats row */}
      <div className="flex items-center gap-4 px-5 py-3 text-xs text-gray-500 border-b border-gray-800/50">
        <span>Max: <span className="text-gray-300 font-medium">{source.max_articles ?? 'default'}</span></span>
        {source.cron_schedule && (
          <span>Cron: <span className="text-gray-300 font-mono">{source.cron_schedule}</span></span>
        )}
        {source.last_scraped_at && (
          <span className="ml-auto">Last scraped: <span className="text-gray-300">{new Date(source.last_scraped_at).toLocaleString()}</span></span>
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
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Max Articles
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={maxArticles}
              onChange={(e) => setMaxArticles(e.target.value)}
              placeholder="Leave empty for global default"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Context Prompt
            </label>
            <textarea
              rows={3}
              value={contextPrompt}
              onChange={(e) => setContextPrompt(e.target.value)}
              placeholder="Optional: additional instructions for rewriting articles from this source..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Cron Schedule (overrides global)
            </label>
            <input
              type="text"
              value={cronSchedule}
              onChange={(e) => setCronSchedule(e.target.value)}
              placeholder="e.g. 0 8 * * *  (leave empty to use global schedule)"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-gray-600">Format: minute hour day month weekday</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 py-3">
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
          onClick={() => onScrape(source.slug)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-brand-600 hover:text-brand-400 transition"
        >
          ↓ Scrape Now
        </button>
        <button
          onClick={() => { setEditing(!editing); if (editing) handleSave() }}
          className={`ml-auto rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            editing
              ? 'bg-brand-600 text-white hover:bg-brand-500'
              : 'border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
          }`}
        >
          {editing ? '✓ Save' : 'Edit'}
        </button>
        {editing && (
          <button onClick={() => setEditing(false)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:text-white transition">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default function AdminSources() {
  const qc = useQueryClient()
  const [scraping, setScraping] = useState<string | null>(null)

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['admin-sources'],
    queryFn: fetchAdminSources,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AdminSource> }) => updateSource(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sources'] }),
  })

  async function handleScrape(slug: string) {
    setScraping(slug)
    try {
      await triggerScrape(slug)
    } finally {
      setScraping(null)
    }
  }

  const activeCount = sources.filter((s) => s.is_active).length

  return (
    <div>
      <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Sources</p>
            <h1 className="text-xl font-bold text-white">Source Management</h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{activeCount}<span className="text-gray-600">/{sources.length}</span></p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Active</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onSave={(id, data) => updateMut.mutate({ id, data })}
              onScrape={handleScrape}
            />
          ))}
        </div>
      )}

      {scraping && (
        <div className="fixed bottom-6 right-6 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg">
          Scraping {scraping}…
        </div>
      )}
    </div>
  )
}
