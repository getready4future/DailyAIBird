import { api } from './client'
import type { TopicCount } from '../types'

export const fetchTopics = async (): Promise<TopicCount[]> => {
  const { data } = await api.get<TopicCount[]>('/topics')
  return data
}
