from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    feed_url: Mapped[Optional[str]] = mapped_column(String(500))
    scraper_type: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    scrape_config: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Configurable per-source settings
    max_articles: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    context_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cron_schedule: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # RSS conditional-fetch caching (#1)
    etag: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_modified: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Source health scoring (#2)
    health_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)  # 0..1
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    publish_rate_30d: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    auto_disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    articles = relationship("Article", back_populates="source")
    scrape_runs = relationship("ScrapeRun", back_populates="source")
