"""Add ai_attempt_count to articles for dead-letter handling

Revision ID: 007
Revises: 006
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('articles', sa.Column('ai_attempt_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('articles', 'ai_attempt_count')
