from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailyDigest(Base):
    __tablename__ = "daily_digests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    digest_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    headline: Mapped[str] = mapped_column(String(500), nullable=False)
    intro: Mapped[str] = mapped_column(Text, nullable=False)
    sections: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array
    top_story_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("articles.id"))
    article_count: Mapped[int] = mapped_column(Integer, default=0)
    model_used: Mapped[Optional[str]] = mapped_column(String(100))
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Moderation
    status: Mapped[str] = mapped_column(String(30), default="pending_review")  # pending_review|published
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    top_story = relationship("Article", foreign_keys=[top_story_id])
    digest_articles = relationship("DigestArticle", back_populates="digest")


class DigestArticle(Base):
    __tablename__ = "digest_articles"

    digest_id: Mapped[int] = mapped_column(Integer, ForeignKey("daily_digests.id"), primary_key=True)
    article_id: Mapped[int] = mapped_column(Integer, ForeignKey("articles.id"), primary_key=True)
    rank: Mapped[int] = mapped_column(Integer, default=0)

    digest = relationship("DailyDigest", back_populates="digest_articles")
    article = relationship("Article", back_populates="digest_articles")
