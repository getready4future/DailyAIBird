import { api } from './client'
import type { DailyDigest } from '../types'

export const fetchTodayDigest = async (): Promise<DailyDigest> => {
  const { data } = await api.get<DailyDigest>('/digests/today')
  return data
}

export const fetchDigestByDate = async (date: string): Promise<DailyDigest> => {
  const { data } = await api.get<DailyDigest>(`/digests/${date}`)
  return data
}
