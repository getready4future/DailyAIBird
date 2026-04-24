import { useQuery } from '@tanstack/react-query'
import { fetchModels, type ModelStatus } from '../api/admin'
import Spinner from '../components/ui/Spinner'

interface ModelStatusEx extends ModelStatus {
  role?: 'primary' | 'fallback'
}

function ModelRow({ model, index }: { model: ModelStatusEx; index: number }) {
  const isAvailable = model.status === 'available'
  const isPrimary   = model.role === 'primary'

  // Strip the [OpenRouter] / [NVIDIA] prefix for display
  const displayName = model.name.replace(/^\[(OpenRouter|NVIDIA)\]\s*/, '')
  const provider    = model.name.match(/^\[(\w+)\]/)?.[1] ?? 'NVIDIA'

  const providerColor =
    provider === 'OpenRouter' ? 'bg-violet-900/40 border-violet-700/50 text-violet-400' :
                                'bg-gray-800 border-gray-700 text-gray-500'

  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition ${
      isAvailable
        ? 'border-gray-800 bg-gray-900 hover:border-gray-700'
        : 'border-gray-800/50 bg-gray-900/50 opacity-60'
    } ${isPrimary ? 'ring-1 ring-brand-700/40' : ''}`}>

      {/* Priority / role badge */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        isPrimary ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'
      }`}>
        {index + 1}
      </div>

      {/* Model info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${providerColor}`}>
            {provider}
          </span>
          {isPrimary && (
            <span className="shrink-0 rounded-full border border-brand-700/50 bg-brand-950/50 px-2 py-0.5 text-[9px] font-bold text-brand-400">
              PRIMARY
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 truncate">
          {isPrimary ? 'Main model — used for every article' : 'Fallback — used if primary fails'}
        </p>
      </div>

      {/* Status */}
      <div className="shrink-0 text-right">
        {isAvailable ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 border border-emerald-800/50 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Available
          </span>
        ) : (
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/30 border border-amber-800/50 px-3 py-1 text-xs font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Cooldown
            </span>
            {model.cooldown_remaining_sec > 0 && (
              <p className="mt-1 text-right text-[10px] text-gray-600">
                {model.cooldown_remaining_sec}s remaining
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminModels() {
  const { data: models = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin-models'],
    queryFn: fetchModels,
    refetchInterval: 10_000,
  })

  const available  = models.filter((m) => m.status === 'available').length
  const onCooldown = models.filter((m) => m.status === 'cooldown').length
  const primary    = (models as ModelStatusEx[]).find((m) => m.role === 'primary')

  return (
    <div>
      {/* Header */}
      <div className="mb-6 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">AI Models</p>
            <h1 className="text-xl font-bold text-white">Model Chain</h1>
            <p className="mt-1 text-xs text-gray-500">
              {primary
                ? `Primary: ${primary.name.replace(/^\[OpenRouter\]\s*/, '')} · NVIDIA chain as fallback`
                : 'NVIDIA multiplex chain — models tried in order on rate-limit or timeout'}
            </p>
          </div>
          <div className="flex gap-6 text-center shrink-0">
            <div>
              <p className="text-3xl font-bold text-emerald-400">{available}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Ready</p>
            </div>
            {onCooldown > 0 && (
              <div>
                <p className="text-3xl font-bold text-amber-400">{onCooldown}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cooldown</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 px-5 py-4">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase">How It Works</p>
        <div className="grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-brand-500">1.</span>
            <span>Every article goes through Call A (quality gate, ~400 tokens) using the primary model.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-brand-500">2.</span>
            <span>Approved articles get Call B (full rewrite, ~1200 tokens) — same model priority.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 font-bold text-brand-500">3.</span>
            <span>On any failure, NVIDIA chain is tried next. Each NVIDIA model has its own 30s cooldown.</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : models.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
          <p className="text-sm text-gray-500">No models loaded yet — run a scrape to initialize the AI client.</p>
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
