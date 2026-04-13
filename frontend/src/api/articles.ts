import { api } from './client'
import type { Article, PaginatedArticles } from '../types'

export interface ArticleFilters {
  topic?: string
  source_slug?: string
  sort?: 'relevance' | 'date'
  page?: number
  per_page?: number
}

export const fetchArticles = async (filters: ArticleFilters = {}): Promise<PaginatedArticles> => {
  const { data } = await api.get<PaginatedArticles>('/articles', { params: filters })
  return data
}

export const fetchArticle = async (id: number): Promise<Article> => {
  const { data } = await api.get<Article>(`/articles/${id}`)
  return data
}
