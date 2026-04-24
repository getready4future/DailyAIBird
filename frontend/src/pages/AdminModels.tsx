import { useQuery } from '@tanstack/react-query'
import { fetchModels, type ModelStatus } from '../api/admin'
import Spinner from '../components/ui/Spinner'

const MODEL_DESCRIPTIONS: Record<string, string> = {
  'deepseek-ai/deepseek-v3.1-terminus':          'DeepSeek V3.1 · Fast, high-quality reasoning',
  'moonshotai/kimi-k2-instruct-0905':            'Kimi K2 · Strong instruction-following, multilingual',
  'meta/llama-3.3-70b-instruct':                 'Llama 3.3 70B · Meta, balanced performance',
  'mistralai/mistral-large-3-675b-instruct-2512':'Mistral Large 3 675B · High-capacity Mixtral',
  'z-ai/glm4.7':                                 'GLM-4.7 · Zhipu AI, fast and capable',
  'moonshotai/kimi-k2.5':                        'Kimi K2.5 · Moonshot AI, compact',
  'meta/llama-4-maverick-17b-128e-instruct':     'Llama 4 Maverick 17B · Efficient MoE',
  'mistralai/mistral-medium-3-instruct':         'Mistral Medium 3 · Balanced cost & quality',
  'bytedance/seed-oss-36b-instruct':             'Seed OSS 36B · ByteDance open model',
  'google/gemma-3-27b-it':                       'Gemma 3 27B · Google, instruction-tuned',
}

function ModelRow({ model, index }: { model: ModelStatus; index: number }) {
  const isAvailable = model.status === 'available'
  const shortName = model.name.split('/').pop() || model.name
  const desc = MODEL_DESCRIPTIONS[model.name] || model.name

  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition ${
      isAvailable
        ? 'border-gray-800 bg-gray-900 hover:border-gray-700'
        : 'border-gray-800/50 bg-gray-900/50 opacity-60'
    }`}>
      {/* Priority badge */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        index === 0 ? 'bg-brand-700 text-white' : 'bg-gray-800 text-gray-400'
      }`}>
        {index + 1}
      </div>

      {/* Model info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{shortName}</p>
        <p className="text-xs text-gray-500 truncate">{desc}</p>
      </div>

      {/* Status */}
      <div className="shrink-0 text-right">
        {isAvailable ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 border border-emerald-800/50 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Available
          </span>
        ) : (
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/30 border border-amber-800/50 px-3 py-1 text-xs font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Cooldown
            </span>
            <p className="mt-1 text-[10px] text-gray-600 text-right">
              {model.cooldown_remaining_sec}s remaining
            </p>
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

  const available = models.filter((m) => m.status === 'available').length
  const onCooldown = models.filter((m) => m.status === 'cooldown').length

  return (
    <div>
      {/* Header */}
      <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">AI Models</p>
            <h1 className="text-xl font-bold text-white">NVIDIA Multiplex Chain</h1>
            <p className="mt-1 text-xs text-gray-500">
              Models are tried in order. On rate-limit or timeout, the next one is used automatically.
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

      {/* Explainer */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/50 px-5 py-4">
        <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">How It Works</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs text-gray-400">
          <div className="flex items-start gap-2">
            <span className="text-brand-500 font-bold shrink-0">1.</span>
            <span>Call A (quality gate) uses ~400 tokens. Fastest models tried first.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand-500 font-bold shrink-0">2.</span>
            <span>Call B (rewrite) uses ~1200 tokens. Same fallback chain applies.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-brand-500 font-bold shrink-0">3.</span>
            <span>On 429 rate-limit or timeout, model enters 30s cooldown and next is tried.</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : models.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center">
          <p className="text-gray-500 text-sm">No models loaded yet — run a scrape to initialize the AI client.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {models.map((model, i) => (
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
