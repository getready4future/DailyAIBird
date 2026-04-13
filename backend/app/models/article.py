from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(Integer, ForeignKey("sources.id"), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[Optional[str]] = mapped_column(String(200))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Raw content before AI processing
    raw_content: Mapped[Optional[str]] = mapped_column(Text)

    # AI-generated enrichment (Call B)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    topic: Mapped[Optional[str]] = mapped_column(String(100))
    relevance_score: Mapped[Optional[float]] = mapped_column(Float)
    impact_score: Mapped[Optional[float]] = mapped_column(Float)
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))  # positive|neutral|negative
    tags: Mapped[Optional[str]] = mapped_column(Text)  # JSON array

    # AI quality / scam analysis (Call A)
    quality_score: Mapped[Optional[float]] = mapped_column(Float)
    flags: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    is_scam: Mapped[Optional[bool]] = mapped_column(Boolean)
    scam_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Moderation workflow
    # pending_ai | pending_human | published | rejected | rejected_ai
    status: Mapped[str] = mapped_column(String(30), default="pending_ai", nullable=False)
    ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source = relationship("Source", back_populates="articles")
    digest_articles = relationship("DigestArticle", back_populates="article")

    __table_args__ = (
        Index("ix_articles_published_at", "published_at"),
        Index("ix_articles_topic_published", "topic", "published_at"),
        Index("ix_articles_relevance_published", "relevance_score", "published_at"),
        Index("ix_articles_status", "status"),
    )
