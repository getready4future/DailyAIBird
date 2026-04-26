"""Next-tier pipeline improvements: source health, RSS caching, retry queue,
title tokens, prompt versions

Revision ID: 009
Revises: 008
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Source: RSS conditional-fetch caching + health scoring ────────────────
    op.add_column('sources', sa.Column('etag', sa.String(500), nullable=True))
    op.add_column('sources', sa.Column('last_modified', sa.String(200), nullable=True))
    op.add_column('sources', sa.Column('health_score', sa.Float(), nullable=False, server_default='1.0'))
    op.add_column('sources', sa.Column('consecutive_failures', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('sources', sa.Column('publish_rate_30d', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('sources', sa.Column('auto_disabled_at', sa.DateTime(), nullable=True))

    # ── Article: retry queue + cached tokens for fast similarity ──────────────
    op.add_column('articles', sa.Column('next_retry_at', sa.DateTime(), nullable=True))
    op.add_column('articles', sa.Column('title_tokens', sa.Text(), nullable=True))

    # ── PromptVersion table ──────────────────────────────────────────────────
    op.create_table(
        'prompt_versions',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('key', sa.String(50), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_experiment', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('use_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pass_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('banned_word_retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('json_retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_input_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_output_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_prompt_versions_key_active', 'prompt_versions', ['key', 'is_active'])


def downgrade() -> None:
    op.drop_index('ix_prompt_versions_key_active', table_name='prompt_versions')
    op.drop_table('prompt_versions')
    op.drop_column('articles', 'title_tokens')
    op.drop_column('articles', 'next_retry_at')
    op.drop_column('sources', 'auto_disabled_at')
    op.drop_column('sources', 'publish_rate_30d')
    op.drop_column('sources', 'consecutive_failures')
    op.drop_column('sources', 'health_score')
    op.drop_column('sources', 'last_modified')
    op.drop_column('sources', 'etag')
