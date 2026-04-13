import { useQuery } from '@tanstack/react-query'
import { fetchTodayDigest, fetchDigestByDate } from '../api/digests'

export const useTodayDigest = () =>
  useQuery({
    queryKey: ['digest', 'today'],
    queryFn: fetchTodayDigest,
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

export const useDigestByDate = (date: string) =>
  useQuery({
    queryKey: ['digest', date],
    queryFn: () => fetchDigestByDate(date),
    enabled: !!date,
    retry: false,
  })
