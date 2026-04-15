"""
Central source registry. Each dict defines a news source and how to scrape it.
scraper_type values: rss | arxiv | hn | reddit | playwright
is_active: False = passive (won't be scraped)
"""

SOURCES: list[dict] = [
    # ── Major AI Blogs (RSS) ──────────────────────────────────────────────────
    {
        "name": "Anthropic News",
        "slug": "anthropic-news",
        "url": "https://www.anthropic.com/news",
        "feed_url": "https://www.anthropic.com/rss.xml",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": False,
        "scrape_config": {"fetch_full_text": True},
    },
    {
        "name": "Google DeepMind Blog",
        "slug": "deepmind-blog",
        "url": "https://deepmind.google/discover/blog/",
        "feed_url": "https://deepmind.google/blog/feed/basic",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": False,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "HuggingFace Blog",
        "slug": "huggingface-blog",
        "url": "https://huggingface.co/blog",
        "feed_url": "https://huggingface.co/blog/feed.xml",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": False,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "Meta AI Blog",
        "slug": "meta-ai-blog",
        "url": "https://ai.meta.com/blog/",
        "feed_url": "https://ai.meta.com/blog/feed/",
        "scraper_type": "rss",
        "category": "blog",
        "is_active": False,
        "scrape_config": {"fetch_full_text": True},
    },
    # ── Tech News (RSS) ───────────────────────────────────────────────────────
    {
        "name": "TechCrunch AI",
        "slug": "techcrunch-ai",
        "url": "https://techcrunch.com/category/artificial-intelligence/",
        "feed_url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "The Verge AI",
        "slug": "verge-ai",
        "url": "https://www.theverge.com/ai-artificial-intelligence",
        "feed_url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "scraper_type": "rss",
        "category": "news",
        "is_active": True,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "VentureBeat AI",
        "slug": "venturebeat-ai",
        "url": "https://venturebeat.com/category/ai/",
        "feed_url": "https://venturebeat.com/category/ai/feed/",
        "scraper_type": "rss",
        "category": "news",
        "is_active": False,
        "scrape_config": {"fetch_full_text": False},
    },
    {
        "name": "Wired AI",
        "slug": "wired-ai",
        "url": "https://www.wired.com/tag/artificial-intelligence/",
        "feed_url": "https://www.wired.com/feed/tag/ai/latest/rss",
        "scraper_type": "rss",
        "category": "news",
        "is_active": False,
        "scrape_config": {"fetch_full_text": False},
    },
    # ── Research (arXiv API) ──────────────────────────────────────────────────
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
        "is_active": False,
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
        "is_active": False,
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
