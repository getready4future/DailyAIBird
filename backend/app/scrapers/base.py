from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ScrapedArticle:
    url: str
    title: str
    raw_content: str
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    external_id: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    image_url: Optional[str] = None


class BaseScraper(ABC):
    def __init__(self, source_config: dict):
        self.source_config = source_config

    @abstractmethod
    async def fetch_articles(self) -> list[ScrapedArticle]:
        pass
