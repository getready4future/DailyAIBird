"""
Google News RSS scraper.

Fetches a Google News search feed and resolves Google's redirect URLs
(news.google.com/rss/articles/CBMi...) to the real article URLs by
following HTTP redirects with httpx.
"""
import asyncio
import logging
from urllib.parse import urlparse

import feedparser
import httpx
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedArticle
from app.scrapers.rss_scraper import (
    HEADERS,
    MAX_CONTENT_CHARS,
    _PAGE_FETCH_MAX_CONSECUTIVE_429,
    _extract_og_image,
    _parse_date,
)

logger = logging.getLogger(__name__)

_GNEWS_DOMAIN = "news.google.com"
_REQUEST_DELAY = 0.25  # seconds between redirect-resolve requests


def _strip_publisher(title: str) -> str:
    """Remove trailing ' - Publisher Name' that Google News appends."""
    parts = title.rsplit(" - ", 1)
    # Publisher names are short; avoid stripping legitimate title dashes
    if len(parts) == 2 and len(parts[1].strip()) <= 60:
        return parts[0].strip()
    return title


def _get_source_title(entry) -> str | None:
    """Extract publisher name from feedparser entry.source."""
    src = getattr(entry, "source", None)
    if src is None:
        return None
    if hasattr(src, "get"):
        return src.get("title") or None
    if hasattr(src, "title"):
        return src.title or None
    return None


class GNewsScraper(BaseScraper):
    """Scraper for Google News RSS search feeds."""

    async def fetch_articles(self) -> list[ScrapedArticle]:
        feed_url = self.source_config.get("feed_url")
        if not feed_url:
            return []

        try:
            feed = feedparser.parse(feed_url)
        except Exception as exc:
            logger.error("GNews RSS parse error for %s: %s", feed_url, exc)
            return []

        if not feed.entries:
            logger.warning("GNews feed returned 0 entries: %s", feed_url)
            return []

        articles: list[ScrapedArticle] = []
        seen_urls: set[str] = set()
        gnews_429_count = 0

        async with httpx.AsyncClient(
            headers=HEADERS, timeout=20, follow_redirects=True
        ) as client:
            for entry in feed.entries:
                google_url = getattr(entry, "link", None)
                raw_title = getattr(entry, "title", "").strip()
                if not google_url or not raw_title:
                    continue

                title = _strip_publisher(raw_title)
                publisher = _get_source_title(entry)

                # Content seed from RSS summary
                raw_content = ""
                if hasattr(entry, "summary"):
                    raw_content = BeautifulSoup(entry.summary, "lxml").get_text(strip=True)

                # Follow Google redirect → get real article URL + OG image
                real_url = google_url
                image_url = None

                if gnews_429_count < _PAGE_FETCH_MAX_CONSECUTIVE_429:
                    try:
                        await asyncio.sleep(_REQUEST_DELAY)
                        resp = await client.get(google_url)
                        if resp.status_code == 429:
                            gnews_429_count += 1
                            if gnews_429_count >= _PAGE_FETCH_MAX_CONSECUTIVE_429:
                                logger.warning("Google News rate-limiting — stopping redirect resolution")
                        else:
                            gnews_429_count = 0
                            real_url = str(resp.url)          # final URL after all redirects
                            image_url = _extract_og_image(resp.text)
                            # Grab more content if the page was reachable
                            if not raw_content and resp.text:
                                from app.scrapers.rss_scraper import _extract_text
                                raw_content = _extract_text(resp.text)
                    except httpx.HTTPStatusError as exc:
                        logger.debug("GNews redirect HTTP error %s: %s", google_url, exc)
                    except Exception as exc:
                        logger.debug("GNews redirect resolve failed %s: %s", google_url, exc)

                # Skip if we've already seen this resolved URL in this batch
                if real_url in seen_urls:
                    continue
                seen_urls.add(real_url)

                articles.append(ScrapedArticle(
                    url=real_url,
                    title=title,
                    raw_content=raw_content[:MAX_CONTENT_CHARS],
                    author=publisher,
                    published_at=_parse_date(entry),
                    external_id=getattr(entry, "id", None),
                    image_url=image_url,
                    tags=[publisher] if publisher else [],
                ))

        logger.info("GNews scraped %d articles from %s", len(articles), feed_url)
        return articles
