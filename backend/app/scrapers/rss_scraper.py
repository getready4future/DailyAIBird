import asyncio
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

import feedparser
import httpx
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedArticle

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; DailyAIBird/1.0; +https://github.com/getready4future/DailyAIBird)",
}
MAX_CONTENT_CHARS = 4000
# After N consecutive 429s from a domain, stop fetching pages from it
_PAGE_FETCH_MAX_CONSECUTIVE_429 = 3


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()
    for selector in ["article", "[role='main']", ".article-body", ".post-content",
                     ".entry-content", "main"]:
        el = soup.select_one(selector)
        if el:
            return el.get_text(separator=" ", strip=True)[:MAX_CONTENT_CHARS]
    return " ".join(p.get_text(strip=True) for p in soup.find_all("p"))[:MAX_CONTENT_CHARS]


def _extract_og_image(html: str) -> str | None:
    soup = BeautifulSoup(html, "lxml")
    tag = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
    if tag:
        return tag.get("content") or None
    return None


def _image_from_feed_entry(entry) -> str | None:
    """Try to get image URL from RSS feed metadata."""
    # media:thumbnail
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        return entry.media_thumbnail[0].get("url")
    # media:content with medium=image
    if hasattr(entry, "media_content") and entry.media_content:
        for mc in entry.media_content:
            if mc.get("medium") == "image" and mc.get("url"):
                return mc["url"]
            if mc.get("url", "").startswith("http") and any(
                mc["url"].lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")
            ):
                return mc["url"]
    # enclosure (podcasts / some RSS feeds)
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image/"):
                return enc.get("href") or enc.get("url")
    return None


def _parse_date(entry) -> datetime | None:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).replace(tzinfo=None)
    if hasattr(entry, "updated_parsed") and entry.updated_parsed:
        return datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc).replace(tzinfo=None)
    return None


class RssScraper(BaseScraper):
    async def fetch_articles(self) -> list[ScrapedArticle]:
        feed_url = self.source_config.get("feed_url")
        if not feed_url:
            return []

        fetch_full_text = (self.source_config.get("scrape_config") or {}).get("fetch_full_text", False)

        try:
            feed = feedparser.parse(feed_url)
        except Exception as exc:
            logger.error("RSS parse error for %s: %s", feed_url, exc)
            return []

        articles: list[ScrapedArticle] = []
        # Per-domain consecutive-429 counter — stop page fetching after too many
        domain_429: dict[str, int] = {}

        async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True) as client:
            for entry in feed.entries:
                url = getattr(entry, "link", None)
                title = getattr(entry, "title", "").strip()
                if not url or not title:
                    continue

                # Raw content seed from feed
                raw_content = ""
                if hasattr(entry, "summary"):
                    raw_content = BeautifulSoup(entry.summary, "lxml").get_text(strip=True)
                if hasattr(entry, "content") and entry.content:
                    raw_content = BeautifulSoup(entry.content[0].value, "lxml").get_text(strip=True)

                image_url = _image_from_feed_entry(entry)

                # Fetch full page (for text and/or OG image) unless domain is rate-limiting us
                domain = urlparse(url).netloc
                if (fetch_full_text or not image_url) and domain_429.get(domain, 0) < _PAGE_FETCH_MAX_CONSECUTIVE_429:
                    try:
                        await asyncio.sleep(0.15)  # polite delay between page requests
                        resp = await client.get(url)
                        if resp.status_code == 429:
                            domain_429[domain] = domain_429.get(domain, 0) + 1
                            if domain_429[domain] >= _PAGE_FETCH_MAX_CONSECUTIVE_429:
                                logger.info("RSS page fetch: %s rate-limiting — skipping remaining page fetches for this domain", domain)
                        else:
                            domain_429[domain] = 0  # reset on success
                            resp.raise_for_status()
                            html = resp.text
                            if fetch_full_text:
                                raw_content = _extract_text(html)
                            if not image_url:
                                image_url = _extract_og_image(html)
                    except httpx.HTTPStatusError as exc:
                        logger.debug("Page fetch HTTP error for %s: %s", url, exc)
                    except Exception as exc:
                        logger.debug("Page fetch failed for %s: %s", url, exc)

                raw_content = raw_content[:MAX_CONTENT_CHARS]

                articles.append(ScrapedArticle(
                    url=url,
                    title=title,
                    raw_content=raw_content,
                    author=getattr(entry, "author", None),
                    published_at=_parse_date(entry),
                    external_id=getattr(entry, "id", None),
                    image_url=image_url,
                ))

        return articles
