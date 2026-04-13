import { useQuery } from '@tanstack/react-query'
import { fetchTopics } from '../api/topics'

export const useTopics = () =>
  useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
    staleTime: 10 * 60 * 1000,
  })
