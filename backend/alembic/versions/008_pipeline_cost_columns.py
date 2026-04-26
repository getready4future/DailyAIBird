"""Add input_tokens / output_tokens to pipeline_runs

Revision ID: 008
Revises: 007
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pipeline_runs', sa.Column('input_tokens', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('pipeline_runs', sa.Column('output_tokens', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('pipeline_runs', 'output_tokens')
    op.drop_column('pipeline_runs', 'input_tokens')
