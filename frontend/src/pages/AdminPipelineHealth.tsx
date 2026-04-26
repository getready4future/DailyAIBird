import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/client'

interface DriftDay {
  day: string
  runs: number
  found: number
  ai_processed: number
  tokens: number
  pass_rate: number | null
  mean_confidence: number | null
  mean_relevance: number | null
  mean_curiosity: number | null
}

interface SourceHealth {
  id: number
  slug: string
  name: string
  is_active: boolean
  health_score: number
  consecutive_failures: number
  publish_rate_30d: number
  auto_disabled_at: string | null
  last_scraped_at: string | null
}

function Sparkline({
  values, max, color, height = 32, width = 220,
}: { values: (number | null)[]; max: number; color: string; height?: number; width?: number }) {
  const pts = values.filter((v): v is number => v !== null && v !== undefined)
  if (pts.length === 0) {
    return <div className="text-[10px] text-gray-700">no data</div>
  }
  const m = Math.max(max, ...pts) || 1
  const step = width / Math.max(values.length - 1, 1)
  const path = values
    .map((v, i) => {
      if (v === null || v === undefined) return null
      const x = i * step
      const y = height - (v / m) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .filter(Boolean)
    .join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
      {values.map((v, i) => {
        if (v === null || v === undefined) return null
        const x = i * step
        const y = height - (v / m) * height
        return <circle key={i} cx={x} cy={y} r={1.5} fill={color} />
      })}
    </svg>
  )
}

function HealthBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.7 ? 'bg-emerald-500' :
    value >= 0.4 ? 'bg-amber-500' :
    'bg-red-500'
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-1.5 flex-1 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-gray-400 shrink-0">{pct}%</span>
    </div>
  )
}

export default function AdminPipelineHealth() {
  const qc = useQueryClient()
  const [days, setDays] = useState(14)

  const drift = useQuery({
    queryKey: ['admin-drift', days],
    queryFn: async () => {
      const { data } = await adminApi.get(`/admin/pipeline/drift?days=${days}`)
      return data as { days: number; data: DriftDay[] }
    },
  })

  const health = useQuery({
    queryKey: ['admin-sources-health'],
    queryFn: async () => {
      const { data } = await adminApi.get('/admin/sources/health')
      return data as SourceHealth[]
    },
  })

  const reactivate = useMutation({
    mutationFn: async (sourceId: number) => {
      await adminApi.post(`/admin/sources/${sourceId}/reactivate`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sources-health'] }),
  })

  const driftDays = drift.data?.data ?? []
  const passRates = driftDays.map((d) => d.pass_rate)
  const tokensPerDay = driftDays.map((d) => d.tokens)
  const aiProcessedPerDay = driftDays.map((d) => d.ai_processed)
  const meanConfidence = driftDays.map((d) => d.mean_confidence)
  const meanRelevance = driftDays.map((d) => d.mean_relevance)
  const meanCuriosity = driftDays.map((d) => d.mean_curiosity)

  const totalRuns = driftDays.reduce((s, d) => s + (d.runs || 0), 0)
  const totalProcessed = driftDays.reduce((s, d) => s + (d.ai_processed || 0), 0)
  const totalTokens = driftDays.reduce((s, d) => s + (d.tokens || 0), 0)
  const recentPassRate = passRates.filter((p): p is number => p !== null).slice(-3)
  const olderPassRate = passRates.filter((p): p is number => p !== null).slice(0, -3)
  const recentMean = recentPassRate.length ? recentPassRate.reduce((a, b) => a + b, 0) / recentPassRate.length : null
  const olderMean = olderPassRate.length ? olderPassRate.reduce((a, b) => a + b, 0) / olderPassRate.length : null
  const passRateDelta = recentMean !== null && olderMean !== null ? recentMean - olderMean : null

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pipeline Health</h1>
          <p className="text-xs text-gray-500">Drift, kaynak sağlığı ve günlük metrikler</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Pencere:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 focus:border-brand-500 focus:outline-none"
          >
            <option value={7}>7 gün</option>
            <option value={14}>14 gün</option>
            <option value={30}>30 gün</option>
            <option value={60}>60 gün</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600">Toplam run</p>
          <p className="mt-1 text-xl font-bold text-gray-100 tabular-nums">{totalRuns}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600">İşlenen makale</p>
          <p className="mt-1 text-xl font-bold text-gray-100 tabular-nums">{totalProcessed.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600">Toplam token</p>
          <p className="mt-1 text-xl font-bold text-gray-100 tabular-nums">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-600">Pass-rate trend</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${
            passRateDelta === null ? 'text-gray-500' :
            passRateDelta > 5 ? 'text-emerald-400' :
            passRateDelta < -5 ? 'text-red-400' : 'text-gray-300'
          }`}>
            {passRateDelta === null ? '—' : `${passRateDelta > 0 ? '+' : ''}${passRateDelta.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Drift sparklines */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-5">
        <h2 className="text-sm font-bold text-gray-200 mb-4">Drift trendleri ({days} gün)</h2>
        {drift.isLoading ? (
          <div className="text-sm text-gray-500">Yükleniyor…</div>
        ) : driftDays.length === 0 ? (
          <div className="text-sm text-gray-600">Bu pencerede tamamlanmış run yok.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Pass-rate (%)</p>
                <p className="text-[10px] text-gray-600">Call A → publish oranı</p>
              </div>
              <Sparkline values={passRates} max={100} color="#10b981" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Günlük makale</p>
                <p className="text-[10px] text-gray-600">AI ile işlenen</p>
              </div>
              <Sparkline values={aiProcessedPerDay} max={Math.max(...aiProcessedPerDay, 10)} color="#60a5fa" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Token kullanımı</p>
                <p className="text-[10px] text-gray-600">Günlük toplam</p>
              </div>
              <Sparkline values={tokensPerDay} max={Math.max(...tokensPerDay, 1000)} color="#fbbf24" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Ortalama güven</p>
                <p className="text-[10px] text-gray-600">Call A confidence skoru</p>
              </div>
              <Sparkline values={meanConfidence} max={5} color="#a78bfa" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Ortalama ilgi</p>
                <p className="text-[10px] text-gray-600">consumer relevance</p>
              </div>
              <Sparkline values={meanRelevance} max={5} color="#f472b6" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-300">Ortalama merak</p>
                <p className="text-[10px] text-gray-600">curiosity</p>
              </div>
              <Sparkline values={meanCuriosity} max={5} color="#fb923c" />
            </div>
          </div>
        )}
      </div>

      {/* Sources health table */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-5">
        <h2 className="text-sm font-bold text-gray-200 mb-4">Kaynak sağlığı</h2>
        {health.isLoading ? (
          <div className="text-sm text-gray-500">Yükleniyor…</div>
        ) : !health.data || health.data.length === 0 ? (
          <div className="text-sm text-gray-600">Henüz kaynak verisi yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-left text-[10px] uppercase tracking-widest text-gray-600">
                  <th className="pb-2 pr-4 font-semibold">Kaynak</th>
                  <th className="pb-2 pr-4 font-semibold">Durum</th>
                  <th className="pb-2 pr-4 font-semibold">Sağlık</th>
                  <th className="pb-2 pr-4 font-semibold">Yayın oranı (30g)</th>
                  <th className="pb-2 pr-4 font-semibold">Ardışık fail</th>
                  <th className="pb-2 pr-4 font-semibold">Son scrape</th>
                  <th className="pb-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {health.data.map((s) => {
                  const lastScraped = s.last_scraped_at ? new Date(s.last_scraped_at) : null
                  const daysSince = lastScraped
                    ? Math.round((Date.now() - lastScraped.getTime()) / 86400000)
                    : null
                  return (
                    <tr key={s.id} className="text-gray-300">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-gray-200">{s.name}</div>
                        <div className="text-[10px] text-gray-600">{s.slug}</div>
                      </td>
                      <td className="py-2 pr-4">
                        {s.is_active ? (
                          <span className="rounded-full border border-emerald-800/40 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            ✓ aktif
                          </span>
                        ) : s.auto_disabled_at ? (
                          <span className="rounded-full border border-red-800/40 bg-red-950/30 px-2 py-0.5 text-[10px] font-bold text-red-400">
                            ✗ otomatik kapatıldı
                          </span>
                        ) : (
                          <span className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                            kapalı
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 min-w-[120px]">
                        <HealthBar value={s.health_score} />
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-gray-400">
                        {(s.publish_rate_30d * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        <span className={
                          s.consecutive_failures >= 3 ? 'text-red-400 font-bold' :
                          s.consecutive_failures > 0  ? 'text-amber-400' : 'text-gray-600'
                        }>
                          {s.consecutive_failures}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-[11px] text-gray-500">
                        {daysSince === null ? '—' : daysSince === 0 ? 'bugün' : `${daysSince}g önce`}
                      </td>
                      <td className="py-2">
                        {!s.is_active && s.auto_disabled_at && (
                          <button
                            onClick={() => reactivate.mutate(s.id)}
                            disabled={reactivate.isPending}
                            className="rounded-lg border border-brand-700 bg-brand-900/30 px-3 py-1 text-[10px] font-bold text-brand-300 hover:bg-brand-900/60 transition disabled:opacity-40"
                          >
                            ↻ etkinleştir
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
