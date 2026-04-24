import { adminApi, api } from './client'
import type { ArticleAdmin, DailyDigest } from '../types'

const BASE_URL = import.meta.env.VITE_API_URL || ''

// ── Auth ──────────────────────────────────────────────────────────────────────

export const adminLogin = async (username: string, password: string) => {
  const { data } = await api.post('/admin/login', { username, password })
  return data as { token: string; username: string }
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export const fetchQueue = async (page = 1, status = 'pending_human'): Promise<ArticleAdmin[]> => {
  const { data } = await adminApi.get<ArticleAdmin[]>('/admin/queue', { params: { page, per_page: 20, status } })
  return data
}

export const approveArticle = async (id: number): Promise<void> => {
  await adminApi.post(`/admin/articles/${id}/approve`, { approved_by: 'admin' })
}

export const rejectArticle = async (id: number, reason: string): Promise<void> => {
  await adminApi.post(`/admin/articles/${id}/reject`, { reason, rejected_by: 'admin' })
}

// ── Digests ───────────────────────────────────────────────────────────────────

export const fetchPendingDigests = async (): Promise<DailyDigest[]> => {
  const { data } = await adminApi.get<DailyDigest[]>('/admin/digests/pending')
  return data
}

export const approveDigest = async (id: number): Promise<void> => {
  await adminApi.post(`/admin/digests/${id}/approve`, { approved_by: 'admin' })
}

export const rejectDigest = async (id: number): Promise<void> => {
  await adminApi.post(`/admin/digests/${id}/reject`, { reason: 'rejected by admin' })
}

// ── Scraping ──────────────────────────────────────────────────────────────────

export const triggerScrape = async (sourceSlug = 'all'): Promise<void> => {
  await adminApi.post('/admin/trigger-scrape', null, { params: { source_slug: sourceSlug } })
}

export const triggerDigest = async (): Promise<void> => {
  await adminApi.post('/admin/trigger-digest')
}

export const getScrapeEventsUrl = () => {
  const raw = localStorage.getItem('dailyaibird_admin')
  const session = raw ? JSON.parse(raw) : null
  const token = session?.token || import.meta.env.VITE_ADMIN_TOKEN || ''
  return `${BASE_URL}/api/v1/admin/scrape-events?token=${encodeURIComponent(token)}`
}

// ── Sources ───────────────────────────────────────────────────────────────────

export interface AdminSource {
  id: number
  name: string
  slug: string
  url: string
  category: string
  scraper_type: string
  is_active: boolean
  last_scraped_at: string | null
  max_articles: number | null
  context_prompt: string | null
  cron_schedule: string | null
  created_at: string
}

export const fetchAdminSources = async (): Promise<AdminSource[]> => {
  const { data } = await adminApi.get<AdminSource[]>('/admin/sources')
  return data
}

export const updateSource = async (id: number, update: Partial<AdminSource>): Promise<AdminSource> => {
  const { data } = await adminApi.patch<AdminSource>(`/admin/sources/${id}`, update)
  return data
}

export interface SourceTestArticle {
  title: string
  url: string
  author: string | null
  published_at: string | null
  image_url: string | null
  summary: string
  tags: string[]
}

export const testSource = async (id: number): Promise<SourceTestArticle[]> => {
  const { data } = await adminApi.post<SourceTestArticle[]>(`/admin/sources/${id}/test`)
  return data
}

// ── Models ────────────────────────────────────────────────────────────────────

export interface ModelStatus {
  name: string
  status: 'available' | 'cooldown'
  cooldown_remaining_sec: number
}

export const fetchModels = async (): Promise<ModelStatus[]> => {
  const { data } = await adminApi.get<ModelStatus[]>('/admin/models')
  return data
}

// ── Source Discovery ─────────────────────────────────────────────────────────

export interface CatalogSource {
  name: string
  slug: string
  url: string
  feed_url: string | null
  scraper_type: string
  category: string
  description: string
  tags: string[]
  requires?: string
  scrape_config?: Record<string, unknown>
  already_added: boolean
}

export interface SourceAnalysis {
  url: string
  feed_url: string | null
  scraper_type: string
  site_name: string
  slug: string
  description: string
  is_ai_relevant: boolean | null
  quality_score: number | null
  category: string
  primary_topics: string[]
  audience: string
  update_frequency: string
  recommendation: 'add' | 'maybe' | 'skip'
  reason: string
}

export const fetchSourceCatalog = async (): Promise<CatalogSource[]> => {
  const { data } = await adminApi.get<CatalogSource[]>('/admin/sources/catalog')
  return data
}

export const importCatalogSource = async (source: Omit<CatalogSource, 'already_added' | 'description' | 'tags' | 'requires'>) => {
  const { data } = await adminApi.post('/admin/sources/import', source)
  return data
}

export const analyzeSourceUrl = async (url: string): Promise<SourceAnalysis> => {
  const { data } = await adminApi.post<SourceAnalysis>('/admin/sources/analyze', { url })
  return data
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUserRecord {
  id: number
  username: string
  display_name: string | null
  role: 'admin' | 'editor'
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

export const fetchUsers = async (): Promise<AdminUserRecord[]> => {
  const { data } = await adminApi.get<AdminUserRecord[]>('/admin/users')
  return data
}

export const createUser = async (body: { username: string; password: string; display_name?: string; role?: string }): Promise<{ id: number; username: string }> => {
  const { data } = await adminApi.post('/admin/users', body)
  return data
}

export const updateUser = async (id: number, body: { display_name?: string; role?: string; is_active?: boolean; password?: string }): Promise<AdminUserRecord> => {
  const { data } = await adminApi.patch<AdminUserRecord>(`/admin/users/${id}`, body)
  return data
}

export const deleteUser = async (id: number): Promise<void> => {
  await adminApi.delete(`/admin/users/${id}`)
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  scrape_hour: number
  scrape_minute: number
  digest_hour: number
  digest_minute: number
  enabled: boolean
}

export const fetchScheduler = async (): Promise<SchedulerConfig> => {
  const { data } = await adminApi.get<SchedulerConfig>('/admin/scheduler')
  return data
}

export const updateScheduler = async (config: Partial<SchedulerConfig>): Promise<SchedulerConfig> => {
  const { data } = await adminApi.put<SchedulerConfig>('/admin/scheduler', config)
  return data
}
