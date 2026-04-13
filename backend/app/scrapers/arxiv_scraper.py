import logging
import xml.etree.ElementTree as ET
from datetime import datetime

import httpx

from app.scrapers.base import BaseScraper, ScrapedArticle

logger = logging.getLogger(__name__)

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "arxiv": "http://arxiv.org/schemas/atom",
}


class ArxivScraper(BaseScraper):
    async def fetch_articles(self) -> list[ScrapedArticle]:
        feed_url = self.source_config.get("feed_url")
        if not feed_url:
            return []

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(feed_url)
                resp.raise_for_status()
        except Exception as exc:
            logger.error("arXiv fetch error: %s", exc)
            return []

        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as exc:
            logger.error("arXiv XML parse error: %s", exc)
            return []

        articles: list[ScrapedArticle] = []
        for entry in root.findall("atom:entry", NS):
            title_el = entry.find("atom:title", NS)
            summary_el = entry.find("atom:summary", NS)
            id_el = entry.find("atom:id", NS)
            published_el = entry.find("atom:published", NS)

            if title_el is None or id_el is None:
                continue

            arxiv_url = id_el.text.strip() if id_el.text else ""
            # Convert http://arxiv.org/abs/XXXX to https://arxiv.org/abs/XXXX
            arxiv_url = arxiv_url.replace("http://", "https://")

            title = (title_el.text or "").strip().replace("\n", " ")
            abstract = (summary_el.text or "").strip() if summary_el is not None else ""

            # Author(s)
            authors = [
                (a.find("atom:name", NS).text or "").strip()
                for a in entry.findall("atom:author", NS)
                if a.find("atom:name", NS) is not None
            ]

            published_at: datetime | None = None
            if published_el is not None and published_el.text:
                try:
                    published_at = datetime.fromisoformat(published_el.text.replace("Z", "+00:00")).replace(tzinfo=None)
                except ValueError:
                    pass

            # Tags from category
            tags = [
                cat.get("term", "")
                for cat in entry.findall("atom:category", NS)
                if cat.get("term")
            ]

            articles.append(ScrapedArticle(
                url=arxiv_url,
                title=title,
                raw_content=abstract[:4000],
                author=", ".join(authors[:3]) if authors else None,
                published_at=published_at,
                external_id=arxiv_url,
                tags=tags,
            ))

        return articles
