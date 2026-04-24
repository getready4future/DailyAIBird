from app.scrapers.base import BaseScraper, ScrapedArticle
from app.scrapers.rss_scraper import RssScraper
from app.scrapers.arxiv_scraper import ArxivScraper
from app.scrapers.hn_scraper import HnScraper
from app.scrapers.reddit_scraper import RedditScraper
from app.scrapers.playwright_scraper import PlaywrightScraper
from app.scrapers.gnews_scraper import GNewsScraper


def get_scraper(source_config: dict) -> BaseScraper:
    scraper_type = source_config.get("scraper_type", "rss")
    mapping = {
        "rss": RssScraper,
        "arxiv": ArxivScraper,
        "hn": HnScraper,
        "reddit": RedditScraper,
        "playwright": PlaywrightScraper,
        "gnews": GNewsScraper,
    }
    cls = mapping.get(scraper_type, RssScraper)
    return cls(source_config)


__all__ = ["BaseScraper", "ScrapedArticle", "get_scraper"]
