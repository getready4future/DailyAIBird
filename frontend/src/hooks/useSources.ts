import { useQuery } from '@tanstack/react-query'
import { fetchSources } from '../api/sources'

export const useSources = () =>
  useQuery({
    queryKey: ['sources'],
    queryFn: fetchSources,
    staleTime: 10 * 60 * 1000,
  })
