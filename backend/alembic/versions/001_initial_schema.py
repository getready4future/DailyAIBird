"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("feed_url", sa.String(500)),
        sa.Column("scraper_type", sa.String(50), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("last_scraped_at", sa.DateTime()),
        sa.Column("scrape_config", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "articles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(500)),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(200)),
        sa.Column("published_at", sa.DateTime()),
        sa.Column("raw_content", sa.Text()),
        sa.Column("summary", sa.Text()),
        sa.Column("topic", sa.String(100)),
        sa.Column("relevance_score", sa.Float()),
        sa.Column("impact_score", sa.Float()),
        sa.Column("sentiment", sa.String(20)),
        sa.Column("tags", sa.Text()),
        sa.Column("quality_score", sa.Float()),
        sa.Column("flags", sa.Text()),
        sa.Column("is_scam", sa.Boolean()),
        sa.Column("scam_reason", sa.Text()),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending_ai"),
        sa.Column("ai_processed", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("ai_processed_at", sa.DateTime()),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("approved_by", sa.String(200)),
        sa.Column("approved_at", sa.DateTime()),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )
    op.create_index("ix_articles_published_at", "articles", ["published_at"])
    op.create_index("ix_articles_topic_published", "articles", ["topic", "published_at"])
    op.create_index("ix_articles_relevance_published", "articles", ["relevance_score", "published_at"])
    op.create_index("ix_articles_status", "articles", ["status"])

    op.create_table(
        "daily_digests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("digest_date", sa.Date(), nullable=False),
        sa.Column("headline", sa.String(500), nullable=False),
        sa.Column("intro", sa.Text(), nullable=False),
        sa.Column("sections", sa.Text(), nullable=False),
        sa.Column("top_story_id", sa.Integer()),
        sa.Column("article_count", sa.Integer(), server_default="0"),
        sa.Column("model_used", sa.String(100)),
        sa.Column("generated_at", sa.DateTime()),
        sa.Column("status", sa.String(30), server_default="pending_review"),
        sa.Column("approved_by", sa.String(200)),
        sa.Column("approved_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime()),
        sa.ForeignKeyConstraint(["top_story_id"], ["articles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("digest_date"),
    )

    op.create_table(
        "digest_articles",
        sa.Column("digest_id", sa.Integer(), nullable=False),
        sa.Column("article_id", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), server_default="0"),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"]),
        sa.ForeignKeyConstraint(["digest_id"], ["daily_digests.id"]),
        sa.PrimaryKeyConstraint("digest_id", "article_id"),
    )

    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_id", sa.Integer()),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("status", sa.String(30), server_default="running"),
        sa.Column("articles_found", sa.Integer(), server_default="0"),
        sa.Column("articles_new", sa.Integer(), server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("scrape_runs")
    op.drop_table("digest_articles")
    op.drop_table("daily_digests")
    op.drop_index("ix_articles_status", "articles")
    op.drop_index("ix_articles_relevance_published", "articles")
    op.drop_index("ix_articles_topic_published", "articles")
    op.drop_index("ix_articles_published_at", "articles")
    op.drop_table("articles")
    op.drop_table("sources")
