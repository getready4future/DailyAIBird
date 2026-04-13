import json
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator


class DigestItem(BaseModel):
    title: str
    url: str
    one_liner: str


class DigestSection(BaseModel):
    topic: str
    heading: str
    items: list[DigestItem]


class DigestOut(BaseModel):
    id: int
    digest_date: date
    headline: str
    intro: str
    sections: list[DigestSection]
    article_count: int
    model_used: Optional[str]
    generated_at: Optional[datetime]
    status: str
    approved_at: Optional[datetime]

    @field_validator("sections", mode="before")
    @classmethod
    def parse_sections(cls, v: Any) -> list:
        if isinstance(v, str):
            data = json.loads(v)
            return [DigestSection(**s) for s in data]
        return v

    model_config = {"from_attributes": True}
