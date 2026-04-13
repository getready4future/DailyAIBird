import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, field_validator

from app.schemas.source import SourceOut


class ArticleOut(BaseModel):
    id: int
    url: str
    title: str
    author: Optional[str]
    published_at: Optional[datetime]
    summary: Optional[str]
    topic: Optional[str]
    relevance_score: Optional[float]
    impact_score: Optional[float]
    sentiment: Optional[str]
    tags: list[str]
    quality_score: Optional[float]
    flags: list[str]
    is_featured: bool
    status: str
    source: SourceOut
    created_at: datetime

    @field_validator("tags", "flags", mode="before")
    @classmethod
    def parse_json_list(cls, v: Any) -> list:
        if v is None:
            return []
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v

    model_config = {"from_attributes": True}


class ArticleAdminOut(ArticleOut):
    """Extended view for the moderation queue — includes scam analysis."""
    is_scam: Optional[bool]
    scam_reason: Optional[str]
    rejection_reason: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    raw_content: Optional[str]


class PaginatedArticles(BaseModel):
    items: list[ArticleOut]
    total: int
    page: int
    per_page: int
    has_next: bool


class ApproveRequest(BaseModel):
    approved_by: str = "admin"


class RejectRequest(BaseModel):
    reason: str
    rejected_by: str = "admin"
