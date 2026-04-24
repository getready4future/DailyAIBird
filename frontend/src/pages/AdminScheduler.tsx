import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchScheduler, updateScheduler, fetchAppConfig, updateAppConfig, type SchedulerConfig } from '../api/admin'
import Spinner from '../components/ui/Spinner'

function pad(n: number) { return String(n).padStart(2, '0') }

function nextRunLabel(hour: number, minute: number): string {
  const now = new Date()
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const diff = Math.round((next.getTime() - now.getTime()) / 60000)
  if (diff < 60) return `in ${diff} minutes`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return `in ${h}h ${m}m`
}

export default function AdminScheduler() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-scheduler'],
    queryFn: fetchScheduler,
  })
  const { data: appConfig } = useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchAppConfig,
  })

  const [scrapeHour, setScrapeHour]     = useState(6)
  const [scrapeMinute, setScrapeMinute] = useState(0)
  const [digestHour, setDigestHour]     = useState(7)
  const [digestMinute, setDigestMinute] = useState(15)
  const [enabled, setEnabled]           = useState(true)
  const [saved, setSaved]               = useState(false)

  const [maxArticles, setMaxArticles]   = useState(20)
  const [configSaved, setConfigSaved]   = useState(false)

  useEffect(() => {
    if (config) {
      setScrapeHour(config.scrape_hour)
      setScrapeMinute(config.scrape_minute ?? 0)
      setDigestHour(config.digest_hour)
      setDigestMinute(config.digest_minute ?? 15)
      setEnabled(config.enabled)
    }
  }, [config])

  useEffect(() => {
    if (appConfig) {
      setMaxArticles(appConfig.max_articles_per_source)
    }
  }, [appConfig])

  const saveMut = useMutation({
    mutationFn: () => updateScheduler({
      scrape_hour: scrapeHour,
      scrape_minute: scrapeMinute,
      digest_hour: digestHour,
      digest_minute: digestMinute,
      enabled,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-scheduler'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const configMut = useMutation({
    mutationFn: () => updateAppConfig({ max_articles_per_source: maxArticles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-config'] })
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
    },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div>
      {/* Header */}
      <div className="mb-8 rounded-2xl bg-gray-900 border border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Scheduler</p>
            <h1 className="text-xl font-bold text-white">Automated Jobs</h1>
            <p className="mt-1 text-xs text-gray-500">Configure when Daily AI Bird scrapes and generates content.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 ${
            enabled ? 'border-emerald-800 bg-emerald-950/40' : 'border-gray-700 bg-gray-800'
          }`}>
            <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className={`text-xs font-semibold ${enabled ? 'text-emerald-400' : 'text-gray-500'}`}>
              {enabled ? 'Scheduler Active' : 'Scheduler Paused'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scrape job */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="text-2xl">↓</span>
            <div>
              <h2 className="text-base font-bold text-white">Daily Scrape</h2>
              <p className="text-xs text-gray-500">Fetches new articles from all active sources</p>
            </div>
          </div>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Hour (UTC)</label>
              <select
                value={scrapeHour}
                onChange={(e) => setScrapeHour(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{pad(i)}:00</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Minute</label>
              <select
                value={scrapeMinute}
                onChange={(e) => setScrapeMinute(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>:{pad(m)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-800/50 px-4 py-3 text-xs text-gray-400">
            <span className="text-gray-600">Runs daily at </span>
            <span className="font-mono font-semibold text-white">{pad(scrapeHour)}:{pad(scrapeMinute)} UTC</span>
            <span className="text-gray-600"> · {nextRunLabel(scrapeHour, scrapeMinute)}</span>
          </div>
        </div>

        {/* Digest job */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="text-2xl">📰</span>
            <div>
              <h2 className="text-base font-bold text-white">Daily Digest</h2>
              <p className="text-xs text-gray-500">Generates the curated AI briefing from published articles</p>
            </div>
          </div>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Hour (UTC)</label>
              <select
                value={digestHour}
                onChange={(e) => setDigestHour(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{pad(i)}:00</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">Minute</label>
              <select
                value={digestMinute}
                onChange={(e) => setDigestMinute(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>:{pad(m)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-800/50 px-4 py-3 text-xs text-gray-400">
            <span className="text-gray-600">Runs daily at </span>
            <span className="font-mono font-semibold text-white">{pad(digestHour)}:{pad(digestMinute)} UTC</span>
            <span className="text-gray-600"> · {nextRunLabel(digestHour, digestMinute)}</span>
          </div>
        </div>
      </div>

      {/* Enable/disable + save */}
      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white mb-1">Scheduler State</h3>
          <p className="text-xs text-gray-500">
            Disabling the scheduler stops automatic runs. Manual scraping from Queue still works.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
            enabled
              ? 'border-red-800 text-red-400 hover:bg-red-950/30'
              : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/30'
          }`}
        >
          {enabled ? 'Pause Scheduler' : 'Enable Scheduler'}
        </button>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
        >
          {saveMut.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Info box */}
      <div className="mt-4 rounded-xl border border-gray-800/50 px-5 py-4 text-xs text-gray-600">
        <p>All times are in UTC. Changes take effect immediately via APScheduler without restarting the server.</p>
        <p className="mt-1">Tip: Set scrape 1 hour before digest so articles are ready when the briefing runs.</p>
      </div>

      {/* Global Limits */}
      <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="mb-5">
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Global Limits</p>
          <h2 className="text-base font-bold text-white">Content Limits</h2>
          <p className="mt-1 text-xs text-gray-500">
            Default article cap per source per scrape run. Individual sources can override this in Source Management.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Max Articles per Source
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="200"
                value={maxArticles}
                onChange={(e) => setMaxArticles(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-28 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
              <span className="text-xs text-gray-500">articles/source/run</span>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-600">
              Sources without a per-source override will use this value.
            </p>
          </div>

          <button
            onClick={() => configMut.mutate()}
            disabled={configMut.isPending}
            className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-50 transition"
          >
            {configMut.isPending ? 'Saving…' : configSaved ? '✓ Saved' : 'Save Limits'}
          </button>
        </div>
      </div>
    </div>
  )
}
