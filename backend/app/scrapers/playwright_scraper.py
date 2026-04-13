import logging

from app.scrapers.base import BaseScraper, ScrapedArticle
from app.config import settings

logger = logging.getLogger(__name__)


class PlaywrightScraper(BaseScraper):
    async def fetch_articles(self) -> list[ScrapedArticle]:
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("Playwright not installed, skipping %s", self.source_config.get("slug"))
            return []

        scrape_cfg = self.source_config.get("scrape_config") or {}
        url = self.source_config.get("url", "")
        wait_selector = scrape_cfg.get("wait_selector", "body")

        articles: list[ScrapedArticle] = []

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=settings.PLAYWRIGHT_HEADLESS)
                page = await browser.new_page()
                await page.goto(url, timeout=30000)
                await page.wait_for_selector(wait_selector, timeout=15000)

                # Generic extraction: find anchor tags with title/heading
                links = await page.query_selector_all("a[href]")
                seen: set[str] = set()
                for link in links[:50]:
                    href = await link.get_attribute("href") or ""
                    text = (await link.inner_text()).strip()

                    if not text or len(text) < 20 or href in seen:
                        continue
                    if not href.startswith("http"):
                        base = url.rstrip("/")
                        href = base + href if href.startswith("/") else href

                    seen.add(href)
                    articles.append(ScrapedArticle(
                        url=href,
                        title=text[:300],
                        raw_content=text,
                    ))

                await browser.close()
        except Exception as exc:
            logger.error("Playwright error for %s: %s", url, exc)

        return articles
