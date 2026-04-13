import { adminApi } from './client'
import type { ArticleAdmin, DailyDigest } from '../types'

export const fetchQueue = async (page = 1): Promise<ArticleAdmin[]> => {
  const { data } = await adminApi.get<ArticleAdmin[]>('/admin/queue', { params: { page, per_page: 20 } })
  return data
}

export const approveArticle = async (id: number): Promise<void> => {
  await adminApi.post(`/admin/articles/${id}/approve`, { approved_by: 'admin' })
}

export const rejectArticle = async (id: number, reason: string): Promise<void> => {
  await adminApi.post(`/admin/articles/${id}/reject`, { reason, rejected_by: 'admin' })
}

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

export const triggerScrape = async (sourceSlug = 'all'): Promise<void> => {
  await adminApi.post('/admin/trigger-scrape', null, { params: { source_slug: sourceSlug } })
}

export const triggerDigest = async (): Promise<void> => {
  await adminApi.post('/admin/trigger-digest')
}
