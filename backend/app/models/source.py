from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    feed_url: Mapped[Optional[str]] = mapped_column(String(500))
    scraper_type: Mapped[str] = mapped_column(String(50), nullable=False)  # rss|bs4|playwright|api
    category: Mapped[str] = mapped_column(String(50), nullable=False)     # blog|news|research|social
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    scrape_config: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    articles = relationship("Article", back_populates="source")
    scrape_runs = relationship("ScrapeRun", back_populates="source")
