import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/client'
import Spinner from '../components/ui/Spinner'

// ── API helpers ───────────────────────────────────────────────────────────────

interface PipelineConfig {
  cutoff_hours: number
  dedup_threshold: number
  confidence_reject_threshold: number
  feature_min_score: number
  top_featured: number
  scrape_concurrency: number
  ai_batch_size: number
  max_articles_per_source: number
}

interface PipelineStats {
  [status: string]: number
}

interface PromptInfo {
  current: string
  is_custom: boolean
  default: string
}

interface PipelinePrompts {
  quality_check: PromptInfo
  enrich: PromptInfo
}

const fetchPipelineConfig = async (): Promise<PipelineConfig> => {
  const { data } = await adminApi.get('/admin/pipeline/config')
  return data
}

const updatePipelineConfig = async (config: Partial<PipelineConfig>): Promise<PipelineConfig> => {
  const { data } = await adminApi.patch('/admin/pipeline/config', config)
  return data
}

const fetchPipelineStats = async (): Promise<PipelineStats> => {
  const { data } = await adminApi.get('/admin/pipeline/stats')
  return data
}

const fetchPipelinePrompts = async (): Promise<PipelinePrompts> => {
  const { data } = await adminApi.get('/admin/pipeline/prompts')
  return data
}

const updatePrompt = async (key: string, text: string) => {
  await adminApi.put('/admin/pipeline/prompts', { key, text })
}

const resetPrompt = async (key: string) => {
  await adminApi.delete(`/admin/pipeline/prompts/${key}`)
}

// ── Stat pill ───────────────────────────────────────────────────────────���─────

const STATUS_STYLE: Record<string, string> = {
  published:     'bg-emerald-900/50 text-emerald-300 border-emerald-800/50',
  pending_human: 'bg-amber-900/40 text-amber-300 border-amber-800/40',
  pending_ai:    'bg-blue-900/40 text-blue-300 border-blue-800/40',
  rejected_ai:   'bg-red-900/30 text-red-400 border-red-800/30',
}

const STATUS_LABEL: Record<string, string> = {
  published:     'Published',
  pending_human: 'Pending Review',
  pending_ai:    'Pending AI',
  rejected_ai:   'Rejected',
}

// ── Number input ──────────────────────────────────────────────────────────────

function NumInput({ label, value, min, max, step = 1, onChange, hint }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; hint?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">{label}</label>
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
      />
      {hint && <p className="mt-1 text-[10px] text-gray-600">{hint}</p>}
    </div>
  )
}

// ── Config card ───────────────────────────────────────────────────────────────

function ConfigCard({ config }: { config: PipelineConfig }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<PipelineConfig>(config)
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: (c: PipelineConfig) => updatePipelineConfig(c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function set(key: keyof PipelineConfig, val: number) {
    setDraft((d) => ({ ...d, [key]: val }))
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <p className="mb-5 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Pipeline Ayarları</p>

      {/* Scraping limits */}
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-brand-500 uppercase">Scraping</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumInput label="Max makale / kaynak" value={draft.max_articles_per_source} min={1} max={200} step={1}
          onChange={(v) => set('max_articles_per_source', v)}
          hint="Her kaynaktan en fazla kaç makale çekilir (global üst limit)" />
        <NumInput label="Scrape eşzamanlılık" value={draft.scrape_concurrency} min={1} max={20} step={1}
          onChange={(v) => set('scrape_concurrency', v)}
          hint="Aynı anda taranan kaynak sayısı" />
        <NumInput label="Cutoff (saat)" value={draft.cutoff_hours} min={1} max={168} step={1}
          onChange={(v) => set('cutoff_hours', v)}
          hint="Bu saatten eski makaleler işlenmez" />
      </div>

      {/* Dedup & quality */}
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-brand-500 uppercase">Kalite & Dedup</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumInput label="Dedup eşiği" value={draft.dedup_threshold} min={0.1} max={1.0} step={0.05}
          onChange={(v) => set('dedup_threshold', v)}
          hint="0.65 = benzerlik eşiği (düşük = daha agresif dedup)" />
        <NumInput label="Min. güven skoru" value={draft.confidence_reject_threshold} min={1} max={5} step={1}
          onChange={(v) => set('confidence_reject_threshold', v)}
          hint="Altındaki makaleler reddedilir (1–5)" />
        <NumInput label="AI batch boyutu" value={draft.ai_batch_size} min={1} max={20} step={1}
          onChange={(v) => set('ai_batch_size', v)}
          hint="Aynı anda işlenen makale sayısı" />
      </div>

      {/* Featured */}
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-brand-500 uppercase">Öne Çıkanlar</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumInput label="Feature min skor" value={draft.feature_min_score} min={0} max={1.0} step={0.05}
          onChange={(v) => set('feature_min_score', v)}
          hint="Öne çıkan makale için min. combined skor" />
        <NumInput label="Max featured" value={draft.top_featured} min={1} max={20} step={1}
          onChange={(v) => set('top_featured', v)}
          hint="24 saatte en fazla kaç makale öne çıkar" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => mut.mutate(draft)}
          disabled={mut.isPending}
          className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
        >
          {mut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {saved && <span className="text-xs text-emerald-400">✓ Kaydedildi</span>}
        <button
          onClick={() => setDraft(config)}
          className="text-xs text-gray-600 hover:text-gray-400 transition"
        >
          Sıfırla
        </button>
      </div>
    </div>
  )
}

// ── Prompt editor ─────────────────────────────────────────────────────────────

function PromptEditor({ promptKey, label, info }: { promptKey: 'quality_check' | 'enrich'; label: string; info: PromptInfo }) {
  const qc = useQueryClient()
  const [text, setText] = useState(info.current)
  const [saved, setSaved] = useState(false)

  const saveMut = useMutation({
    mutationFn: () => updatePrompt(promptKey, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-prompts'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const resetMut = useMutation({
    mutationFn: () => resetPrompt(promptKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-prompts'] })
      setText(info.default)
    },
  })

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">{label}</p>
          {info.is_custom && (
            <span className="mt-0.5 inline-block rounded-full bg-brand-900/50 px-2 py-0.5 text-[10px] font-bold text-brand-400">Özelleştirilmiş</span>
          )}
        </div>
        {info.is_custom && (
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-[10px] font-semibold text-gray-500 hover:border-red-800 hover:text-red-400 transition"
          >
            Varsayılana Dön
          </button>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-xs text-gray-300 placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-y"
        spellCheck={false}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || text === info.current}
          className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
        >
          {saveMut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {saved && <span className="text-xs text-emerald-400">✓ Kaydedildi</span>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Section = 'config' | 'prompts'

export default function AdminPipeline() {
  const [section, setSection] = useState<Section>('config')

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['pipeline-config'],
    queryFn: fetchPipelineConfig,
  })

  const { data: stats } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: fetchPipelineStats,
    refetchInterval: 15_000,
  })

  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ['pipeline-prompts'],
    queryFn: fetchPipelinePrompts,
    enabled: section === 'prompts',
  })

  const statOrder = ['published', 'pending_human', 'pending_ai', 'rejected_ai']

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Pipeline</p>
            <h1 className="text-xl font-bold text-white">Pipeline Yönetimi</h1>
            <p className="mt-1 text-xs text-gray-500">Eşikler, dedup ayarları ve AI prompt'larını düzenle</p>
          </div>
          {/* Stats */}
          <div className="flex flex-wrap gap-2 justify-end">
            {stats && statOrder.map((status) => {
              const count = stats[status] ?? 0
              if (!count && status !== 'published') return null
              return (
                <div key={status} className={`rounded-xl border px-3 py-2 text-center min-w-[64px] ${STATUS_STYLE[status] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  <p className="text-lg font-bold tabular-nums leading-none">{count}</p>
                  <p className="mt-0.5 text-[9px] font-bold tracking-wider uppercase opacity-70">
                    {STATUS_LABEL[status] ?? status}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 w-fit">
        {(['config', 'prompts'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`rounded-lg px-5 py-1.5 text-xs font-bold transition ${
              section === s ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s === 'config' ? 'Ayarlar' : 'AI Promptları'}
          </button>
        ))}
      </div>

      {section === 'config' && (
        configLoading
          ? <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          : config ? <ConfigCard config={config} /> : null
      )}

      {section === 'prompts' && (
        promptsLoading
          ? <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          : prompts
            ? (
              <div className="space-y-5">
                <PromptEditor promptKey="quality_check" label="Call A — Kalite Filtresi" info={prompts.quality_check} />
                <PromptEditor promptKey="enrich" label="Call B — Makale Yeniden Yazma" info={prompts.enrich} />
              </div>
            )
            : null
      )}
    </div>
  )
}
