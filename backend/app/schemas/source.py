import json
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class SourceOut(BaseModel):
    id: int
    name: str
    slug: str
    url: str
    category: str
    scraper_type: str
    last_scraped_at: Optional[datetime]
    is_active: bool

    model_config = {"from_attributes": True}


class SourceAdminOut(SourceOut):
    max_articles: Optional[int]
    context_prompt: Optional[str]
    cron_schedule: Optional[str]
    scrape_config: Optional[dict] = None
    created_at: datetime

    @field_validator("scrape_config", mode="before")
    @classmethod
    def parse_scrape_config(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class SourceUpdate(BaseModel):
    is_active: Optional[bool] = None
    max_articles: Optional[int] = None
    context_prompt: Optional[str] = None
    cron_schedule: Optional[str] = None
    scrape_config: Optional[dict] = None
