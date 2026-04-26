"""Preserve original article title for editorial comparison view

Revision ID: 010
Revises: 009
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('articles', sa.Column('original_title', sa.String(500), nullable=True))
    # Backfill: for already-AI-processed articles we don't have the original
    # any more; leave NULL. For rows still pending_ai (title hasn't been
    # rewritten yet) we copy current title so the column is populated for
    # any existing scraped-but-not-processed backlog.
    op.execute(
        "UPDATE articles SET original_title = title "
        "WHERE original_title IS NULL AND status = 'pending_ai'"
    )


def downgrade() -> None:
    op.drop_column('articles', 'original_title')
