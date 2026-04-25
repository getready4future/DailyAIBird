import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../api/client'
import Spinner from '../components/ui/Spinner'

interface SeoConfig {
  site_name: string
  site_url: string
  site_title: string
  site_description: string
  default_og_image: string
  twitter_handle: string
  publisher_name: string
  language: string
  robots_extra: string
  // Content Signals (draft-romm-aipref-contentsignals)
  cs_search: 'yes' | 'no'
  cs_ai_train: 'yes' | 'no'
  cs_ai_input: 'yes' | 'no'
}

const fetchSeo = async (): Promise<SeoConfig> => {
  const { data } = await adminApi.get('/admin/seo')
  return data
}

const updateSeo = async (cfg: Partial<SeoConfig>): Promise<SeoConfig> => {
  const { data } = await adminApi.patch('/admin/seo', cfg)
  return data
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold tracking-widest text-gray-500 uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-gray-600">{hint}</p>}
    </div>
  )
}

const inputCls = "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"

function SignalToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: 'yes' | 'no'
  onChange: (v: 'yes' | 'no') => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-700 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-200">{label}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">{description}</p>
      </div>
      <div className="flex shrink-0 gap-1 rounded-lg border border-gray-600 bg-gray-950 p-0.5">
        {(['yes', 'no'] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`rounded-md px-3 py-1 text-xs font-bold transition ${
              value === v
                ? v === 'yes'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-rose-700 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AdminSeo() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-seo'], queryFn: fetchSeo })
  const [form, setForm] = useState<SeoConfig | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const saveMut = useMutation({
    mutationFn: (cfg: Partial<SeoConfig>) => updateSeo(cfg),
    onSuccess: (data) => {
      qc.setQueryData(['admin-seo'], data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading || !form) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  function update<K extends keyof SeoConfig>(key: K, value: SeoConfig[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f)
  }

  const contentSignalPreview = `Content-Signal: search=${form.cs_search ?? 'yes'}, ai-train=${form.cs_ai_train ?? 'no'}, ai-input=${form.cs_ai_input ?? 'no'}`

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
        <p className="mb-1 text-[10px] font-bold tracking-widest text-gray-500 uppercase">SEO</p>
        <h1 className="text-xl font-bold text-white">Site SEO Ayarları</h1>
        <p className="mt-1 text-xs text-gray-500">
          Bu ayarlar arama motorlarına ve sosyal medya botlarına gönderilen meta tag'leri belirler.
          Değişiklikler anında geçerli olur (cache 1 saat).
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        {/* Identity */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Kimlik</p>
          <Field label="Site Adı" hint="og:site_name içinde kullanılır">
            <input className={inputCls} value={form.site_name}
              onChange={(e) => update('site_name', e.target.value)} />
          </Field>
          <Field label="Site URL" hint="https:// ile, sonunda / olmadan. Sitemap ve canonical bunu kullanır.">
            <input className={inputCls} value={form.site_url}
              onChange={(e) => update('site_url', e.target.value)} placeholder="https://dailyaibird.com" />
          </Field>
          <Field label="Yayıncı (Publisher)" hint="Schema.org Article JSON-LD'de yayıncı kuruluş adı">
            <input className={inputCls} value={form.publisher_name}
              onChange={(e) => update('publisher_name', e.target.value)} />
          </Field>
          <Field label="Dil" hint="ISO kodu, örn: en, tr">
            <input className={inputCls} value={form.language}
              onChange={(e) => update('language', e.target.value)} maxLength={5} />
          </Field>
        </div>

        {/* Defaults */}
        <div className="space-y-4 border-t border-gray-800 pt-6">
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Varsayılan Meta'lar</p>
          <Field label="Ana Sayfa Başlığı" hint="Article olmayan sayfalarda kullanılır (Home, Topics, Sources)">
            <input className={inputCls} value={form.site_title}
              onChange={(e) => update('site_title', e.target.value)} />
          </Field>
          <Field label="Site Açıklaması" hint="Meta description fallback (150-160 karakter ideal)">
            <textarea className={inputCls + ' resize-none'} rows={3} maxLength={300}
              value={form.site_description}
              onChange={(e) => update('site_description', e.target.value)} />
            <p className="mt-1 text-[10px] text-gray-700">{form.site_description.length}/300</p>
          </Field>
          <Field label="Varsayılan og:image" hint="Article image yoksa veya statik sayfada kullanılır. /path veya tam URL.">
            <input className={inputCls} value={form.default_og_image}
              onChange={(e) => update('default_og_image', e.target.value)} placeholder="/bird-og.png" />
          </Field>
          <Field label="Twitter Handle" hint="@dailyaibird gibi. twitter:site meta'sında kullanılır.">
            <input className={inputCls} value={form.twitter_handle}
              onChange={(e) => update('twitter_handle', e.target.value)} placeholder="@dailyaibird" />
          </Field>
        </div>

        {/* Content Signals */}
        <div className="space-y-4 border-t border-gray-800 pt-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Content Signals</p>
            <p className="mt-1 text-[11px] text-gray-600">
              Declare AI and search usage preferences in robots.txt.{' '}
              <a href="https://contentsignals.org/" target="_blank" rel="noopener noreferrer"
                className="text-brand-500 hover:underline">contentsignals.org ↗</a>
            </p>
          </div>

          <SignalToggle
            label="search"
            description="Allow search engines to index and display your content in search results."
            value={form.cs_search ?? 'yes'}
            onChange={(v) => update('cs_search', v)}
          />
          <SignalToggle
            label="ai-train"
            description="Allow AI systems to use your content as training data for model development."
            value={form.cs_ai_train ?? 'no'}
            onChange={(v) => update('cs_ai_train', v)}
          />
          <SignalToggle
            label="ai-input"
            description="Allow AI systems to use your content as runtime context (RAG, grounding, summarisation)."
            value={form.cs_ai_input ?? 'no'}
            onChange={(v) => update('cs_ai_input', v)}
          />

          {/* robots.txt preview */}
          <div className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 font-mono text-[11px] text-gray-400">
            <span className="text-gray-600"># robots.txt will include:</span>
            <br />
            <span className="text-emerald-400">{contentSignalPreview}</span>
          </div>
        </div>

        {/* robots.txt extra */}
        <div className="space-y-4 border-t border-gray-800 pt-6">
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">robots.txt Ek Kurallar</p>
          <Field label="Ek Direktifler" hint="Standart kurallara (Allow: /, Disallow: /admin) ek olarak eklenecek satırlar">
            <textarea className={inputCls + ' resize-none font-mono text-xs'} rows={5}
              value={form.robots_extra}
              onChange={(e) => update('robots_extra', e.target.value)}
              placeholder="User-agent: GPTBot&#10;Disallow: /" />
          </Field>
        </div>

        {/* Preview */}
        <div className="space-y-3 border-t border-gray-800 pt-6">
          <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Önizleme</p>
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-4 font-mono text-[11px] text-gray-400 leading-relaxed">
            <div className="text-gray-500">&lt;title&gt;</div>
            <div className="pl-2 text-gray-200">{form.site_title}</div>
            <div className="text-gray-500">&lt;meta description&gt;</div>
            <div className="pl-2 text-gray-300">{form.site_description}</div>
            <div className="text-gray-500">&lt;link canonical&gt;</div>
            <div className="pl-2 text-blue-400">{form.site_url}/</div>
            <div className="text-gray-500">og:image</div>
            <div className="pl-2 text-amber-400">
              {form.default_og_image.startsWith('http') ? form.default_og_image : `${form.site_url}${form.default_og_image}`}
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <a href={`${form.site_url}/sitemap.xml`} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-400 hover:border-brand-500 hover:text-brand-400 transition">
              📄 sitemap.xml
            </a>
            <a href={`${form.site_url}/robots.txt`} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-400 hover:border-brand-500 hover:text-brand-400 transition">
              🤖 robots.txt
            </a>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-between border-t border-gray-800 pt-6">
          {saved && <span className="text-xs text-emerald-400">✓ Kaydedildi</span>}
          <button
            onClick={() => saveMut.mutate(form)}
            disabled={saveMut.isPending}
            className="ml-auto rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
