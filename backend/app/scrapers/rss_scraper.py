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

# Retry / resilience knobs
_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF_BASE = 1.0  # seconds — multiplied by 2**attempt

# After N consecutive 429s from a domain, stop fetching pages from it
_PAGE_FETCH_MAX_CONSECUTIVE_429 = 3

# Image quality thresholds (#7)
_IMAGE_MIN_BYTES = 5_000          # < 5KB → likely placeholder/favicon
_IMAGE_BAD_EXT = (".svg", ".ico", ".gif")
_IMAGE_BAD_PATH_HINTS = ("favicon", "1x1", "pixel", "tracker", "spacer")


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
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        return entry.media_thumbnail[0].get("url")
    if hasattr(entry, "media_content") and entry.media_content:
        for mc in entry.media_content:
            if mc.get("medium") == "image" and mc.get("url"):
                return mc["url"]
            if mc.get("url", "").startswith("http") and any(
                mc["url"].lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")
            ):
                return mc["url"]
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


def _bad_image_url(url: str | None) -> bool:
    """Cheap rejection for clearly non-article images (#7 first pass)."""
    if not url:
        return True
    lower = url.lower()
    if any(lower.endswith(ext) for ext in _IMAGE_BAD_EXT):
        return True
    if any(hint in lower for hint in _IMAGE_BAD_PATH_HINTS):
        return True
    return False


async def _validate_image(client: httpx.AsyncClient, url: str) -> bool:
    """HEAD request — confirm content-type is image/* and reasonable size (#7)."""
    if _bad_image_url(url):
        return False
    try:
        r = await client.head(url, timeout=8, follow_redirects=True)
    except Exception:
        return False
    if r.status_code >= 400:
        return False
    ctype = r.headers.get("content-type", "").lower()
    if not ctype.startswith("image/") or "svg" in ctype:
        return False
    clen = r.headers.get("content-length")
    if clen and clen.isdigit() and int(clen) < _IMAGE_MIN_BYTES:
        return False
    return True


async def _retrying_get(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response | None:
    """GET with bounded exponential backoff on transient errors (#1)."""
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            resp = await client.get(url, **kwargs)
            # 5xx → retry; 429 surfaces to caller (it manages per-domain budget)
            if 500 <= resp.status_code < 600 and attempt < _RETRY_ATTEMPTS - 1:
                await asyncio.sleep(_RETRY_BACKOFF_BASE * (2 ** attempt))
                continue
            return resp
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            if attempt < _RETRY_ATTEMPTS - 1:
                await asyncio.sleep(_RETRY_BACKOFF_BASE * (2 ** attempt))
                continue
            logger.debug("Page fetch giving up on %s after %d tries: %s", url, attempt + 1, exc)
            return None
    return None


def _parse_feed_with_caching(feed_url: str, etag: str | None, last_modified: str | None):
    """Wrapper around feedparser.parse that uses ETag/If-Modified-Since (#1).

    Returns (feed, new_etag, new_modified, status). status==304 means cache hit.
    """
    kwargs: dict = {}
    if etag:
        kwargs["etag"] = etag
    if last_modified:
        kwargs["modified"] = last_modified
    feed = feedparser.parse(feed_url, **kwargs)
    new_etag = getattr(feed, "etag", None) or etag
    new_mod = getattr(feed, "modified", None) or last_modified
    status = getattr(feed, "status", 0)
    return feed, new_etag, new_mod, status


class RssScraper(BaseScraper):
    async def fetch_articles(self) -> list[ScrapedArticle]:
        feed_url = self.source_config.get("feed_url")
        if not feed_url:
            return []

        fetch_full_text = (self.source_config.get("scrape_config") or {}).get("fetch_full_text", False)

        # Pull current ETag/Last-Modified from DB so we get 304s when unchanged (#1)
        cached_etag = self.source_config.get("etag")
        cached_modified = self.source_config.get("last_modified")
        slug = self.source_config.get("slug")

        # Wrap the synchronous feedparser call in a retry loop
        feed = None
        new_etag = cached_etag
        new_modified = cached_modified
        status = 0
        for attempt in range(_RETRY_ATTEMPTS):
            try:
                feed, new_etag, new_modified, status = _parse_feed_with_caching(
                    feed_url, cached_etag, cached_modified,
                )
                break
            except Exception as exc:
                if attempt < _RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(_RETRY_BACKOFF_BASE * (2 ** attempt))
                    continue
                logger.error("RSS parse error for %s after %d tries: %s", feed_url, attempt + 1, exc)
                self._save_etag(slug, cached_etag, cached_modified)
                return []

        # Persist ETag/Last-Modified for next run (best-effort)
        if new_etag != cached_etag or new_modified != cached_modified:
            self._save_etag(slug, new_etag, new_modified)

        if status == 304:
            logger.info("RSS feed unchanged (304) for %s", feed_url)
            return []
        if feed is None:
            return []

        articles: list[ScrapedArticle] = []
        domain_429: dict[str, int] = {}

        async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True) as client:
            for entry in feed.entries:
                url = getattr(entry, "link", None)
                title = getattr(entry, "title", "").strip()
                if not url or not title:
                    continue

                raw_content = ""
                if hasattr(entry, "summary"):
                    raw_content = BeautifulSoup(entry.summary, "lxml").get_text(strip=True)
                if hasattr(entry, "content") and entry.content:
                    raw_content = BeautifulSoup(entry.content[0].value, "lxml").get_text(strip=True)

                image_url = _image_from_feed_entry(entry)

                domain = urlparse(url).netloc
                if (fetch_full_text or not image_url) and domain_429.get(domain, 0) < _PAGE_FETCH_MAX_CONSECUTIVE_429:
                    await asyncio.sleep(0.15)
                    resp = await _retrying_get(client, url)
                    if resp is None:
                        pass
                    elif resp.status_code == 429:
                        domain_429[domain] = domain_429.get(domain, 0) + 1
                        if domain_429[domain] >= _PAGE_FETCH_MAX_CONSECUTIVE_429:
                            logger.info("RSS page fetch: %s rate-limiting — skipping remaining for this domain", domain)
                    elif resp.status_code < 400:
                        domain_429[domain] = 0
                        html = resp.text
                        if fetch_full_text:
                            raw_content = _extract_text(html)
                        if not image_url:
                            image_url = _extract_og_image(html)

                # Image quality filter (#7) — drop clearly bad URLs without a HEAD
                if image_url and _bad_image_url(image_url):
                    image_url = None

                # If we have a candidate image, validate it (HEAD)
                if image_url:
                    ok = await _validate_image(client, image_url)
                    if not ok:
                        image_url = None

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

    @staticmethod
    def _save_etag(slug: str | None, etag: str | None, modified: str | None) -> None:
        if not slug:
            return
        try:
            from app.database import SessionLocal
            from app.models.source import Source
            db = SessionLocal()
            try:
                src = db.query(Source).filter(Source.slug == slug).first()
                if src is not None:
                    src.etag = etag
                    src.last_modified = modified
                    db.commit()
            finally:
                db.close()
        except Exception as exc:
            logger.debug("Failed to persist ETag for %s: %s", slug, exc)
