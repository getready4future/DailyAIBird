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
