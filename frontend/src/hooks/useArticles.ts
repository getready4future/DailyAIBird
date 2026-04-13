import { useQuery } from '@tanstack/react-query'
import { fetchArticles, fetchArticle, type ArticleFilters } from '../api/articles'

export const useArticles = (filters: ArticleFilters) =>
  useQuery({
    queryKey: ['articles', filters],
    queryFn: () => fetchArticles(filters),
    staleTime: 5 * 60 * 1000,
  })

export const useArticle = (id: number) =>
  useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id),
    enabled: !!id,
  })
