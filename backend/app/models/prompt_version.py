"""Prompt version registry for A/B testing of LLM prompts (#12)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(50), nullable=False)  # quality_check | rewrite | polish
    label: Mapped[str] = mapped_column(String(100), nullable=False)  # human label, e.g. "v3-shorter-headline"
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_experiment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # currently A/B testing
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Aggregated A/B telemetry
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pass_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    banned_word_retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    json_retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_input_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_output_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("ix_prompt_versions_key_active", "key", "is_active"),
    )
