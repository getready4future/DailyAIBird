import { api } from './client'
import type { Source } from '../types'

export const fetchSources = async (): Promise<Source[]> => {
  const { data } = await api.get<Source[]>('/sources')
  return data
}
