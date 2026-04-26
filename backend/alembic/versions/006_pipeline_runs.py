"""Add pipeline_runs table for persistent scrape job log storage

Revision ID: 006
Revises: 005
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'pipeline_runs',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='running'),
        sa.Column('source_slug', sa.String(100), nullable=False, server_default='all'),
        sa.Column('total_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_new', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_ai_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('events_json', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('pipeline_runs')
