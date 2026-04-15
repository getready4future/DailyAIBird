import logging
import time
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedArticle

logger = logging.getLogger(__name__)

ALGOLIA_URL = (
    "https://hn.algolia.com/api/v1/search_by_date"
    "?query=OpenAI+OR+Anthropic+OR+Google+AI+OR+Claude+OR+ChatGPT"
    "&tags=story"
    "&hitsPerPage=5"
)
MAX_CONTENT_CHARS = 3000

# Paywalled or bot-blocking domains — skip full content fetch
BLOCKED_DOMAINS = {
    "nytimes.com", "wsj.com", "bloomberg.com", "economist.com",
    "ft.com", "washingtonpost.com", "theatlantic.com", "newyorker.com",
    "thetimes.co.uk", "telegraph.co.uk", "businessinsider.com",
    "twitter.com", "x.com",
}


def _is_blocked(url: str) -> bool:
    return any(domain in url for domain in BLOCKED_DOMAINS)


class HnScraper(BaseScraper):
    async def fetch_articles(self) -> list[ScrapedArticle]:
        min_score = (self.source_config.get("scrape_config") or {}).get("min_score", 5)
        week_ago_ts = int(time.time()) - 86400 * 7
        url = f"{ALGOLIA_URL}&numericFilters=created_at_i>{week_ago_ts},points>{min_score}"

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("HN Algolia fetch error: %s", exc)
            return []

        articles: list[ScrapedArticle] = []
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            for hit in data.get("hits", []):
                story_url = hit.get("url")
                title = (hit.get("title") or "").strip()
                if not title:
                    continue

                # Use HN discussion page as fallback URL
                object_id = hit.get("objectID", "")
                if not story_url:
                    story_url = f"https://news.ycombinator.com/item?id={object_id}"

                raw_content = ""
                if story_url and "ycombinator.com" not in story_url and not _is_blocked(story_url):
                    try:
                        resp = await client.get(story_url)
                        soup = BeautifulSoup(resp.text, "lxml")
                        for tag in soup(["script", "style", "nav", "header", "footer"]):
                            tag.decompose()
                        for selector in ["article", "[role='main']", ".content", "main"]:
                            el = soup.select_one(selector)
                            if el:
                                raw_content = el.get_text(separator=" ", strip=True)[:MAX_CONTENT_CHARS]
                                break
                        if not raw_content:
                            raw_content = " ".join(p.get_text(strip=True) for p in soup.find_all("p"))[:MAX_CONTENT_CHARS]
                    except Exception:
                        pass

                if not raw_content:
                    raw_content = f"HN story: {title} (score: {hit.get('points', 0)})"

                published_at: datetime | None = None
                ts = hit.get("created_at_i")
                if ts:
                    published_at = datetime.utcfromtimestamp(ts)

                articles.append(ScrapedArticle(
                    url=story_url,
                    title=title,
                    raw_content=raw_content,
                    author=hit.get("author"),
                    published_at=published_at,
                    external_id=str(object_id),
                ))

        return articles
