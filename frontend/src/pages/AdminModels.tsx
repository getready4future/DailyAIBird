import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchModels, fetchAiProvider, setAiProvider,
  fetchModelChain, updateModelChain,
  type ModelStatus, type AiProviderInfo, type ModelChainConfig,
} from '../api/admin'
import Spinner from '../components/ui/Spinner'

interface ModelStatusEx extends ModelStatus {
  role?: 'primary' | 'fallback'
}

// ── Provider toggle ────────────────────────────────────────────────────────────

function ProviderSelector({ info }: { info: AiProviderInfo }) {
  const qc = useQueryClient()
  const switchMut = useMutation({
    mutationFn: setAiProvider,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-provider'] })
      qc.invalidateQueries({ queryKey: ['admin-models'] })
    },
  })

  const options = [
    {
      key: 'openrouter' as const,
      label: 'OpenRouter',
      sub: info.openrouter_model.replace(':free', '') + ' · free tier',
      available: info.openrouter_available,
      activeCls: 'border-violet-600 bg-violet-900/30 text-violet-300',
      dot: 'bg-violet-400',
    },
    {
      key: 'nvidia' as const,
      label: 'NVIDIA Chain',
      sub: '10-model fallback chain',
      available: info.nvidia_available,
      activeCls: 'border-emerald-600 bg-emerald-900/30 text-emerald-300',
      dot: 'bg-emerald-400',
    },
  ]

  return (
    <div className="mb-5 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="mb-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Active Provider</p>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const isActive  = info.active === opt.key
          const isLoading = switchMut.isPending && switchMut.variables === opt.key
          return (
            <button key={opt.key}
              disabled={!opt.available || switchMut.isPending}
              onClick={() => switchMut.mutate(opt.key)}
              className={`relative flex flex-1 min-w-[180px] flex-col items-start rounded-xl border px-5 py-4 text-left transition ${
                isActive ? opt.activeCls : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              } ${!opt.available ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
            >
              <div className="mb-1.5 flex w-full items-center justify-between gap-2">
                <span className="text-sm font-bold">{opt.label}</span>
                {isActive && !isLoading && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                    <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${opt.dot}`} />
                    Active
                  </span>
                )}
                {isLoading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              </div>
              <span className="text-[11px] opacity-70">{opt.sub}</span>
              {!opt.available && <span className="mt-1 text-[10px] text-red-500">API key not configured</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Chain editor ───────────────────────────────────────────────────────────────

function ChainEditor({ chain: initial, defaultChain, openrouterModel: initialOrModel }: {
  chain: string[]
  defaultChain: string[]
  openrouterModel: string
}) {
  const qc = useQueryClient()
  const [chain, setChain] = useState<string[]>(initial)
  const [orModel, setOrModel] = useState(initialOrModel)
  const [newModel, setNewModel] = useState('')
  const [dirty, setDirty] = useState(false)
  const [orDirty, setOrDirty] = useState(false)

  const saveMut = useMutation({
    mutationFn: updateModelChain,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['model-chain'] })
      qc.invalidateQueries({ queryKey: ['admin-models'] })
      setDirty(false)
      setOrDirty(false)
    },
  })

  function moveUp(i: number) {
    if (i === 0) return
    const next = [...chain]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    setChain(next); setDirty(true)
  }

  function moveDown(i: number) {
    if (i === chain.length - 1) return
    const next = [...chain]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    setChain(next); setDirty(true)
  }

  function removeModel(i: number) {
    setChain(chain.filter((_, idx) => idx !== i)); setDirty(true)
  }

  function addModel() {
    const m = newModel.trim()
    if (!m || chain.includes(m)) return
    setChain([...chain, m]); setNewModel(''); setDirty(true)
  }

  function addSuggestion(m: string) {
    if (chain.includes(m)) return
    setChain([...chain, m]); setDirty(true)
  }

  function restoreDefaults() {
    setChain([...defaultChain]); setDirty(true)
  }

  function handleSave() {
    const body: { nvidia_chain?: string[]; openrouter_model?: string } = {}
    if (dirty)   body.nvidia_chain    = chain
    if (orDirty) body.openrouter_model = orModel
    saveMut.mutate(body)
  }

  const suggestions = defaultChain.filter((m) => !chain.includes(m))

  return (
    <div className="space-y-5">
      {/* OpenRouter model */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">OpenRouter Model</p>
        <p className="mb-3 text-[11px] text-gray-600">Model ID as shown on openrouter.ai/models</p>
        <div className="flex gap-2">
          <input
            value={orModel}
            onChange={(e) => { setOrModel(e.target.value); setOrDirty(true) }}
            placeholder="google/gemma-4-31b-it:free"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* NVIDIA chain */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">NVIDIA Fallback Chain</p>
            <p className="mt-0.5 text-[11px] text-gray-600">Models are tried top-to-bottom. Drag arrows to reorder.</p>
          </div>
          <button onClick={restoreDefaults}
            className="text-[10px] font-semibold text-gray-600 hover:text-gray-400 transition">
            ↺ Restore defaults
          </button>
        </div>

        {/* Chain list */}
        <div className="mb-4 space-y-1.5">
          {chain.map((model, i) => (
            <div key={model}
              className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2.5">
              {/* Priority number */}
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i === 0 ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {i + 1}
              </span>

              {/* Move buttons */}
              <div className="flex shrink-0 flex-col gap-0.5">
                <button onClick={() => moveUp(i)} disabled={i === 0}
                  className="rounded px-1 text-[10px] text-gray-600 hover:bg-gray-700 hover:text-gray-300 disabled:opacity-20 transition leading-none">
                  ▲
                </button>
                <button onClick={() => moveDown(i)} disabled={i === chain.length - 1}
                  className="rounded px-1 text-[10px] text-gray-600 hover:bg-gray-700 hover:text-gray-300 disabled:opacity-20 transition leading-none">
                  ▼
                </button>
              </div>

              {/* Model name */}
              <span className="flex-1 truncate font-mono text-xs text-gray-200">{model}</span>

              {/* Remove */}
              <button onClick={() => removeModel(i)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-gray-600 hover:bg-red-950/40 hover:text-red-400 transition">
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add custom model */}
        <div className="mb-4 flex gap-2">
          <input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addModel()}
            placeholder="provider/model-name"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
          <button onClick={addModel} disabled={!newModel.trim() || chain.includes(newModel.trim())}
            className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-bold text-gray-300 transition hover:border-brand-500 hover:text-white disabled:opacity-40">
            + Add
          </button>
        </div>

        {/* Suggestions — models from default not currently in chain */}
        {suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Quick-add</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((m) => (
                <button key={m} onClick={() => addSuggestion(m)}
                  className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 font-mono text-[10px] text-gray-500 transition hover:border-brand-600 hover:text-white">
                  + {m.split('/').pop()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save bar */}
      {(dirty || orDirty) && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-700/40 bg-brand-950/30 px-5 py-3">
          <span className="flex-1 text-xs text-brand-300">Unsaved changes</span>
          <button onClick={() => { setChain(initial); setOrModel(initialOrModel); setDirty(false); setOrDirty(false) }}
            className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs text-gray-400 transition hover:text-white">
            Discard
          </button>
          <button onClick={handleSave} disabled={saveMut.isPending}
            className="rounded-lg bg-brand-600 px-5 py-1.5 text-xs font-bold text-white transition hover:bg-brand-500 disabled:opacity-50">
            {saveMut.isPending ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      )}

      {saveMut.isError && (
        <p className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-2 text-xs text-red-400">
          {(saveMut.error as any)?.response?.data?.detail || 'Save failed.'}
        </p>
      )}
    </div>
  )
}

// ── Live model status list ────────────────────────────────────────────────────

function ModelRow({ model, index }: { model: ModelStatusEx; index: number }) {
  const isAvailable = model.status === 'available'
  const isPrimary   = model.role === 'primary'
  const provider    = model.name.match(/^\[(\w+)\]/)?.[1] ?? 'NVIDIA'
  const displayName = model.name.replace(/^\[(OpenRouter|NVIDIA)\]\s*/, '')

  const providerBadge = provider === 'OpenRouter'
    ? 'border-violet-700/50 bg-violet-900/30 text-violet-400'
    : 'border-gray-700 bg-gray-800 text-gray-500'

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
      isAvailable ? 'border-gray-800 bg-gray-900 hover:border-gray-700' : 'border-gray-800/50 bg-gray-900/40 opacity-50'
    } ${isPrimary ? 'ring-1 ring-brand-700/30' : ''}`}>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        isPrimary ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500'
      }`}>
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-white">{displayName}</p>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${providerBadge}`}>
            {provider}
          </span>
          {isPrimary && (
            <span className="shrink-0 rounded-full border border-brand-700/50 bg-brand-950/40 px-1.5 py-0.5 text-[9px] font-bold text-brand-400">
              PRIMARY
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {isAvailable ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/50 bg-emerald-900/30 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Ready
          </span>
        ) : (
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-800/50 bg-amber-900/20 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Cooldown
            </span>
            {model.cooldown_remaining_sec > 0 && (
              <p className="mt-0.5 text-right text-[9px] text-gray-600">{model.cooldown_remaining_sec}s</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminModels() {
  const [tab, setTab] = useState<'status' | 'config'>('status')

  const { data: models = [], isLoading: modelsLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin-models'],
    queryFn: fetchModels,
    refetchInterval: 10_000,
  })
  const { data: providerInfo } = useQuery({
    queryKey: ['ai-provider'],
    queryFn: fetchAiProvider,
    refetchInterval: 10_000,
  })
  const { data: chainConfig, isLoading: chainLoading } = useQuery({
    queryKey: ['model-chain'],
    queryFn: fetchModelChain,
  })

  const available  = models.filter((m) => m.status === 'available').length
  const onCooldown = models.filter((m) => m.status === 'cooldown').length

  return (
    <div>
      {/* Header */}
      <div className="mb-5 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">AI Models</p>
            <h1 className="text-xl font-bold text-white">Model Chain</h1>
            <p className="mt-1 text-xs text-gray-500">
              Select primary provider · configure chain order · monitor live status
            </p>
          </div>
          <div className="flex shrink-0 gap-5 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{available}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Ready</p>
            </div>
            {onCooldown > 0 && (
              <div>
                <p className="text-2xl font-bold text-amber-400">{onCooldown}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Cooldown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provider toggle — always visible */}
      {providerInfo && <ProviderSelector info={providerInfo} />}

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {(['status', 'config'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-bold capitalize transition ${
              tab === t ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'
            }`}>
            {t === 'status' ? '📊 Live Status' : '⚙️ Configure Chain'}
          </button>
        ))}
      </div>

      {/* Status tab */}
      {tab === 'status' && (
        <>
          {modelsLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : models.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
              <p className="text-sm text-gray-500">
                No models loaded yet — trigger a scrape to initialize the AI client.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(models as ModelStatusEx[]).map((model, i) => (
                <ModelRow key={model.name} model={model} index={i} />
              ))}
            </div>
          )}
          {dataUpdatedAt > 0 && (
            <p className="mt-4 text-center text-[10px] text-gray-700">
              Auto-refreshes every 10s · {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </>
      )}

      {/* Config tab */}
      {tab === 'config' && (
        chainLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : chainConfig ? (
          <ChainEditor
            chain={chainConfig.nvidia_chain}
            defaultChain={chainConfig.default_chain}
            openrouterModel={chainConfig.openrouter_model}
          />
        ) : null
      )}
    </div>
  )
}
