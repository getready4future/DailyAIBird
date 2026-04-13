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
