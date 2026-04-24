import { useEffect, useRef, useState } from 'react'
import { getScrapeEventsUrl } from '../../api/admin'

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
  core_claim?: string
  reason?: string
  preview?: string
  detail?: string
}

const TOPIC_COLORS: Record<string, string> = {
  research: 'bg-violet-900/50 text-violet-300',
  products: 'bg-blue-900/50 text-blue-300',
  agents:   'bg-purple-900/50 text-purple-300',
  business: 'bg-emerald-900/50 text-emerald-300',
  safety:   'bg-amber-900/50 text-amber-300',
}

function EventRow({ event }: { event: PipelineEvent }) {
  if (event.kind === 'done') {
    return (
      <div className="my-3 rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-center">
        <p className="text-sm font-bold text-emerald-400">✓ Pipeline tamamlandı!</p>
      </div>
    )
  }

  if (event.kind === 'source_start') {
    return (
      <div className="mt-5 mb-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-800" />
        <span className="rounded-full border border-brand-700/40 bg-brand-950/30 px-3 py-0.5 text-[10px] font-bold tracking-widest text-brand-400 uppercase">
          {event.source ?? event.message}
        </span>
        <div className="h-px flex-1 bg-gray-800" />
      </div>
    )
  }

  if (event.kind === 'info') {
    return (
      <p className="px-1 py-0.5 text-[10px] text-gray-600">{event.message}</p>
    )
  }

  if (event.kind === 'scrape') {
    return (
      <p className="px-1 py-1 text-[10px] font-semibold text-emerald-600">{event.message}</p>
    )
  }

  if (event.kind === 'found') {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <span className="text-gray-700 text-xs">◦</span>
        <a href={event.url} target="_blank" rel="noopener noreferrer"
          className="truncate text-[11px] text-gray-600 hover:text-gray-300 transition">
          {event.message}
        </a>
      </div>
    )
  }

  if (event.kind === 'analyzing') {
    return (
      <div className="flex items-center gap-2.5 px-1 py-1">
        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-blue-500 border-t-transparent" />
        <p className="truncate text-[11px] text-blue-300">{event.message}</p>
      </div>
    )
  }

  if (event.kind === 'rewriting') {
    return (
      <div className="flex items-center gap-2.5 px-1 py-0.5">
        <span className="text-violet-500 text-xs">✍</span>
        <p className="truncate text-[11px] text-violet-300">{event.message}</p>
      </div>
    )
  }

  if (event.kind === 'scored') {
    const topicCls = event.topic ? (TOPIC_COLORS[event.topic] ?? 'bg-gray-800 text-gray-400') : ''
    const isPublish = event.decision === 'publish'
    return (
      <div className="mx-1 mb-0.5 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {event.topic && (
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${topicCls}`}>{event.topic}</span>
          )}
          <span className={`text-[9px] font-bold uppercase ${isPublish ? 'text-emerald-400' : 'text-red-400'}`}>
            → {event.decision}
          </span>
          <span className="ml-auto font-mono text-[9px] text-gray-600">
            Q:{event.quality} R:{event.relevance} C:{event.confidence}
          </span>
        </div>
        <p className="truncate text-[10px] text-gray-400 leading-snug">{event.message}</p>
        {event.core_claim && (
          <p className="mt-0.5 line-clamp-1 text-[9px] italic text-gray-600">{event.core_claim}</p>
        )}
      </div>
    )
  }

  if (event.kind === 'skipped') {
    return (
      <div className="flex items-start gap-2 px-1 py-0.5">
        <span className="mt-0.5 shrink-0 text-xs text-red-700">✗</span>
        <div className="min-w-0">
          <p className="truncate text-[10px] text-red-500">{event.message}</p>
          {event.reason && <p className="text-[9px] text-gray-600">{event.reason}</p>}
        </div>
      </div>
    )
  }

  if (event.kind === 'publish') {
    const topicCls = event.topic ? (TOPIC_COLORS[event.topic] ?? 'bg-gray-800 text-gray-400') : ''
    return (
      <div className="mx-1 mb-1 flex items-start gap-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2">
        {event.image_url ? (
          <img src={event.image_url} alt=""
            className="h-12 w-16 shrink-0 rounded object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-gray-800 text-lg opacity-20">🐦</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-bold text-emerald-400">✓ PUBLISHED</span>
            {event.topic && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${topicCls}`}>{event.topic}</span>
            )}
          </div>
          <a href={event.url} target="_blank" rel="noopener noreferrer"
            className="block text-[11px] font-semibold leading-snug text-gray-200 line-clamp-2 hover:text-emerald-300 transition">
            {event.message}
          </a>
          {event.preview && (
            <p className="mt-0.5 line-clamp-1 text-[9px] text-gray-600">{event.preview}</p>
          )}
        </div>
      </div>
    )
  }

  if (event.kind === 'error') {
    return (
      <div className="flex items-start gap-2 px-1 py-0.5">
        <span className="mt-0.5 shrink-0 text-xs text-red-500">⚠</span>
        <div className="min-w-0">
          <p className="truncate text-[10px] text-red-400">{event.message}</p>
          {event.detail && <p className="text-[9px] text-gray-600">{event.detail}</p>}
        </div>
      </div>
    )
  }

  return null
}

interface PipelinePanelProps {
  open: boolean
  sourceLabel: string
  sessionKey: number
  onClose: () => void
}

export default function PipelinePanel({ open, sourceLabel, sessionKey, onClose }: PipelinePanelProps) {
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [done, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    setEvents([])
    setDone(false)
    setConnected(false)

    // Small delay so the backend has time to register the scrape start
    const t = setTimeout(() => {
      const url = getScrapeEventsUrl()
      const es = new EventSource(url)

      es.onopen = () => setConnected(true)

      es.onmessage = (e: MessageEvent) => {
        try {
          const event: PipelineEvent = JSON.parse(e.data)
          setEvents((prev) => [...prev, event])
          if (event.kind === 'done') {
            setDone(true)
            setConnected(false)
            es.close()
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
      }

      return () => es.close()
    }, 300)

    return () => clearTimeout(t)
  }, [open, sessionKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  if (!open) return null

  const foundCount     = events.filter((e) => e.kind === 'found').length
  const publishedCount = events.filter((e) => e.kind === 'publish').length
  const skippedCount   = events.filter((e) => e.kind === 'skipped').length
  const errorCount     = events.filter((e) => e.kind === 'error').length

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-gray-950 shadow-2xl border-l border-gray-800 sm:w-[460px]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Pipeline</p>
            <h2 className="text-sm font-bold text-white">{sourceLabel}</h2>
          </div>
          <div className="flex items-center gap-3">
            {connected && (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
              </div>
            )}
            {!connected && done && (
              <span className="rounded-full border border-emerald-800/50 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                Done
              </span>
            )}
            {!connected && !done && events.length === 0 && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            )}
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-800 hover:text-gray-300">
              ✕
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex shrink-0 gap-4 border-b border-gray-800/60 px-5 py-2">
          <Stat label="found"     value={foundCount}     color="text-gray-400" />
          <Stat label="published" value={publishedCount} color="text-emerald-400" />
          <Stat label="skipped"   value={skippedCount}   color="text-red-400" />
          <Stat label="errors"    value={errorCount}     color="text-red-500" />
        </div>

        {/* Event log */}
        <div className="flex-1 space-y-px overflow-y-auto px-3 py-3">
          {events.length === 0 && (
            <div className="flex items-center gap-2 px-2 py-4 text-xs text-gray-600">
              <span className="h-3 w-3 animate-spin rounded-full border border-brand-500 border-t-transparent" />
              Pipeline başlatılıyor…
            </div>
          )}
          {events.map((event, i) => (
            <EventRow key={i} event={event} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-xs font-bold tabular-nums ${value > 0 ? color : 'text-gray-700'}`}>{value}</span>
      <span className="text-[10px] text-gray-700">{label}</span>
    </div>
  )
}
