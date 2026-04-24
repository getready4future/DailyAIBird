import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchModels, fetchAiProvider, setAiProvider, type ModelStatus, type AiProviderInfo } from '../api/admin'
import Spinner from '../components/ui/Spinner'

interface ModelStatusEx extends ModelStatus {
  role?: 'primary' | 'fallback'
}

// ── Provider selector ─────────────────────────────────────────────────────────

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
      color: 'border-violet-600 bg-violet-900/30 text-violet-300',
      dot: 'bg-violet-400',
    },
    {
      key: 'nvidia' as const,
      label: 'NVIDIA Chain',
      sub: '10-model fallback chain',
      available: info.nvidia_available,
      color: 'border-emerald-600 bg-emerald-900/30 text-emerald-300',
      dot: 'bg-emerald-400',
    },
  ]

  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="mb-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Active Provider</p>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const isActive = info.active === opt.key
          const isLoading = switchMut.isPending && switchMut.variables === opt.key
          return (
            <button
              key={opt.key}
              disabled={!opt.available || switchMut.isPending}
              onClick={() => switchMut.mutate(opt.key)}
              className={`relative flex flex-1 min-w-[180px] flex-col items-start rounded-xl border px-5 py-4 text-left transition ${
                isActive
                  ? opt.color
                  : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
              } ${!opt.available ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
            >
              <div className="mb-1.5 flex w-full items-center justify-between gap-2">
                <span className="text-sm font-bold">{opt.label}</span>
                {isActive && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                    <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${opt.dot}`} />
                    Active
                  </span>
                )}
                {isLoading && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
              </div>
              <span className="text-[11px] opacity-70">{opt.sub}</span>
              {!opt.available && (
                <span className="mt-1 text-[10px] text-red-500">API key not configured</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Model row ─────────────────────────────────────────────────────────────────

function ModelRow({ model, index }: { model: ModelStatusEx; index: number }) {
  const isAvailable = model.status === 'available'
  const isPrimary   = model.role === 'primary'
  const provider    = model.name.match(/^\[(\w+)\]/)?.[1] ?? 'NVIDIA'
  const displayName = model.name.replace(/^\[(OpenRouter|NVIDIA)\]\s*/, '')

  const providerBadge =
    provider === 'OpenRouter'
      ? 'border-violet-700/50 bg-violet-900/30 text-violet-400'
      : 'border-gray-700 bg-gray-800 text-gray-500'

  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 transition ${
      isAvailable ? 'border-gray-800 bg-gray-900 hover:border-gray-700' : 'border-gray-800/50 bg-gray-900/50 opacity-50'
    } ${isPrimary ? 'ring-1 ring-brand-700/30' : ''}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        isPrimary ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-500'
      }`}>
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${providerBadge}`}>
            {provider}
          </span>
          {isPrimary && (
            <span className="shrink-0 rounded-full border border-brand-700/50 bg-brand-950/40 px-1.5 py-0.5 text-[9px] font-bold text-brand-400">
              PRIMARY
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-600">
          {isPrimary ? 'Main model — used for every article' : 'Fallback — activated when primary fails'}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {isAvailable ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Ready
          </span>
        ) : (
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-800/50 bg-amber-900/20 px-2.5 py-1 text-xs font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Cooldown
            </span>
            {model.cooldown_remaining_sec > 0 && (
              <p className="mt-1 text-right text-[10px] text-gray-600">{model.cooldown_remaining_sec}s</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminModels() {
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

  const available  = models.filter((m) => m.status === 'available').length
  const onCooldown = models.filter((m) => m.status === 'cooldown').length

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">AI Models</p>
            <h1 className="text-xl font-bold text-white">Model Chain</h1>
            <p className="mt-1 text-xs text-gray-500">
              Select your primary AI provider. The chain falls back automatically on failure.
            </p>
          </div>
          <div className="flex shrink-0 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-emerald-400">{available}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Ready</p>
            </div>
            {onCooldown > 0 && (
              <div>
                <p className="text-3xl font-bold text-amber-400">{onCooldown}</p>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Cooldown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provider toggle */}
      {providerInfo && <ProviderSelector info={providerInfo} />}

      {/* How it works */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/40 px-5 py-4">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase">How It Works</p>
        <div className="grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-brand-500">1.</span>
            <span>Call A (quality gate, ~400 tokens) decides publish vs skip.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-brand-500">2.</span>
            <span>Call B (full rewrite, ~1200 tokens) enriches approved articles.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-brand-500">3.</span>
            <span>On any failure, next provider in chain is tried automatically.</span>
          </div>
        </div>
      </div>

      {/* Model list */}
      {modelsLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : models.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
          <p className="text-sm text-gray-500">No models loaded yet — trigger a scrape to initialize the AI client.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(models as ModelStatusEx[]).map((model, i) => (
            <ModelRow key={model.name} model={model} index={i} />
          ))}
        </div>
      )}

      {dataUpdatedAt > 0 && (
        <p className="mt-4 text-center text-[10px] text-gray-700">
          Auto-refreshes every 10s · Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
