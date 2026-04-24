"""Add admin-configurable fields to sources

Revision ID: 003
Revises: 002
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sources', sa.Column('max_articles', sa.Integer(), nullable=True))
    op.add_column('sources', sa.Column('context_prompt', sa.Text(), nullable=True))
    op.add_column('sources', sa.Column('cron_schedule', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('sources', 'cron_schedule')
    op.drop_column('sources', 'context_prompt')
    op.drop_column('sources', 'max_articles')
