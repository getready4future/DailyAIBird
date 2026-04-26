import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../api/client'
import { getAdminToken } from '../api/admin'
import type { AdminSource } from '../api/admin'

interface PipelineRunSummary {
  id: number
  started_at: string
  completed_at: string | null
  status: 'running' | 'success' | 'failed'
  source_slug: string
  total_found: number
  total_new: number
  total_ai_processed: number
  error_message: string | null
}

interface PipelineEvent {
  message: string
  kind: string
  ts: number
  url?: string
  source?: string
  image_url?: string
  topic?: string
  decision?: string
  quality?: number
  relevance?: number
  confidence?: number
  curiosity?: number
  core_claim?: string
  why_it_matters?: string
  reason?: string
  preview?: string
  detail?: string
  cluster_size?: number
  sources?: string[]
  primary_source?: string
  count?: number
  current?: number
  total?: number
  new?: number
  skip_old?: number
  skip_url?: number
  skip_title?: number
  elapsed?: number
  elapsed_a?: number
  elapsed_b?: number
  elapsed_total?: number
}

const TOPIC_COLORS: Record<string, string> = {
  research:    'bg-violet-900/50 text-violet-300 border-violet-700/40',
  products:    'bg-blue-900/50 text-blue-300 border-blue-700/40',
  agents:      'bg-purple-900/50 text-purple-300 border-purple-700/40',
  business:    'bg-emerald-900/50 text-emerald-300 border-emerald-700/40',
  safety:      'bg-amber-900/50 text-amber-300 border-amber-700/40',
  policy:      'bg-slate-800/50 text-slate-300 border-slate-600/40',
  tools:       'bg-sky-900/50 text-sky-300 border-sky-700/40',
  open_source: 'bg-green-900/50 text-green-300 border-green-700/40',
}

function TopicPill({ topic }: { topic: string }) {
  const cls = TOPIC_COLORS[topic] ?? 'bg-gray-800/50 text-gray-400 border-gray-700/40'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${cls}`}>
      {topic}
    </span>
  )
}

function ScoreBar({ label, value, max = 5, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] uppercase tracking-wide text-gray-600 shrink-0">{label}</span>
        <span className={`text-[10px] font-bold tabular-nums ${color}`}>{value}/{max}</span>
      </div>
      <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Timestamp({ ts }: { ts: number }) {
  const d = new Date(ts * 1000)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return <span className="shrink-0 font-mono text-[9px] text-gray-700">{hh}:{mm}:{ss}</span>
}

function EventCard({ event }: { event: PipelineEvent }) {
  if (event.kind === 'done') {
    return (
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-center">
        <p className="text-sm font-bold text-emerald-400">✓ Pipeline tamamlandı!</p>
      </div>
    )
  }

  if (event.kind === 'source_start') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-gray-800" />
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-brand-700/40 bg-brand-950/30 px-3 py-0.5 text-[10px] font-bold tracking-widest text-brand-400 uppercase">
            {event.source ?? event.message}
          </span>
          <Timestamp ts={event.ts} />
        </div>
        <div className="h-px flex-1 bg-gray-800" />
      </div>
    )
  }

  if (event.kind === 'info') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Timestamp ts={event.ts} />
        <p className="text-[10px] text-gray-600">{event.message}</p>
      </div>
    )
  }

  if (event.kind === 'scrape') {
    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <Timestamp ts={event.ts} />
        <p className="text-[10px] font-semibold text-emerald-600">{event.message}</p>
      </div>
    )
  }

  if (event.kind === 'fetch_start') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Timestamp ts={event.ts} />
        <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-gray-600 border-t-gray-300" />
        <p className="text-[10px] text-gray-500">HTTP isteği gönderiliyor…</p>
      </div>
    )
  }

  if (event.kind === 'fetch_done') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Timestamp ts={event.ts} />
        <span className="text-[10px] text-gray-500">✓</span>
        <p className="text-[10px] text-gray-400">
          <span className="font-semibold text-gray-200">{event.count}</span> makale alındı
        </p>
      </div>
    )
  }

  if (event.kind === 'skip_old') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 opacity-50">
        <Timestamp ts={event.ts} />
        <span className="text-[9px] text-gray-600">🕐</span>
        <p className="flex-1 truncate text-[10px] text-gray-600">{event.message}</p>
        <span className="shrink-0 text-[9px] text-gray-700">eski</span>
      </div>
    )
  }

  if (event.kind === 'skip_url') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 opacity-50">
        <Timestamp ts={event.ts} />
        <span className="text-[9px] text-gray-600">🔗</span>
        <p className="flex-1 truncate text-[10px] text-gray-600">{event.message}</p>
        <span className="shrink-0 text-[9px] text-gray-700">url-tekrar</span>
      </div>
    )
  }

  if (event.kind === 'skip_title') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 opacity-50">
        <Timestamp ts={event.ts} />
        <span className="text-[9px] text-gray-600">≈</span>
        <p className="flex-1 truncate text-[10px] text-gray-600">{event.message}</p>
        <span className="shrink-0 text-[9px] text-gray-700">benzer</span>
      </div>
    )
  }

  if (event.kind === 'source_done') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-900/60 px-3 py-2 text-[10px]">
        <Timestamp ts={event.ts} />
        <span className="font-semibold text-gray-300">{event.source}</span>
        <span className="text-emerald-400">+{event.new ?? 0} yeni</span>
        {(event.skip_old ?? 0) > 0 && <span className="text-gray-600">{event.skip_old} eski</span>}
        {(event.skip_url ?? 0) > 0 && <span className="text-gray-600">{event.skip_url} url-tekrar</span>}
        {(event.skip_title ?? 0) > 0 && <span className="text-gray-600">{event.skip_title} benzer</span>}
        <span className="text-gray-700">/ {event.total ?? 0} toplam</span>
      </div>
    )
  }

  if (event.kind === 'ai_batch_start') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-gray-800" />
        <span className="rounded-full border border-blue-700/40 bg-blue-950/30 px-3 py-0.5 text-[10px] font-bold tracking-widest text-blue-400 uppercase">
          AI Analizi — {event.total} makale
        </span>
        <div className="h-px flex-1 bg-gray-800" />
      </div>
    )
  }

  if (event.kind === 'ai_queue') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Timestamp ts={event.ts} />
        <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[9px] text-gray-500">
          {event.current}/{event.total}
        </span>
        <p className="flex-1 truncate text-[10px] text-gray-500">{event.message}</p>
        {event.source && <span className="shrink-0 text-[9px] text-gray-700">{event.source}</span>}
      </div>
    )
  }

  if (event.kind === 'call_a_start') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Timestamp ts={event.ts} />
        <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-blue-600 border-t-blue-200" />
        <p className="text-[10px] text-blue-500">Call A — kalite değerlendirmesi…</p>
      </div>
    )
  }

  if (event.kind === 'found') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <Timestamp ts={event.ts} />
        <span className="text-emerald-700 text-xs">+</span>
        <a href={event.url} target="_blank" rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-[11px] text-gray-400 hover:text-gray-200 transition">
          {event.message}
        </a>
        {event.source && <span className="shrink-0 text-[9px] text-gray-700">{event.source}</span>}
      </div>
    )
  }

  if (event.kind === 'analyzing') {
    return (
      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <Timestamp ts={event.ts} />
        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-blue-500 border-t-transparent" />
        <p className="flex-1 truncate text-[11px] text-blue-300">{event.message}</p>
        {event.source && <span className="shrink-0 text-[9px] text-gray-600">{event.source}</span>}
      </div>
    )
  }

  if (event.kind === 'rewriting') {
    return (
      <div className="flex items-center gap-2.5 px-1 py-1">
        <Timestamp ts={event.ts} />
        <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-violet-600 border-t-violet-200" />
        <p className="flex-1 truncate text-[11px] text-violet-300">Call B — makale yeniden yazılıyor…</p>
      </div>
    )
  }

  if (event.kind === 'clustered') {
    return (
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2">
        <div className="mb-1 flex items-center gap-2">
          <Timestamp ts={event.ts} />
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wide">
            🔗 Cluster — {event.cluster_size} kaynak
          </span>
          {event.primary_source && (
            <span className="text-[9px] text-amber-600">→ {event.primary_source}</span>
          )}
        </div>
        <p className="mb-1 text-[10px] text-amber-200/70 line-clamp-1">{event.message}</p>
        {event.sources && event.sources.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.sources.map((s, i) => (
              <span key={i} className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[9px] text-amber-500">{s}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (event.kind === 'scored') {
    const isPublish = event.decision === 'publish'
    const q  = event.quality    ?? 0
    const r  = event.relevance  ?? 0
    const c  = event.confidence ?? 0
    const cu = event.curiosity  ?? 0
    return (
      <div className={`rounded-lg border px-3 py-2.5 ${isPublish ? 'border-gray-700 bg-gray-900/80' : 'border-gray-800/60 bg-gray-900/40'}`}>
        {/* Header row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Timestamp ts={event.ts} />
          {event.topic && <TopicPill topic={event.topic} />}
          <span className={`text-[9px] font-bold uppercase tracking-wide ${isPublish ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPublish ? '✓ geçti' : '✗ atlandı'}
          </span>
        </div>
        {/* Title */}
        <p className="mb-2 text-[11px] font-medium text-gray-200 leading-snug line-clamp-2">{event.message}</p>
        {/* Core claim */}
        {event.core_claim && (
          <div className="mb-1.5 rounded bg-gray-800/60 px-2 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">Core Claim</p>
            <p className="text-[10px] italic text-gray-400 line-clamp-2">{event.core_claim}</p>
          </div>
        )}
        {event.why_it_matters && (
          <div className="mb-2 rounded bg-gray-800/40 px-2 py-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-600 mb-0.5">Neden Önemli</p>
            <p className="text-[10px] text-gray-500 line-clamp-2">{event.why_it_matters}</p>
          </div>
        )}
        {/* Score bars */}
        <div className="grid grid-cols-4 gap-2">
          <ScoreBar label="Kaynak" value={q}  color="text-blue-400" />
          <ScoreBar label="İlgili" value={r}  color="text-violet-400" />
          <ScoreBar label="Güven"  value={c}  color="text-green-400" />
          <ScoreBar label="Merak"  value={cu} color="text-amber-400" />
        </div>
        {event.elapsed !== undefined && (
          <p className="mt-1.5 text-right text-[9px] text-gray-700">{event.elapsed}s</p>
        )}
      </div>
    )
  }

  if (event.kind === 'skipped') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-900/20 bg-red-950/10 px-3 py-2">
        <Timestamp ts={event.ts} />
        <span className="mt-0.5 shrink-0 text-xs text-red-700">✗</span>
        <div className="min-w-0">
          <p className="text-[10px] text-red-500 line-clamp-1">{event.message}</p>
          {event.reason && <p className="mt-0.5 text-[9px] text-gray-600">{event.reason}</p>}
        </div>
      </div>
    )
  }

  if (event.kind === 'publish') {
    const topicCls = event.topic ? (TOPIC_COLORS[event.topic] ?? 'bg-gray-800/50 text-gray-400 border-gray-700/40') : ''
    return (
      <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3">
        <div className="flex items-start gap-3">
          {event.image_url ? (
            <img src={event.image_url} alt=""
              className="h-16 w-24 shrink-0 rounded object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-gray-800 text-xl opacity-20">🐦</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Timestamp ts={event.ts} />
              <span className="text-[9px] font-bold text-emerald-400">✓ KUYRUĞA EKLENDİ</span>
              {event.topic && <TopicPill topic={event.topic} />}
              {event.confidence !== undefined && (
                <span className="ml-auto text-[9px] text-gray-600">güven {event.confidence}/5</span>
              )}
            </div>
            <a href={event.url} target="_blank" rel="noopener noreferrer"
              className="block text-[11px] font-semibold leading-snug text-gray-100 line-clamp-2 hover:text-emerald-300 transition">
              {event.message}
            </a>
            {event.preview && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500 line-clamp-3">{event.preview}</p>
            )}
            {event.elapsed_total !== undefined && (
              <div className="mt-1.5 flex gap-2 text-[9px] text-gray-700">
                <span>A: {event.elapsed_a}s</span>
                <span>B: {event.elapsed_b}s</span>
                <span>toplam: {event.elapsed_total}s</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (event.kind === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2">
        <Timestamp ts={event.ts} />
        <span className="mt-0.5 shrink-0 text-xs text-red-500">⚠</span>
        <div className="min-w-0">
          <p className="text-[10px] text-red-400 line-clamp-1">{event.message}</p>
          {event.detail && <p className="mt-0.5 text-[9px] text-gray-600 line-clamp-2">{event.detail}</p>}
        </div>
      </div>
    )
  }

  return null
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-bold tabular-nums ${value > 0 ? color : 'text-gray-700'}`}>{value}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}

export default function AdminMonitor() {
  const [events, setEvents]           = useState<PipelineEvent[]>([])
  const [connected, setConnected]     = useState(false)
  const [done, setDone]               = useState(false)
  const [running, setRunning]         = useState(false)
  const [selectedSource, setSelectedSource] = useState('all')
  const [error, setError]             = useState<string | null>(null)
  const [autoScroll, setAutoScroll]   = useState(true)
  const [recentRuns, setRecentRuns]   = useState<PipelineRunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<PipelineRunSummary | null>(null)
  const [historyEvents, setHistoryEvents] = useState<PipelineEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Track received event count for tab-reconnect (so we don't re-fetch already-seen events)
  const eventIndexRef = useRef(0)
  const runningRef    = useRef(false)
  const doneRef       = useRef(false)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const logRef        = useRef<HTMLDivElement>(null)
  const abortRef      = useRef<AbortController | null>(null)

  const { data: sources = [] } = useQuery<AdminSource[]>({
    queryKey: ['admin-sources-monitor'],
    queryFn: async () => {
      const { data } = await adminApi.get('/admin/sources')
      return data
    },
  })

  // On mount: check if a pipeline run is already active; if not, load recent runs
  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await adminApi.get('/admin/pipeline-runs/active')
        if (data.active) {
          // A run is in progress — reconnect SSE from the beginning
          setRunning(true)
          runningRef.current = true
          setTimeout(() => connect(0), 200)
        } else {
          const { data: runs } = await adminApi.get('/admin/pipeline-runs?per_page=10')
          setRecentRuns(runs)
        }
      } catch { /* ignore — backend may not have the table yet */ }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadRunHistory(run: PipelineRunSummary) {
    setSelectedRun(run)
    setHistoryLoading(true)
    try {
      const { data } = await adminApi.get(`/admin/pipeline-runs/${run.id}`)
      setHistoryEvents(data.events ?? [])
    } catch {
      setHistoryEvents([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const connect = useCallback((since: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const BASE_URL = (import.meta.env.VITE_API_URL as string) || ''

    ;(async () => {
      try {
        const token = getAdminToken()
        const resp = await fetch(
          `${BASE_URL}/api/v1/admin/scrape-events?since=${since}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        )
        if (!resp.ok || !resp.body) { setConnected(false); return }

        setConnected(true)
        const reader  = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''
          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              const event: PipelineEvent = JSON.parse(dataLine.slice(6))
              setEvents((prev) => [...prev, event])
              eventIndexRef.current += 1
              if (event.kind === 'done') {
                setDone(true)
                doneRef.current = true
                setConnected(false)
                setRunning(false)
                runningRef.current = false
                return
              }
            } catch { /* ignore malformed chunks */ }
          }
        }
        setConnected(false)
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') setConnected(false)
      }
    })()
  }, [])

  // Reconnect on tab visibility change
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) return
      if (!runningRef.current || doneRef.current) return
      // Tab became visible again — reconnect from last known event index
      connect(eventIndexRef.current)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [connect])

  async function handleRun() {
    setError(null)
    setSelectedRun(null)
    setHistoryEvents([])
    try {
      await adminApi.post(`/admin/trigger-scrape?source_slug=${selectedSource}`)
      setEvents([])
      eventIndexRef.current = 0
      setDone(false)
      doneRef.current = false
      setRunning(true)
      runningRef.current = true
      setAutoScroll(true)
      setTimeout(() => connect(0), 400)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Pipeline başlatılamadı')
    }
  }

  // After a run finishes, refresh recent runs list
  useEffect(() => {
    if (!done) return
    ;(async () => {
      try {
        const { data } = await adminApi.get('/admin/pipeline-runs?per_page=10')
        setRecentRuns(data)
      } catch { /* ignore */ }
    })()
  }, [done])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events, autoScroll])

  function handleLogScroll() {
    const el = logRef.current
    if (!el) return
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  const foundCount     = events.filter((e) => e.kind === 'found').length
  const analyzedCount  = events.filter((e) => e.kind === 'scored').length
  const publishedCount = events.filter((e) => e.kind === 'publish').length
  const skippedCount   = events.filter((e) => e.kind === 'skipped').length
  const clusteredCount = events.filter((e) => e.kind === 'clustered')
    .reduce((s, e) => s + ((e.cluster_size ?? 1) - 1), 0)
  const errorCount     = events.filter((e) => e.kind === 'error').length
  const passRate       = analyzedCount > 0 ? Math.round((publishedCount / analyzedCount) * 100) : null

  const activeSources = sources.filter((s) => s.is_active)

  return (
    <div className="flex h-full flex-col -m-8">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-800 bg-gray-950 px-6 py-4">
        <div>
          <h1 className="text-base font-bold text-white">Pipeline Monitor</h1>
          <p className="text-xs text-gray-500">Canlı AI değerlendirme akışı</p>
        </div>

        <div className="flex items-center gap-3">
          {connected && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-400">LIVE</span>
            </div>
          )}
          {!connected && running && !done && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-amber-400">Yeniden bağlanıyor…</span>
            </div>
          )}
          {done && (
            <span className="rounded-full border border-emerald-800/50 bg-emerald-950/50 px-2 py-0.5 text-xs font-bold text-emerald-400">
              Tamamlandı
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            disabled={running && !done}
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 focus:border-brand-500 focus:outline-none disabled:opacity-50"
          >
            <option value="all">Tüm kaynaklar</option>
            {activeSources.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={handleRun}
            disabled={running && !done}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running && !done ? 'Çalışıyor…' : '▶ Başlat'}
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-red-900/40 bg-red-950/20 px-6 py-2 text-xs text-red-400">
          ⚠ {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-5 border-b border-gray-800/60 bg-gray-950/80 px-6 py-2.5">
        <StatBadge label="bulunan"   value={foundCount}     color="text-gray-300" />
        <StatBadge label="analiz"    value={analyzedCount}  color="text-blue-400" />
        <StatBadge label="cluster"   value={clusteredCount} color="text-amber-400" />
        <StatBadge label="kuyruğa"   value={publishedCount} color="text-emerald-400" />
        <StatBadge label="atlandı"   value={skippedCount}   color="text-red-400" />
        <StatBadge label="hata"      value={errorCount}     color="text-red-500" />
        {passRate !== null && (
          <span className="text-xs text-gray-600">
            geçiş oranı <span className="font-bold text-gray-400">{passRate}%</span>
          </span>
        )}
        {!autoScroll && (
          <button
            onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }}
            className="ml-auto text-[10px] text-brand-400 hover:text-brand-300 transition"
          >
            ↓ En alta git
          </button>
        )}
      </div>

      {/* Event log — live run or history viewer */}
      <div ref={logRef} onScroll={handleLogScroll} className="flex-1 overflow-y-auto bg-gray-950 px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-1.5">

          {/* History view */}
          {selectedRun && !running && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={() => { setSelectedRun(null); setHistoryEvents([]) }}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1 text-xs text-gray-400 hover:text-white transition"
                >
                  ← Geri
                </button>
                <div>
                  <p className="text-xs font-semibold text-gray-200">
                    Run #{selectedRun.id} — {new Date(selectedRun.started_at).toLocaleString('tr-TR')}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {selectedRun.total_new} yeni · {selectedRun.total_found} bulunan · {selectedRun.total_ai_processed} AI işlendi
                  </p>
                </div>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  selectedRun.status === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' :
                  selectedRun.status === 'failed'  ? 'bg-red-950 text-red-400 border border-red-800/40' :
                  'bg-amber-950 text-amber-400 border border-amber-800/40'
                }`}>
                  {selectedRun.status === 'success' ? '✓ Tamamlandı' : selectedRun.status === 'failed' ? '✗ Hata' : '⟳ Çalışıyor'}
                </span>
              </div>
              {historyLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  Log yükleniyor…
                </div>
              ) : historyEvents.length === 0 ? (
                <div className="py-12 text-center text-gray-700 text-xs">Bu run için kayıtlı log yok.</div>
              ) : (
                historyEvents.map((event, i) => <EventCard key={i} event={event} />)
              )}
            </>
          )}

          {/* Live run view */}
          {(!selectedRun || running) && (
            <>
              {events.length === 0 && !running && (
                <div className="py-16 text-center text-gray-700">
                  <p className="text-4xl mb-3 opacity-20">🐦</p>
                  <p className="text-sm">Pipeline başlatmak için ▶ Başlat'a bas.</p>
                  <p className="mt-1 text-xs">AI değerlendirmeleri burada canlı görünecek.</p>
                </div>
              )}
              {events.length === 0 && running && (
                <div className="flex items-center gap-2 py-8 text-sm text-gray-600">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  Pipeline başlatılıyor…
                </div>
              )}
              {events.map((event, i) => (
                <EventCard key={i} event={event} />
              ))}

              {/* Recent Runs list — shown below live log when no run is active */}
              {!running && recentRuns.length > 0 && (
                <div className="mt-8 border-t border-gray-800 pt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-600">Geçmiş Çalışmalar</p>
                  <div className="space-y-2">
                    {recentRuns.map((run) => {
                      const start = new Date(run.started_at)
                      const end = run.completed_at ? new Date(run.completed_at) : null
                      const durationMs = end ? end.getTime() - start.getTime() : null
                      const durationStr = durationMs !== null
                        ? durationMs >= 60000
                          ? `${Math.floor(durationMs / 60000)}dk ${Math.floor((durationMs % 60000) / 1000)}s`
                          : `${Math.floor(durationMs / 1000)}s`
                        : null
                      return (
                        <button
                          key={run.id}
                          onClick={() => loadRunHistory(run)}
                          className="w-full rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-2.5 text-left transition hover:border-gray-700 hover:bg-gray-900"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${
                              run.status === 'success' ? 'bg-emerald-500' :
                              run.status === 'failed'  ? 'bg-red-500' : 'bg-amber-400'
                            }`} />
                            <span className="flex-1 text-[11px] font-medium text-gray-300">
                              {start.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {run.source_slug !== 'all' && (
                                <span className="ml-1.5 text-gray-600">({run.source_slug})</span>
                              )}
                            </span>
                            <span className="text-[10px] text-emerald-500">+{run.total_new}</span>
                            <span className="text-[10px] text-gray-600">/ {run.total_found}</span>
                            {durationStr && <span className="text-[10px] text-gray-700">{durationStr}</span>}
                          </div>
                          {run.error_message && (
                            <p className="mt-1 truncate text-[9px] text-red-500">{run.error_message}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
