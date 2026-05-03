"""
Central source registry. Each dict defines a news source and how to scrape it.
scraper_type values: rss | arxiv | hn | reddit | playwright | gnews
is_active: False = passive (won't be scraped)

Curated for the 6-8 published-articles-per-day target. Sources span:
  - Major AI labs (OpenAI, Anthropic, DeepMind, Meta, Mistral, xAI, HuggingFace)
  - Enterprise / consumer (Microsoft, NVIDIA)
  - Tier-1 tech media (TechCrunch, The Verge, MIT Tech Review, Wired, VentureBeat)
  - Engineer-focused newsletters (Latent Space, Last Week in AI, Import AI)
  - Research (arXiv cs.LG and cs.CL — cs.AI deprioritised due to LG overlap)
  - Community curation (HN, r/MachineLearning)
  - Turkish-language coverage (Webrazzi, ShiftDelete)
"""

SOURCES: list[dict] = [
    # ── Major AI Labs (RSS) ────────────────────────────────────────────────────
    {
        "name": "Anthropic News",
        "slug": "anthropic-news",
        "url": "https://www.anthropic.com/news",
        "feed_url": "https://www.anthropic.com/rss.xml",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "Google DeepMind Blog",
        "slug": "deepmind-blog",
        "url": "https://deepmind.google/discover/blog/",
        "feed_url": "https://deepmind.google/blog/feed/basic",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "HuggingFace Blog",
        "slug": "huggingface-blog",
        "url": "https://huggingface.co/blog",
        "feed_url": "https://huggingface.co/blog/feed.xml",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "Meta AI Blog",
        "slug": "meta-ai-blog",
        "url": "https://ai.meta.com/blog/",
        "feed_url": "https://ai.meta.com/blog/feed/",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    # OpenAI: no native RSS — use Google News site-filter as a proxy
    {
        "name": "OpenAI News",
        "slug": "openai-news",
        "url": "https://openai.com/news/",
        "feed_url": (
            "https://news.google.com/rss/search"
            "?q=site:openai.com&hl=en-US&gl=US&ceid=US:en"
        ),
        "scraper_type": "gnews",
        "category": "blog",
        "is_active": True,
        "scrape_config": {},
    },
    # xAI: no native RSS
    {
        "name": "xAI News",
        "slug": "xai-news",
        "url": "https://x.ai/news",
        "feed_url": (
            "https://news.google.com/rss/search"
            "?q=site:x.ai&hl=en-US&gl=US&ceid=US:en"
        ),
        "scraper_type": "gnews",
        "category": "blog",
        "is_active": True,
        "scrape_config": {},
    },
    # Mistral: no native RSS
    {
        "name": "Mistral AI News",
        "slug": "mistral-news",
        "url": "https://mistral.ai/news",
        "feed_url": (
            "https://news.google.com/rss/search"
            "?q=site:mistral.ai&hl=en-US&gl=US&ceid=US:en"
        ),
        "scraper_type": "gnews",
        "category": "blog",
        "is_active": True,
        "scrape_config": {},
    },
    {
        "name": "Microsoft AI Blog",
        "slug": "microsoft-ai-blog",
        "url": "https://blogs.microsoft.com/ai/",
        "feed_url": "https://blogs.microsoft.com/ai/feed/",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "NVIDIA Blog AI",
        "slug": "nvidia-blog-ai",
        "url": "https://blogs.nvidia.com/blog/category/deep-learning/",
        "feed_url": "https://blogs.nvidia.com/feed/",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    # ── Tier-1 Tech Media (RSS) ───────────────────────────────────────────────
    {
        "name": "TechCrunch AI",
        "slug": "techcrunch-ai",
        "url": "https://techcrunch.com/category/artificial-intelligence/",
        "feed_url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "The Verge AI",
        "slug": "verge-ai",
        "url": "https://www.theverge.com/ai-artificial-intelligence",
        "feed_url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "MIT Technology Review AI",
        "slug": "mit-tech-review-ai",
        "url": "https://www.technologyreview.com/topic/artificial-intelligence/",
        "feed_url": "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "VentureBeat AI",
        "slug": "venturebeat-ai",
        "url": "https://venturebeat.com/category/ai/",
        "feed_url": "https://venturebeat.com/category/ai/feed/",
        "scraper_type": "rss",
        "category": "news",
        "is_active": False,  # quality drift in 2025-26; keep as fallback
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "Wired AI",
        "slug": "wired-ai",
        "url": "https://www.wired.com/tag/artificial-intelligence/",
        "feed_url": "https://www.wired.com/feed/tag/ai/latest/rss",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    # ── Newsletters (Substack / RSS) ──────────────────────────────────────────
    {
        "name": "Latent Space",
        "slug": "latent-space",
        "url": "https://www.latent.space/",
        "feed_url": "https://www.latent.space/feed",
        "scraper_type": "rss",
        "category": "newsletter",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "Last Week in AI",
        "slug": "last-week-in-ai",
        "url": "https://lastweekin.ai/",
        "feed_url": "https://lastweekin.ai/feed",
        "scraper_type": "rss",
        "category": "newsletter",
        "is_active": False,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "Import AI",
        "slug": "import-ai",
        "url": "https://importai.substack.com/",
        "feed_url": "https://importai.substack.com/feed",
        "scraper_type": "rss",
        "category": "newsletter",
        "is_active": False,
        "scrape_config": {"fetch_full_text": True},
    },
    # ── Turkish-language coverage ─────────────────────────────────────────────
    {
        "name": "Webrazzi Yapay Zeka",
        "slug": "webrazzi-ai",
        "url": "https://webrazzi.com/kategori/yapay-zeka/",
        "feed_url": "https://webrazzi.com/feed/",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "ShiftDelete AI",
        "slug": "shiftdelete-ai",
        "url": "https://shiftdelete.net/yapay-zeka",
        "feed_url": "https://shiftdelete.net/feed",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": True},
    },
    # ── Google News (fallback for missed stories) ─────────────────────────────
    {
        "name": "Google News AI",
        "slug": "google-news-ai",
        "url": "https://news.google.com/search?q=artificial+intelligence",
        "feed_url": (
            "https://news.google.com/rss/search"
            "?q=artificial+intelligence+OR+LLM+OR+AI+model+OR+machine+learning"
            "&hl=en-US&gl=US&ceid=US:en"
        ),
        "scraper_type": "gnews",
        "category": "news",
        "is_active": False,  # demoted to fallback — high duplication with named sources
        "scrape_config": {},
    },
    # ── Research (arXiv API) ──────────────────────────────────────────────────
    # cs.AI deprioritised: ~60% overlap with cs.LG (cross-listing)
    {
        "name": "arXiv cs.AI",
        "slug": "arxiv-cs-ai",
        "url": "https://arxiv.org/list/cs.AI/recent",
        "feed_url": (
            "https://export.arxiv.org/api/query"
            "?search_query=cat:cs.AI"
            "&sortBy=submittedDate&sortOrder=descending&max_results=30"
        ),
        "scraper_type": "arxiv",
        "category": "research",
        "is_active": False,
        "scrape_config": {},
    },
    {
        "name": "arXiv cs.LG",
        "slug": "arxiv-cs-lg",
        "url": "https://arxiv.org/list/cs.LG/recent",
        "feed_url": (
            "https://export.arxiv.org/api/query"
            "?search_query=cat:cs.LG"
            "&sortBy=submittedDate&sortOrder=descending&max_results=30"
        ),
        "scraper_type": "arxiv",
        "category": "research",
        # Activated to give researchers and AI-literate readers a path to
        # primary research, not just press releases about it.
        "is_active": True,
        "scrape_config": {},
    },
    {
        "name": "arXiv cs.CL",
        "slug": "arxiv-cs-cl",
        "url": "https://arxiv.org/list/cs.CL/recent",
        "feed_url": (
            "https://export.arxiv.org/api/query"
            "?search_query=cat:cs.CL"
            "&sortBy=submittedDate&sortOrder=descending&max_results=30"
        ),
        "scraper_type": "arxiv",
        "category": "research",
        "is_active": True,
        "scrape_config": {},
    },
    # ── Social / Community ────────────────────────────────────────────────────
    {
        "name": "Hacker News AI",
        "slug": "hackernews-ai",
        "url": "https://news.ycombinator.com",
        "feed_url": None,
        "scraper_type": "hn",
        "category": "social",
        "is_active": True,
        "scrape_config": {"min_score": 10},
    },
    {
        "name": "Reddit r/MachineLearning",
        "slug": "reddit-ml",
        "url": "https://www.reddit.com/r/MachineLearning/",
        "feed_url": "https://www.reddit.com/r/MachineLearning/top.json?t=day&limit=25",
        "scraper_type": "reddit",
        "category": "social",
        "is_active": False,
        "scrape_config": {},
    },
    # r/artificial removed from default-active set: signal-to-noise too low,
    # r/MachineLearning already covers this audience. Kept inactive for opt-in.
    {
        "name": "Reddit r/artificial",
        "slug": "reddit-artificial",
        "url": "https://www.reddit.com/r/artificial/",
        "feed_url": "https://www.reddit.com/r/artificial/top.json?t=day&limit=25",
        "scraper_type": "reddit",
        "category": "social",
        "is_active": False,
        "scrape_config": {},
    },
    # ── Research (Playwright) ─────────────────────────────────────────────────
    {
        "name": "Papers With Code",
        "slug": "paperswithcode",
        "url": "https://paperswithcode.com/latest",
        "feed_url": None,
        "scraper_type": "playwright",
        "category": "research",
        "is_active": False,
        "scrape_config": {
            "wait_selector": ".infinite-container",
            "article_selector": ".paper-card",
            "title_selector": "h1",
            "link_selector": "a",
        },
    },
]
