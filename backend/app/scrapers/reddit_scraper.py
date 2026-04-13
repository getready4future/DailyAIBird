import logging
from datetime import datetime

import httpx

from app.scrapers.base import BaseScraper, ScrapedArticle
from app.config import settings

logger = logging.getLogger(__name__)


class RedditScraper(BaseScraper):
    async def fetch_articles(self) -> list[ScrapedArticle]:
        feed_url = self.source_config.get("feed_url")
        if not feed_url:
            return []

        headers = {
            "User-Agent": settings.REDDIT_USER_AGENT,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(headers=headers, timeout=15, follow_redirects=True) as client:
                resp = await client.get(feed_url)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("Reddit fetch error for %s: %s", feed_url, exc)
            return []

        articles: list[ScrapedArticle] = []
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            title = (post.get("title") or "").strip()
            post_url = post.get("url") or ""
            selftext = (post.get("selftext") or "").strip()
            permalink = post.get("permalink", "")
            full_url = f"https://www.reddit.com{permalink}" if permalink else post_url

            if not title:
                continue

            # Use selftext for self-posts, otherwise use linked URL as context
            if selftext:
                raw_content = selftext[:3000]
            elif post_url and "reddit.com" not in post_url:
                raw_content = f"Reddit post linking to: {post_url}\nTitle: {title}"
            else:
                raw_content = title

            published_at: datetime | None = None
            created_utc = post.get("created_utc")
            if created_utc:
                published_at = datetime.utcfromtimestamp(created_utc)

            articles.append(ScrapedArticle(
                url=full_url,
                title=title,
                raw_content=raw_content,
                author=post.get("author"),
                published_at=published_at,
                external_id=post.get("id"),
            ))

        return articles
