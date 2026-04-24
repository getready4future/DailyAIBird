export interface Source {
  id: number
  name: string
  slug: string
  url: string
  category: string
  scraper_type: string
  last_scraped_at: string | null
  is_active: boolean
}

export interface Article {
  id: number
  url: string
  title: string
  author: string | null
  published_at: string | null
  summary: string | null
  topic: string | null
  relevance_score: number | null
  impact_score: number | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  tags: string[]
  quality_score: number | null
  flags: string[]
  is_featured: boolean
  status: string
  image_url: string | null
  source: Source
  created_at: string
  approved_at: string | null
}

export interface ArticleAdmin extends Article {
  is_scam: boolean | null
  scam_reason: string | null
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  raw_content: string | null
}

export interface PaginatedArticles {
  items: Article[]
  total: number
  page: number
  per_page: number
  has_next: boolean
}

export interface DigestItem {
  title: string
  url: string
  one_liner: string
}

export interface DigestSection {
  topic: string
  heading: string
  items: DigestItem[]
}

export interface DailyDigest {
  id: number
  digest_date: string
  headline: string
  intro: string
  sections: DigestSection[]
  article_count: number
  model_used: string | null
  generated_at: string | null
  status: string
  approved_at: string | null
}

export interface TopicCount {
  topic: string
  count: number
}
