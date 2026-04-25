"""Add curiosity_score and momentum_score to articles

Revision ID: 005
Revises: 004
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('articles', sa.Column('curiosity_score', sa.Float(), nullable=True))
    op.add_column('articles', sa.Column('momentum_score', sa.Integer(), nullable=True, server_default='1'))


def downgrade() -> None:
    op.drop_column('articles', 'momentum_score')
    op.drop_column('articles', 'curiosity_score')
