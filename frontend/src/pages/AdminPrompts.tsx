import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/client'

interface PromptVersion {
  id: number
  key: string
  label: string
  is_active: boolean
  is_experiment: boolean
  notes: string | null
  created_at: string
  use_count: number
  pass_count: number
  banned_word_retry_count: number
  json_retry_count: number
  total_input_tokens: number
  total_output_tokens: number
  pass_rate: number | null
}

interface PromptVersionDetail extends PromptVersion {
  text: string
}

const KEYS = [
  { key: 'quality_check', label: 'Quality Check (Call A)', desc: 'Yayın gate kararı' },
  { key: 'rewrite',       label: 'Rewrite (Call B1)',       desc: 'Sadakatli yeniden yazım' },
  { key: 'polish',        label: 'Polish (Call B2)',        desc: 'Ses ve erişilebilirlik' },
]

export default function AdminPrompts() {
  const qc = useQueryClient()
  const [selectedKey, setSelectedKey] = useState('quality_check')
  const [editing, setEditing] = useState<PromptVersionDetail | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: versions = [], isLoading } = useQuery<PromptVersion[]>({
    queryKey: ['admin-prompt-versions', selectedKey],
    queryFn: async () => {
      const { data } = await adminApi.get(`/admin/pipeline/prompt-versions?key=${selectedKey}`)
      return data
    },
  })

  const activate = useMutation({
    mutationFn: async (id: number) => { await adminApi.post(`/admin/pipeline/prompt-versions/${id}/activate`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-prompt-versions', selectedKey] }),
  })

  const startExperiment = useMutation({
    mutationFn: async (id: number) => { await adminApi.post(`/admin/pipeline/prompt-versions/${id}/experiment`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-prompt-versions', selectedKey] }),
  })

  const stopExperiment = useMutation({
    mutationFn: async (id: number) => { await adminApi.post(`/admin/pipeline/prompt-versions/${id}/stop-experiment`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-prompt-versions', selectedKey] }),
  })

  const deleteVersion = useMutation({
    mutationFn: async (id: number) => { await adminApi.delete(`/admin/pipeline/prompt-versions/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-prompt-versions', selectedKey] }),
  })

  const create = useMutation({
    mutationFn: async (body: { key: string; label: string; text: string; notes?: string }) => {
      await adminApi.post('/admin/pipeline/prompt-versions', body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-prompt-versions', selectedKey] })
      setCreating(false)
    },
  })

  async function loadDetail(id: number) {
    const { data } = await adminApi.get<PromptVersionDetail>(`/admin/pipeline/prompt-versions/${id}`)
    setEditing(data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">A/B Prompt Versiyonları</h1>
          <p className="text-xs text-gray-500">
            Aktif sürüm her makale için kullanılır. Deney (experiment) sürümü tanımlandıysa, makale ID parity'sine göre 50/50 paylaşılır.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500 transition"
        >
          + Yeni Versiyon
        </button>
      </div>

      {/* Key tabs */}
      <div className="flex gap-2 border-b border-gray-800">
        {KEYS.map((k) => (
          <button
            key={k.key}
            onClick={() => setSelectedKey(k.key)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
              selectedKey === k.key
                ? 'border-brand-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 -mt-3">
        {KEYS.find((k) => k.key === selectedKey)?.desc}
      </p>

      {/* Versions list */}
      {isLoading ? (
        <div className="text-sm text-gray-500">Yükleniyor…</div>
      ) : versions.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-8 text-center">
          <p className="text-sm text-gray-400">Bu prompt için kayıtlı versiyon yok.</p>
          <p className="text-[11px] text-gray-600 mt-1">
            Versiyon eklenene kadar pipeline kod-içi default'u kullanır.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`rounded-lg border p-4 ${
                v.is_active ? 'border-emerald-800/40 bg-emerald-950/20' :
                v.is_experiment ? 'border-amber-800/40 bg-amber-950/20' :
                'border-gray-800 bg-gray-900/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white truncate">{v.label}</p>
                    {v.is_active && (
                      <span className="rounded-full border border-emerald-700/40 bg-emerald-900/40 px-2 py-0.5 text-[9px] font-bold text-emerald-300">AKTİF</span>
                    )}
                    {v.is_experiment && (
                      <span className="rounded-full border border-amber-700/40 bg-amber-900/40 px-2 py-0.5 text-[9px] font-bold text-amber-300">DENEY</span>
                    )}
                  </div>
                  {v.notes && <p className="mt-1 text-[11px] text-gray-500">{v.notes}</p>}
                  <p className="mt-1 text-[10px] text-gray-700">
                    Oluşturuldu: {new Date(v.created_at).toLocaleString('tr-TR')}
                  </p>

                  {/* Telemetry */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[10px]">
                    <div>
                      <p className="text-gray-600 uppercase tracking-wider">Kullanım</p>
                      <p className="font-bold text-gray-200 tabular-nums">{v.use_count}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 uppercase tracking-wider">Pass-rate</p>
                      <p className={`font-bold tabular-nums ${
                        v.pass_rate === null ? 'text-gray-700' :
                        v.pass_rate >= 60 ? 'text-emerald-400' :
                        v.pass_rate >= 30 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {v.pass_rate === null ? '—' : `${v.pass_rate}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 uppercase tracking-wider">JSON retry</p>
                      <p className={`font-bold tabular-nums ${v.json_retry_count > 0 ? 'text-amber-400' : 'text-gray-700'}`}>
                        {v.json_retry_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 uppercase tracking-wider">Banned retry</p>
                      <p className={`font-bold tabular-nums ${v.banned_word_retry_count > 0 ? 'text-amber-400' : 'text-gray-700'}`}>
                        {v.banned_word_retry_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 uppercase tracking-wider">Token</p>
                      <p className="font-bold text-gray-200 tabular-nums">
                        {(v.total_input_tokens + v.total_output_tokens).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => loadDetail(v.id)}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1 text-[10px] font-medium text-gray-300 hover:text-white transition"
                  >
                    Görüntüle
                  </button>
                  {!v.is_active && (
                    <button
                      onClick={() => activate.mutate(v.id)}
                      disabled={activate.isPending}
                      className="rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-3 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-900/40 transition disabled:opacity-40"
                    >
                      ✓ Aktif yap
                    </button>
                  )}
                  {!v.is_active && !v.is_experiment && (
                    <button
                      onClick={() => startExperiment.mutate(v.id)}
                      disabled={startExperiment.isPending}
                      className="rounded-lg border border-amber-700/40 bg-amber-950/40 px-3 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-900/40 transition disabled:opacity-40"
                    >
                      ⇄ Deneye al
                    </button>
                  )}
                  {v.is_experiment && (
                    <button
                      onClick={() => stopExperiment.mutate(v.id)}
                      disabled={stopExperiment.isPending}
                      className="rounded-lg border border-gray-700 px-3 py-1 text-[10px] font-medium text-gray-400 hover:text-white transition disabled:opacity-40"
                    >
                      ⏸ Deneyi durdur
                    </button>
                  )}
                  {!v.is_active && (
                    <button
                      onClick={() => {
                        if (confirm(`"${v.label}" sil?`)) deleteVersion.mutate(v.id)
                      }}
                      disabled={deleteVersion.isPending}
                      className="rounded-lg border border-red-900/30 px-3 py-1 text-[10px] text-red-500 hover:text-red-300 transition disabled:opacity-40"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View modal */}
      {editing && (
        <PromptViewModal version={editing} onClose={() => setEditing(null)} />
      )}

      {/* Create modal */}
      {creating && (
        <PromptCreateModal
          defaultKey={selectedKey}
          onSubmit={(body) => create.mutate(body)}
          onClose={() => setCreating(false)}
          submitting={create.isPending}
        />
      )}
    </div>
  )
}

function PromptViewModal({ version, onClose }: { version: PromptVersionDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl border border-gray-800 bg-gray-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <p className="text-sm font-bold text-white">{version.label}</p>
            <p className="text-[10px] text-gray-600">{version.key} · v{version.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <pre className="flex-1 overflow-auto rounded-lg border border-gray-800 bg-gray-900 p-4 text-[11px] text-gray-300 whitespace-pre-wrap">
{version.text}
        </pre>
      </div>
    </div>
  )
}

function PromptCreateModal({
  defaultKey, onSubmit, onClose, submitting,
}: {
  defaultKey: string
  onSubmit: (body: { key: string; label: string; text: string; notes?: string }) => void
  onClose: () => void
  submitting: boolean
}) {
  const [key, setKey] = useState(defaultKey)
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit() {
    if (!label.trim() || !text.trim()) return
    onSubmit({ key, label: label.trim(), text, notes: notes.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-gray-800 bg-gray-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <p className="text-sm font-bold text-white">Yeni Prompt Versiyonu</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="space-y-3 flex-1 overflow-auto pr-1">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500">Prompt türü</label>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200"
            >
              {KEYS.map((k) => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500">Etiket</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="örn. v3-shorter-headlines"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500">Notlar (opsiyonel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bu sürümü neden test ediyoruz?"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-200"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500">Prompt metni</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={20}
              placeholder="Tam prompt metni — {title}, {source_name}, {content} placeholder'larını koru…"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-[11px] font-mono text-gray-200"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !label.trim() || !text.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-500 transition disabled:opacity-40"
          >
            {submitting ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
