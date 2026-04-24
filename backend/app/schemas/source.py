from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
    created_at: datetime


class SourceUpdate(BaseModel):
    is_active: Optional[bool] = None
    max_articles: Optional[int] = None
    context_prompt: Optional[str] = None
    cron_schedule: Optional[str] = None
